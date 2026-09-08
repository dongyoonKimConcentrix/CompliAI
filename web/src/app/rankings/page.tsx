"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { LeaderPodium } from "@/components/leader-podium";
import { MonthPicker } from "@/components/month-picker";
import { MonthlyLeaderboard } from "@/components/monthly-leaderboard";
import { getKSTNow } from "@/lib/praise-policy";
import type { LeaderboardEntry } from "@/lib/praise-policy";
import { http } from "@/lib/http";

type RankingResponse = {
  period: { year: number; month: number; label: string; isCurrentMonth: boolean };
  leaders: LeaderboardEntry[];
  myRank: LeaderboardEntry | null;
  scoring: { postPoints: number; likePoints: number; formula: string };
  criteria: string;
};

export default function RankingsPage() {
  const now = getKSTNow();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);

  const { data, isLoading } = useQuery({
    queryKey: ["rankings", year, month],
    queryFn: async () => {
      const { data } = await http.get<RankingResponse>("/api/rankings/monthly", {
        params: { year, month },
      });
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Icon name="fa-solid fa-trophy" />
            월별 칭찬 랭킹
          </h1>
          <p className="text-base-content/60 mt-1">
            긍정 칭찬만 집계 · 자기 칭찬 제외 · 최초 작성 월 기준
          </p>
        </div>
        <Link href="/board" className="btn btn-outline btn-sm gap-2 w-fit">
          <Icon name="fa-solid fa-table-columns" />
          게시판
        </Link>
      </div>

      <div className="card bg-base-100 shadow-apple">
        <div className="card-body">
          <MonthPicker
            year={year}
            month={month}
            onChange={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
          />

          {isLoading ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <>
              <LeaderPodium leaders={data?.leaders ?? []} />
              <MonthlyLeaderboard leaders={data?.leaders ?? []} />

              {data?.myRank && (
                <div className="alert alert-neutral mt-6">
                  <Icon name="fa-solid fa-user" />
                  <span>
                    내 순위: <strong>{data.myRank.rank}위</strong> ({data.myRank.score}점 ·{" "}
                    {data.myRank.praiseCount}건 ·{" "}
                    <span className="inline-flex items-center gap-1">
                      <Icon name="fa-regular fa-heart" className="text-xs" />
                      {data.myRank.likeCount}
                    </span>
                    )
                  </span>
                </div>
              )}

              {!data?.myRank && data?.leaders.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-base-content/60 mb-4">이번 달 칭찬 데이터가 없습니다.</p>
                  <Link href="/posts/new" className="btn btn-primary gap-2">
                    <Icon name="fa-solid fa-pen" />
                    칭찬 작성하기
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {data && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body text-sm text-base-content/70 space-y-2">
            <p className="font-medium text-base-content flex items-center gap-2">
              <Icon name="fa-solid fa-circle-info" />
              집계 기준
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>{data.scoring.formula}</li>
              <li>{data.criteria}</li>
              <li>칭찬 대상은 회원 선택으로 지정되며, 자기 칭찬은 집계에서 제외됩니다</li>
              <li>수정된 글도 최초 작성 월에 반영됩니다</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
