import json
import logging
import re

from openai import OpenAI
from pydantic import ValidationError
from sqlmodel import Session

from app.config import get_settings
from app.models import AIAnalysisLog
from app.schemas import AnalyzeRequest, AnalyzeResponse, EvaluationResult
from app.services.settings import get_sarcasm_threshold
from app.services.prompts import (
    ANALYSIS_SYSTEM_PROMPT,
    CONTRAST_PATTERNS,
    DEADLINE_WORDS,
    FALLBACK_AGGRESSION_THRESHOLD,
    IRONY_MARKERS,
    LEISURE_WORDS,
    NEGATIVE_CONTEXT_WORDS,
    POSITIVE_SURFACE_WORDS,
    PRAISE_MARKERS,
    SARCASM_PHRASES,
    prepare_text_for_analysis,
)

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_client() -> OpenAI | None:
    if not settings.openai_api_key:
        return None
    return OpenAI(api_key=settings.openai_api_key)


def _normalize_text(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text.strip())
    normalized = normalized.replace("'", "'").replace("'", "'").replace(""", '"').replace(""", '"')
    return normalized.lower()


def _clamp_score(value: object) -> int:
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return 0


def _build_fallback_cot(normalized: str, sarcasm_score: int) -> tuple[str, str]:
    surface = [w for w in POSITIVE_SURFACE_WORDS if w in normalized]
    negative = [w for w in NEGATIVE_CONTEXT_WORDS if w in normalized]

    if sarcasm_score >= FALLBACK_AGGRESSION_THRESHOLD:
        irony = (
            f"표면 긍정어({', '.join(surface[:3])})와 부정 맥락({', '.join(negative[:3])})의 모순"
            if surface and negative
            else "긍정 표현 뒤에 태만·실수·비협조 등 부정적 맥락이 감지됨"
        )
        intent = "칭찬으로 위장한 간접 비판·조롱 가능성"
    else:
        irony = "표면 표현과 맥락 간 뚜렷한 모순이 감지되지 않음"
        intent = "진심 어린 칭찬·감사로 판단"

    return irony, intent


def _fallback_analysis(text: str) -> dict:
    """키워드·맥락 기반 분석 (OpenAI 미사용/실패 시에도 동작)."""
    normalized = _normalize_text(prepare_text_for_analysis(text))
    aggressive_words = ["바보", "멍청", "쓰레기", "꺼져", "죽어", "stupid", "idiot", "hate", "한심", "무능"]

    sarcasm_score = 0
    matched_phrases = 0

    for phrase, points in SARCASM_PHRASES:
        if phrase in normalized:
            sarcasm_score += points
            matched_phrases += 1

    for group_a, group_b, bonus in CONTRAST_PATTERNS:
        if any(w in normalized for w in group_a) and any(w in normalized for w in group_b):
            sarcasm_score += bonus
            matched_phrases += 1

    has_deadline = any(word in normalized for word in DEADLINE_WORDS)
    has_leisure = any(word in normalized for word in LEISURE_WORDS)
    if has_deadline and has_leisure:
        sarcasm_score += 20
        matched_phrases += 1

    has_irony = any(word in normalized for word in IRONY_MARKERS)
    has_negative = any(word in normalized for word in NEGATIVE_CONTEXT_WORDS)
    has_praise = any(word in normalized for word in PRAISE_MARKERS)
    genuine_thanks = any(w in normalized for w in ["감사", "고맙", "감동"]) and not has_negative

    if has_irony and has_negative and not genuine_thanks:
        sarcasm_score += 30
    if has_praise and has_negative:
        sarcasm_score += 25

    if normalized.count("참 ") >= 2 or normalized.count("참,") >= 1:
        sarcasm_score = min(100, sarcasm_score + 15)

    if matched_phrases >= 3:
        sarcasm_score = min(100, int(sarcasm_score * 1.15))
    elif matched_phrases >= 2:
        sarcasm_score = min(100, int(sarcasm_score * 1.08))

    sarcasm_score = min(100, sarcasm_score)

    if any(marker in normalized for marker in ["감사합니다", "감사해", "고맙", "감동"]):
        strong_negative = any(
            word in normalized
            for word in ["지각", "늦잠", "늦게", "참된 리더", "예술", "초등학생", "일은 안", "안하시", "날려"]
        )
        if not strong_negative:
            sarcasm_score = min(sarcasm_score, 35)

    aggression = any(word in normalized for word in aggressive_words) or sarcasm_score >= FALLBACK_AGGRESSION_THRESHOLD

    detected_irony, hidden_intent = _build_fallback_cot(normalized, sarcasm_score)
    reason = (
        "규칙 기반 분석에서 부정적 뉘앙스가 감지되었습니다."
        if sarcasm_score >= FALLBACK_AGGRESSION_THRESHOLD
        else "부정적 뉘앙스가 감지되지 않았습니다."
    )

    return {
        "detected_irony": detected_irony,
        "hidden_intent": hidden_intent,
        "sarcasm_score": sarcasm_score,
        "aggression": aggression,
        "reason": reason,
        "suggestions": "구체적인 감사와 진심 어린 칭찬을 사용해 주세요.",
        "source": "rule",
    }


def _parse_openai_report(raw: dict) -> dict | None:
    try:
        result = EvaluationResult.model_validate(raw)
        report = result.model_dump()
        report["source"] = "openai"
        return report
    except ValidationError as exc:
        logger.warning("OpenAI JSON 검증 실패, 부분 파싱 시도: %s", exc)
        score = _clamp_score(raw.get("sarcasm_score", 0))
        return {
            "detected_irony": str(raw.get("detected_irony", "")),
            "hidden_intent": str(raw.get("hidden_intent", "")),
            "reason": str(raw.get("reason", "AI 분석 결과")),
            "suggestions": str(raw.get("suggestions", "구체적인 감사와 진심 어린 칭찬을 사용해 주세요.")),
            "sarcasm_score": score,
            "aggression": bool(raw.get("aggression", False)),
            "source": "openai",
        }


def _openai_analysis(client: OpenAI, text: str) -> dict | None:
    try:
        prepared_text = prepare_text_for_analysis(text)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": prepared_text},
            ],
            temperature=0.1,
        )
        raw = json.loads(response.choices[0].message.content or "{}")
        return _parse_openai_report(raw)
    except Exception as exc:
        logger.warning("OpenAI 분석 실패, 규칙 기반 분석으로 대체: %s", exc)
        return None


def _merge_analysis(rule_report: dict, openai_report: dict | None) -> dict:
    """규칙 기반 + OpenAI 결과를 병합. 더 높은 점수·보수적 차단 적용."""
    if not openai_report:
        return rule_report

    rule_score = _clamp_score(rule_report["sarcasm_score"])
    ai_score = _clamp_score(openai_report.get("sarcasm_score", 0))
    final_score = max(rule_score, ai_score)

    if rule_score >= 45 and ai_score < rule_score - 20:
        final_score = max(final_score, rule_score)

    final_aggression = bool(rule_report["aggression"]) or bool(openai_report.get("aggression", False))
    if rule_score >= FALLBACK_AGGRESSION_THRESHOLD:
        final_aggression = True

    use_ai_narrative = ai_score > 0 or openai_report.get("detected_irony")
    detected_irony = str(
        openai_report.get("detected_irony") if use_ai_narrative else rule_report.get("detected_irony", "")
    )
    hidden_intent = str(
        openai_report.get("hidden_intent") if use_ai_narrative else rule_report.get("hidden_intent", "")
    )
    reason = str(openai_report.get("reason") if use_ai_narrative else rule_report["reason"])
    suggestions = str(openai_report.get("suggestions") or rule_report["suggestions"])

    return {
        "detected_irony": detected_irony,
        "hidden_intent": hidden_intent,
        "sarcasm_score": final_score,
        "aggression": final_aggression,
        "reason": reason,
        "suggestions": suggestions,
        "source": "hybrid" if rule_score > 0 and ai_score > 0 else openai_report.get("source", "rule"),
        "openai_score": ai_score,
        "rule_score": rule_score,
    }


async def analyze_text(request: AnalyzeRequest, session: Session) -> AnalyzeResponse:
    rule_report = _fallback_analysis(request.text)
    threshold = get_sarcasm_threshold(session)

    client = _get_client()
    openai_report = _openai_analysis(client, request.text) if client else None
    ai_report = _merge_analysis(rule_report, openai_report)

    sarcasm_score = int(ai_report["sarcasm_score"])
    aggression = bool(ai_report["aggression"])
    is_blocked = aggression or sarcasm_score >= threshold

    log = AIAnalysisLog(
        content_type=request.content_type,
        content_id=request.content_id or 0,
        text=request.text,
        sarcasm_score=sarcasm_score,
        aggression=aggression,
        is_blocked=is_blocked,
        ai_report=json.dumps(ai_report, ensure_ascii=False),
    )
    session.add(log)
    session.commit()
    session.refresh(log)

    message = (
        "분석 완료: 글이 등록되었습니다."
        if not is_blocked
        else "분석 결과 부정적 뉘앙스 또는 공격성이 감지되어 작성자 정보가 이메일과 함께 노출됩니다."
    )

    return AnalyzeResponse(
        sarcasm_score=sarcasm_score,
        aggression=aggression,
        is_blocked=is_blocked,
        ai_report=ai_report,
        message=message,
    )
