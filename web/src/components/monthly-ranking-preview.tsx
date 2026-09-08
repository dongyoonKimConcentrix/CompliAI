"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Icon } from "@/components/icon";
import { getKSTNow } from "@/lib/praise-policy";
import type { LeaderboardEntry } from "@/lib/praise-policy";
import { http } from "@/lib/http";

export function MonthlyRankingPreview() {
  const { data: session } = useSession();
  const now = getKSTNow();

  const { data } = useQuery({
    queryKey: ["rankings", now.year, now.month],
    queryFn: async () => {
      const { data } = await http.get<{ leaders: LeaderboardEntry[]; period: { label: string } }>(
        "/api/rankings/monthly",
        { params: { year: now.year, month: now.month } }
      );
      return data;
    },
    enabled: !!session,
  });

  if (!session) return null;

  const topThree = data?.leaders.slice(0, 3) ?? [];

  if (topThree.length === 0) return null;

  return (
    <div className="card bg-base-100 shadow-apple mt-8">
      <div className="card-body">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="card-title gap-2 text-lg sm:text-xl">
            <Icon name="fa-solid fa-trophy" />
            {data?.period.label} 칭찬왕
          </h2>
          <Link href="/rankings" className="btn btn-ghost btn-sm gap-1">
            전체 보기
            <Icon name="fa-solid fa-chevron-right" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 mt-2">
          {topThree.map((leader) => (
            <div
              key={leader.userId}
              className={`rounded-xl p-4 border border-base-300 ${
                leader.rank === 1 ? "bg-base-content text-base-100" : "bg-base-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon
                  name={
                    leader.rank === 1
                      ? "fa-solid fa-trophy"
                      : leader.rank === 2
                        ? "fa-solid fa-medal"
                        : "fa-solid fa-award"
                  }
                />
                <span className="font-semibold">{leader.rank}위</span>
              </div>
              <p className="font-medium">{leader.name}</p>
              <p className={`text-sm ${leader.rank === 1 ? "text-base-100/70" : "text-base-content/50"}`}>
                {leader.score}점 · {leader.praiseCount}건
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
