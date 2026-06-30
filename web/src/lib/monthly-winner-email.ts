import { getAppBaseUrl } from "@/lib/app-url";
import type { LeaderboardEntry } from "@/lib/praise-policy";
import { getKSTNow } from "@/lib/praise-policy";
import { getMonthlyRanking } from "@/lib/rankings";
import { isSmtpConfigured, sendMonthlyWinnerAnnouncement } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export type MonthlyWinnerEmailResult = {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  period?: { year: number; month: number; label: string };
  winners?: LeaderboardEntry[];
  recipientCount?: number;
};

export function getPreviousMonthKST(): { year: number; month: number } {
  const now = getKSTNow();
  if (now.month === 1) {
    return { year: now.year - 1, month: 12 };
  }
  return { year: now.year, month: now.month - 1 };
}

/** 매월 1일 09:00 KST (GitHub Actions cron 0 0 1 * * UTC와 동일) */
export function isMonthlyWinnerCronWindow(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const day = Number(parts.find((p) => p.type === "day")?.value);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return day === 1 && hour === 9;
}

export function getWinners(leaders: LeaderboardEntry[]): LeaderboardEntry[] {
  if (leaders.length === 0) return [];
  const topScore = leaders[0].score;
  return leaders.filter((entry) => entry.score === topScore);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RunOptions = {
  force?: boolean;
  testEmail?: string;
  triggeredBy?: "cron" | "admin";
  skipTimeWindow?: boolean;
};

export async function runMonthlyWinnerEmailJob(
  options: RunOptions = {}
): Promise<MonthlyWinnerEmailResult> {
  const { force = false, testEmail, triggeredBy = "cron", skipTimeWindow = false } = options;

  if (!isSmtpConfigured()) {
    return { ok: false, skipped: true, reason: "SMTP 설정이 없습니다." };
  }

  if (triggeredBy === "cron" && !skipTimeWindow && !isMonthlyWinnerCronWindow()) {
    return { ok: true, skipped: true, reason: "발송 시간이 아닙니다. (매월 1일 09:00 KST)" };
  }

  const { year, month } = getPreviousMonthKST();
  const ranking = await getMonthlyRanking(year, month);
  const winners = getWinners(ranking.leaders);

  if (winners.length === 0) {
    if (testEmail) {
      const appUrl = getAppBaseUrl();
      await sendMonthlyWinnerAnnouncement({
        to: testEmail,
        name: "테스트",
        periodLabel: ranking.period.label,
        winners: [],
        rankingsUrl: `${appUrl}/rankings`,
        isTest: true,
      });
      return {
        ok: true,
        skipped: false,
        period: ranking.period,
        winners: [],
        recipientCount: 1,
      };
    }

    if (!force) {
      const existing = await prisma.monthlyAnnouncementLog.findUnique({
        where: { year_month: { year, month } },
      });
      if (existing) {
        return {
          ok: true,
          skipped: true,
          reason: "이미 처리되었습니다.",
          period: ranking.period,
          winners: [],
          recipientCount: 0,
        };
      }
    }

    await prisma.monthlyAnnouncementLog.upsert({
      where: { year_month: { year, month } },
      create: {
        year,
        month,
        recipientCount: 0,
        winnerNames: "",
        triggeredBy,
      },
      update: {
        sentAt: new Date(),
        recipientCount: 0,
        winnerNames: "",
        triggeredBy,
      },
    });

    return {
      ok: true,
      skipped: true,
      reason: "해당 월 칭찬왕이 없어 메일을 발송하지 않았습니다.",
      period: ranking.period,
      winners: [],
      recipientCount: 0,
    };
  }

  if (!testEmail && !force) {
    const existing = await prisma.monthlyAnnouncementLog.findUnique({
      where: { year_month: { year, month } },
    });
    if (existing && existing.recipientCount > 0) {
      return {
        ok: true,
        skipped: true,
        reason: "이미 발송되었습니다.",
        period: ranking.period,
        winners,
        recipientCount: existing.recipientCount,
      };
    }
  }

  const recipients = testEmail
    ? [{ email: testEmail, name: "테스트" }]
    : await prisma.user.findMany({
        where: { emailVerified: { not: null } },
        select: { email: true, name: true },
      });

  if (recipients.length === 0) {
    return {
      ok: false,
      skipped: true,
      reason: "발송 대상 회원이 없습니다.",
      period: ranking.period,
      winners,
      recipientCount: 0,
    };
  }

  const appUrl = getAppBaseUrl();
  const winnerNames = winners.map((w) => w.name).join(", ");

  for (const recipient of recipients) {
    await sendMonthlyWinnerAnnouncement({
      to: recipient.email,
      name: recipient.name,
      periodLabel: ranking.period.label,
      winners,
      rankingsUrl: `${appUrl}/rankings`,
      isTest: Boolean(testEmail),
    });
    await sleep(200);
  }

  if (!testEmail) {
    await prisma.monthlyAnnouncementLog.upsert({
      where: { year_month: { year, month } },
      create: {
        year,
        month,
        recipientCount: recipients.length,
        winnerNames,
        triggeredBy,
      },
      update: {
        sentAt: new Date(),
        recipientCount: recipients.length,
        winnerNames,
        triggeredBy,
      },
    });
  }

  return {
    ok: true,
    skipped: false,
    period: ranking.period,
    winners,
    recipientCount: recipients.length,
  };
}

export async function getMonthlyWinnerEmailStatus() {
  const { year, month } = getPreviousMonthKST();
  const ranking = await getMonthlyRanking(year, month);
  const winners = getWinners(ranking.leaders);
  const log = await prisma.monthlyAnnouncementLog.findUnique({
    where: { year_month: { year, month } },
  });

  const verifiedCount = await prisma.user.count({
    where: { emailVerified: { not: null } },
  });

  return {
    smtpConfigured: isSmtpConfigured(),
    period: ranking.period,
    winners,
    verifiedRecipientCount: verifiedCount,
    lastLog: log
      ? {
          sentAt: log.sentAt.toISOString(),
          recipientCount: log.recipientCount,
          winnerNames: log.winnerNames,
          triggeredBy: log.triggeredBy,
        }
      : null,
  };
}
