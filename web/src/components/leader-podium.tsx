import { Icon } from "@/components/icon";
import type { LeaderboardEntry } from "@/lib/praise-policy";

type LeaderPodiumProps = {
  leaders: LeaderboardEntry[];
};

const podiumConfig = [
  { rank: 2, height: "h-24", icon: "fa-solid fa-medal", order: "order-1" },
  { rank: 1, height: "h-32", icon: "fa-solid fa-trophy", order: "order-2" },
  { rank: 3, height: "h-20", icon: "fa-solid fa-award", order: "order-3" },
] as const;

export function LeaderPodium({ leaders }: LeaderPodiumProps) {
  if (leaders.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/60">
        아직 집계된 칭찬이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4">
      {podiumConfig.map(({ rank, height, icon, order }) => {
        const leader = leaders.find((entry) => entry.rank === rank);
        const isFirst = rank === 1;

        return (
          <div
            key={rank}
            className={`flex flex-col items-center w-28 sm:w-32 ${order}`}
          >
            {leader ? (
              <>
                <Icon
                  name={icon}
                  className={`mb-2 ${isFirst ? "text-2xl" : "text-lg"} text-base-content/70`}
                />
                <p className={`font-semibold text-center truncate w-full ${isFirst ? "text-lg" : "text-base"}`}>
                  {leader.name}
                </p>
                <p className="text-xs text-base-content/50 truncate w-full text-center">
                  {leader.nickname}
                </p>
                <p className="text-sm font-medium mt-1">{leader.score}점</p>
                <p className="text-xs text-base-content/50 flex items-center gap-2 justify-center">
                  <span>{leader.praiseCount}건</span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="fa-regular fa-heart" className="text-xs" />
                    {leader.likeCount}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-base-content/40 mb-2">—</p>
            )}
            <div
              className={`w-full mt-3 rounded-t-xl ${height} ${
                isFirst ? "bg-base-content text-base-100" : "bg-base-300 text-base-content"
              } flex items-center justify-center font-bold text-lg`}
            >
              {rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}
