export const FASTAPI_URL =
  process.env.FASTAPI_INTERNAL_URL || "http://localhost:8000";

export const SARCASM_THRESHOLD = 70;

export type AIAnalysisResult = {
  sarcasm_score: number;
  aggression: boolean;
  is_blocked: boolean;
  ai_report: Record<string, unknown>;
  message: string;
};

export async function analyzeContent(
  text: string,
  contentType: "post" | "comment",
  contentId?: string
): Promise<AIAnalysisResult> {
  const res = await fetch(`${FASTAPI_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      content_type: contentType,
      content_id: contentId ? parseInt(contentId.slice(-6), 36) || 0 : 0,
    }),
  });

  if (!res.ok) {
    throw new Error("AI 분석 서버 오류");
  }

  return res.json();
}
