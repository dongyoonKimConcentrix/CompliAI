import { SARCASM_THRESHOLD } from "@/lib/ai";

type NegativeNuanceScoreProps = {
  score: number;
  size?: "sm" | "md";
  threshold?: number;
};

export function NegativeNuanceScore({
  score,
  size = "sm",
  threshold = SARCASM_THRESHOLD,
}: NegativeNuanceScoreProps) {
  const badgeSize = size === "sm" ? "badge-sm" : "";
  const color =
    score >= threshold
      ? "badge-score-high"
      : score >= 40
        ? "badge-score-mid"
        : "badge-score-low";

  return (
    <span className={`badge ${badgeSize} ${color} badge-outline`}>
      부정적 뉘앙스 {score}/100
    </span>
  );
}
