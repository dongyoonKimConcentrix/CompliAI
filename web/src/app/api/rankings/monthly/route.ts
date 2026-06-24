import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getMonthlyRanking } from "@/lib/rankings";
import { getKSTNow } from "@/lib/praise-policy";

export async function GET(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const now = getKSTNow();

  const year = Number(searchParams.get("year") ?? now.year);
  const month = Number(searchParams.get("month") ?? now.month);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "유효하지 않은 연월입니다." }, { status: 400 });
  }

  const ranking = await getMonthlyRanking(year, month);
  const myRank = ranking.leaders.find((entry) => entry.userId === session!.user.id) ?? null;

  return NextResponse.json({ ...ranking, myRank });
}
