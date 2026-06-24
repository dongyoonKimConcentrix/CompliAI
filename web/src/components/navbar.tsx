"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { Icon } from "@/components/icon";
import { useUIStore } from "@/store/ui-store";

export function Navbar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useUIStore();

  const authReady = status !== "loading";

  return (
    <div className="navbar bg-base-100 px-4">
      <div className="flex-1">
        <Link href="/" className="btn btn-ghost text-xl font-bold text-base-content">
          CompliAI
        </Link>
      </div>
      <div className="flex-none gap-2">
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => setTheme(theme === "apple" ? "apple-dark" : "apple")}
          aria-label={theme === "apple" ? "다크 모드" : "라이트 모드"}
        >
          <Icon name={theme === "apple" ? "fa-solid fa-moon" : "fa-solid fa-sun"} />
        </button>
        {!authReady ? (
          <div className="h-8 w-28 rounded-lg bg-base-200 animate-pulse" aria-hidden />
        ) : session ? (
          <>
            <Link href="/board" className="btn btn-ghost btn-sm gap-2">
              <Icon name="fa-solid fa-table-columns" />
              게시판
            </Link>
            <Link href="/rankings" className="btn btn-ghost btn-sm gap-2">
              <Icon name="fa-solid fa-trophy" />
              랭킹
            </Link>
            {session.user.role === UserRole.ADMIN && (
              <Link href="/admin" className="btn btn-ghost btn-sm gap-2">
                <Icon name="fa-solid fa-shield-halved" />
                관리자
              </Link>
            )}
            <Link href="/posts/new" className="btn btn-primary btn-sm gap-2">
              <Icon name="fa-solid fa-pen" />
              칭찬 작성
            </Link>
            <Link href="/mypage" className="btn btn-ghost btn-sm gap-2">
              <Icon name="fa-solid fa-user" />
              마이페이지
            </Link>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                <div className="w-8 rounded-full bg-base-content text-base-100 flex items-center justify-center text-sm font-medium !flex">
                  {session.user.name?.[0] ?? "U"}
                </div>
              </div>
              <ul tabIndex={0} className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow-apple border border-base-300">
                <li className="menu-title">{session.user.name}</li>
                <li>
                  <Link href="/profile" className="gap-2">
                    <Icon name="fa-solid fa-gear" />
                    프로필 설정
                  </Link>
                </li>
                <li>
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="gap-2">
                    <Icon name="fa-solid fa-right-from-bracket" />
                    로그아웃
                  </button>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost btn-sm">
              로그인
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              회원가입
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
