import Link from "next/link";
import { Icon } from "@/components/icon";
import type { LeaderboardEntry } from "@/lib/praise-policy";

type MonthlyLeaderboardProps = {
  leaders: LeaderboardEntry[];
  showFromRank?: number;
};

export function MonthlyLeaderboard({ leaders, showFromRank = 4 }: MonthlyLeaderboardProps) {
  const rest = leaders.filter((entry) => entry.rank >= showFromRank);

  if (rest.length === 0) return null;

  return (
    <div className="space-y-2">
      {rest.map((entry) => (
        <div
          key={entry.userId}
          className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl bg-base-100 border border-base-300"
        >
          <span className="text-base sm:text-lg font-semibold w-6 sm:w-8 text-center text-base-content/50 shrink-0">
            {entry.rank}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{entry.name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold">{entry.score}점</p>
            <p className="text-xs text-base-content/50 flex items-center gap-2 justify-end">
              <span>{entry.praiseCount}건</span>
              <span className="inline-flex items-center gap-1">
                <Icon name="fa-regular fa-heart" className="text-xs" />
                {entry.likeCount}
              </span>
            </p>
          </div>
          <Link
            href={`/board?q=${encodeURIComponent(entry.name)}`}
            className="btn btn-ghost btn-sm btn-circle shrink-0"
            aria-label={`${entry.name} 칭찬 글 보기`}
          >
            <Icon name="fa-solid fa-arrow-up-right-from-square" />
          </Link>
        </div>
      ))}
    </div>
  );
}
