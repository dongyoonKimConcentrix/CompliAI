import { SARCASM_THRESHOLD } from "@/lib/ai";

export type AuthorInfo = {
  nickname: string;
  email: string;
};

export function getAuthorDisplayName(
  author: AuthorInfo,
  sarcasmScore: number,
  threshold: number = SARCASM_THRESHOLD
): string {
  if (sarcasmScore >= threshold) {
    return `${author.nickname} (${author.email})`;
  }
  return author.nickname;
}
