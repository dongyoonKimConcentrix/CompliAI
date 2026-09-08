import Link from "next/link";
import { Icon } from "@/components/icon";
import { MonthlyRankingPreview } from "@/components/monthly-ranking-preview";
import { getServerSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getServerSession();
  const startHref = session?.user ? "/board" : "/login";

  return (
    <div>
      <div className="hero min-h-[50vh] sm:min-h-[60vh] bg-base-100 rounded-xl sm:rounded-2xl shadow-apple">
        <div className="hero-content text-center px-4 py-8 sm:py-12">
          <div className="max-w-lg">
            <h1 className="text-3xl sm:text-5xl font-bold text-base-content tracking-tight">CompliAI</h1>
            <p className="py-4 sm:py-6 text-base sm:text-lg text-base-content/70">
              동료를 칭찬하고 응원하는 따뜻한 사내 문화를 만들어 보세요.
              AI가 부정적 뉘앙스와 공격적인 표현을 실시간으로 필터링합니다.
            </p>
            <div className="flex gap-2 sm:gap-4 justify-center flex-wrap">
              <Link href="/board" className="btn btn-primary gap-2">
                <Icon name="fa-solid fa-table-columns" />
                칭찬 게시판 보기
              </Link>
              <Link href="/rankings" className="btn btn-outline gap-2">
                <Icon name="fa-solid fa-trophy" />
                월별 랭킹
              </Link>
              <Link href={startHref} className="btn btn-ghost">
                시작하기
              </Link>
            </div>
          </div>
        </div>
      </div>
      <MonthlyRankingPreview />
    </div>
  );
}
