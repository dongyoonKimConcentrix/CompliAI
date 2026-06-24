import { SARCASM_THRESHOLD } from "@/lib/ai";

export const PRAISE_POST_POINTS = 10;
export const PRAISE_LIKE_POINTS = 1;

export type PraisePost = {
  authorId: string;
  targetName: string;
  sarcasmScore: number;
  aggression: boolean;
  createdAt: Date;
  likeCount: number;
};

export type PraiseUser = {
  id: string;
  name: string;
  nickname: string;
};

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function namesMatch(registeredName: string, targetName: string): boolean {
  const a = normalizeName(registeredName);
  const b = normalizeName(targetName);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

export function isPositivePraise(post: Pick<PraisePost, "sarcasmScore" | "aggression">): boolean {
  return post.sarcasmScore < SARCASM_THRESHOLD && !post.aggression;
}

export function resolveTargetUser(
  targetName: string,
  users: PraiseUser[]
): PraiseUser | null {
  const matches = users.filter((user) => user.name && namesMatch(user.name, targetName));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return matches.sort((a, b) => b.name.length - a.name.length)[0];
}

export function isDuplicateName(name: string, users: PraiseUser[]): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  return users.some((user) => user.name && namesMatch(user.name, normalized));
}

export function getMonthRangeKST(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`
  );
  return { start, end };
}

export function getKSTNow(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

export function calculatePraiseScore(praiseCount: number, likeCount: number): number {
  return praiseCount * PRAISE_POST_POINTS + likeCount * PRAISE_LIKE_POINTS;
}

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  nickname: string;
  praiseCount: number;
  likeCount: number;
  score: number;
};

export function buildLeaderboard(
  posts: PraisePost[],
  users: PraiseUser[]
): LeaderboardEntry[] {
  const totals = new Map<
    string,
    { userId: string; name: string; nickname: string; praiseCount: number; likeCount: number }
  >();

  for (const post of posts) {
    if (!isPositivePraise(post)) continue;

    const recipient = resolveTargetUser(post.targetName, users);
    if (!recipient) continue;
    if (post.authorId === recipient.id) continue;

    const current = totals.get(recipient.id) ?? {
      userId: recipient.id,
      name: recipient.name,
      nickname: recipient.nickname,
      praiseCount: 0,
      likeCount: 0,
    };

    current.praiseCount += 1;
    current.likeCount += post.likeCount;
    totals.set(recipient.id, current);
  }

  const sorted = [...totals.values()]
    .map((entry) => ({
      ...entry,
      score: calculatePraiseScore(entry.praiseCount, entry.likeCount),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.praiseCount !== a.praiseCount) return b.praiseCount - a.praiseCount;
      return a.name.localeCompare(b.name, "ko");
    });

  return sorted.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    name: entry.name,
    nickname: entry.nickname,
    praiseCount: entry.praiseCount,
    likeCount: entry.likeCount,
    score: entry.score,
  }));
}
