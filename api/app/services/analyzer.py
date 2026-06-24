import json
import logging

from openai import OpenAI
from sqlmodel import Session

from app.config import get_settings
from app.models import AIAnalysisLog
from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.settings import get_sarcasm_threshold
from app.services.prompts import (
    ANALYSIS_SYSTEM_PROMPT,
    CONTRAST_PATTERNS,
    DEADLINE_WORDS,
    FALLBACK_AGGRESSION_THRESHOLD,
    LEISURE_WORDS,
    SARCASM_PHRASES,
)

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_client() -> OpenAI | None:
    if not settings.openai_api_key:
        return None
    return OpenAI(api_key=settings.openai_api_key)


def _fallback_analysis(text: str) -> dict:
    """키워드·맥락 기반 분석 (OpenAI 미사용/실패 시에도 동작)."""
    lowered = text.lower()
    aggressive_words = ["바보", "멍청", "쓰레기", "꺼져", "죽어", "stupid", "idiot", "hate"]

    sarcasm_score = 0

    for phrase, points in SARCASM_PHRASES:
        if phrase in lowered:
            sarcasm_score += points

    for group_a, group_b, bonus in CONTRAST_PATTERNS:
        if any(w in lowered for w in group_a) and any(w in lowered for w in group_b):
            sarcasm_score += bonus

    has_deadline = any(word in lowered for word in DEADLINE_WORDS)
    has_leisure = any(word in lowered for word in LEISURE_WORDS)
    if has_deadline and has_leisure:
        sarcasm_score += 20

    if lowered.count("참 ") >= 2:
        sarcasm_score = min(100, sarcasm_score + 15)

    sarcasm_score = min(100, sarcasm_score)
    aggression = any(word in lowered for word in aggressive_words) or sarcasm_score >= FALLBACK_AGGRESSION_THRESHOLD

    reason = (
        "규칙 기반 분석에서 부정적 뉘앙스가 감지되었습니다."
        if sarcasm_score > 0
        else "부정적 뉘앙스가 감지되지 않았습니다."
    )

    return {
        "sarcasm_score": sarcasm_score,
        "aggression": aggression,
        "reason": reason,
        "suggestions": "구체적인 감사와 진심 어린 칭찬을 사용해 주세요.",
        "source": "rule",
    }


def _openai_analysis(client: OpenAI, text: str) -> dict | None:
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0.1,
        )
        report = json.loads(response.choices[0].message.content or "{}")
        report["source"] = "openai"
        return report
    except Exception as exc:
        logger.warning("OpenAI 분석 실패, 규칙 기반 분석으로 대체: %s", exc)
        return None


def _merge_analysis(rule_report: dict, openai_report: dict | None) -> dict:
    """규칙 기반 + OpenAI 결과를 병합. 더 높은 점수·보수적 차단 적용."""
    if not openai_report:
        return rule_report

    rule_score = int(rule_report["sarcasm_score"])
    ai_score = int(openai_report.get("sarcasm_score", 0))
    final_score = max(rule_score, ai_score)

    final_aggression = bool(rule_report["aggression"]) or bool(openai_report.get("aggression", False))

    if ai_score > 0:
        reason = str(openai_report.get("reason", rule_report["reason"]))
    else:
        reason = rule_report["reason"]

    suggestions = str(openai_report.get("suggestions") or rule_report["suggestions"])

    return {
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
