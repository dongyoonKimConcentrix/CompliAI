import { SARCASM_THRESHOLD } from "@/lib/ai";

export const REPORT_THRESHOLD = 3;

export type AuthorInfo = {
  displayId: string;
  email: string;
};

export function getAuthorDisplayName(
  author: AuthorInfo,
  sarcasmScore: number,
  reportCount: number = 0,
  sarcasmThreshold: number = SARCASM_THRESHOLD,
  reportThreshold: number = REPORT_THRESHOLD
): string {
  if (sarcasmScore >= sarcasmThreshold || reportCount >= reportThreshold) {
    return `${author.displayId} (${author.email})`;
  }
  return author.displayId;
}
