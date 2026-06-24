import { ModerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildLeaderboard,
  getKSTNow,
  getMonthRangeKST,
  type LeaderboardEntry,
} from "@/lib/praise-policy";
import { getSarcasmThreshold } from "@/lib/settings";

export type MonthlyRankingResult = {
  period: {
    year: number;
    month: number;
    label: string;
    isCurrentMonth: boolean;
  };
  leaders: LeaderboardEntry[];
  scoring: {
    postPoints: number;
    likePoints: number;
    formula: string;
  };
  criteria: string;
};

export async function getMonthlyRanking(
  year: number,
  month: number
): Promise<MonthlyRankingResult> {
  const { start, end } = getMonthRangeKST(year, month);
  const now = getKSTNow();
  const threshold = await getSarcasmThreshold();

  const [users, posts] = await Promise.all([
    prisma.user.findMany({
      where: { name: { not: "" } },
      select: { id: true, name: true, nickname: true },
    }),
    prisma.post.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        sarcasmScore: { lt: threshold },
        aggression: false,
        moderationStatus: ModerationStatus.APPROVED,
      },
      select: {
        authorId: true,
        targetName: true,
        sarcasmScore: true,
        aggression: true,
        createdAt: true,
        _count: { select: { likes: true } },
      },
    }),
  ]);

  const praisePosts = posts.map((post) => ({
    authorId: post.authorId,
    targetName: post.targetName,
    sarcasmScore: post.sarcasmScore,
    aggression: post.aggression,
    createdAt: post.createdAt,
    likeCount: post._count.likes,
  }));

  const leaders = buildLeaderboard(praisePosts, users);

  return {
    period: {
      year,
      month,
      label: `${year}년 ${month}월`,
      isCurrentMonth: year === now.year && month === now.month,
    },
    leaders,
    scoring: {
      postPoints: 10,
      likePoints: 1,
      formula: "점수 = 칭찬 건수 × 10 + 좋아요 × 1",
    },
    criteria:
      "긍정 칭찬만 집계 (부정적 뉘앙스 70점 미만·공격성 없음), 자기 칭찬 제외, 최초 작성 월 기준, 이름 부분 일치 통합",
  };
}

export async function getMyRank(
  userId: string,
  year: number,
  month: number
): Promise<LeaderboardEntry | null> {
  const result = await getMonthlyRanking(year, month);
  return result.leaders.find((entry) => entry.userId === userId) ?? null;
}
