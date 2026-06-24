import Link from "next/link";
import { Icon } from "@/components/icon";
import { MonthlyRankingPreview } from "@/components/monthly-ranking-preview";

export default function HomePage() {
  return (
    <div>
      <div className="hero min-h-[60vh] bg-base-100 rounded-2xl shadow-apple">
        <div className="hero-content text-center">
          <div className="max-w-lg">
            <h1 className="text-5xl font-bold text-base-content tracking-tight">CompliAI</h1>
            <p className="py-6 text-lg text-base-content/70">
              동료를 칭찬하고 응원하는 따뜻한 사내 문화를 만들어 보세요.
              AI가 부정적 뉘앙스와 공격적인 표현을 실시간으로 필터링합니다.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/board" className="btn btn-primary gap-2">
                <Icon name="fa-solid fa-table-columns" />
                칭찬 게시판 보기
              </Link>
              <Link href="/rankings" className="btn btn-outline gap-2">
                <Icon name="fa-solid fa-trophy" />
                월별 랭킹
              </Link>
              <Link href="/register" className="btn btn-ghost">
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
