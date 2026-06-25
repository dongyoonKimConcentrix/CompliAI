"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { Icon } from "@/components/icon";
import { useUIStore } from "@/store/ui-store";

type NavLink = {
  href: string;
  label: string;
  icon: string;
  variant?: "primary" | "ghost";
};

function NavLinks({
  links,
  className,
}: {
  links: NavLink[];
  className?: string;
}) {
  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            link.variant === "primary"
              ? `btn btn-primary btn-sm gap-2 ${className ?? ""}`
              : `btn btn-ghost btn-sm gap-2 ${className ?? ""}`
          }
        >
          <Icon name={link.icon} />
          {link.label}
        </Link>
      ))}
    </>
  );
}

export function Navbar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useUIStore();

  const authReady = status !== "loading";
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  const authLinks: NavLink[] = [
    { href: "/board", label: "게시판", icon: "fa-solid fa-table-columns" },
    { href: "/rankings", label: "랭킹", icon: "fa-solid fa-trophy" },
    ...(isAdmin
      ? [{ href: "/admin", label: "관리자", icon: "fa-solid fa-shield-halved" } satisfies NavLink]
      : []),
    { href: "/posts/new", label: "칭찬 작성", icon: "fa-solid fa-pen", variant: "primary" },
    { href: "/mypage", label: "마이페이지", icon: "fa-solid fa-user" },
  ];

  const toggleTheme = () => setTheme(theme === "apple" ? "apple-dark" : "apple");

  return (
    <div className="navbar bg-base-100 px-2 sm:px-4 sticky top-0 z-50 min-h-14">
      <div className="navbar-start gap-1">
        {authReady && session && (
          <div className="dropdown md:hidden">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-square" aria-label="메뉴 열기">
              <Icon name="fa-solid fa-bars" />
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-56 p-2 shadow-apple border border-base-300"
            >
              {authLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="gap-2">
                    <Icon name={link.icon} />
                    {link.label}
                  </Link>
                </li>
              ))}
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
        )}
        <Link href="/" className="btn btn-ghost text-lg sm:text-xl font-bold text-base-content px-2 sm:px-4">
          CompliAI
        </Link>
      </div>

      <div className="navbar-end gap-1 sm:gap-2">
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={toggleTheme}
          aria-label={theme === "apple" ? "다크 모드" : "라이트 모드"}
        >
          <Icon name={theme === "apple" ? "fa-solid fa-moon" : "fa-solid fa-sun"} />
        </button>

        {!authReady ? (
          <div className="h-8 w-20 sm:w-28 rounded-lg bg-base-200 animate-pulse" aria-hidden />
        ) : session ? (
          <>
            <div className="hidden md:flex items-center gap-1 lg:gap-2">
              <NavLinks links={authLinks} />
            </div>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                <div className="w-8 rounded-full bg-base-content text-base-100 flex items-center justify-center text-sm font-medium !flex">
                  {session.user.name?.[0] ?? "U"}
                </div>
              </div>
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow-apple border border-base-300"
              >
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
            <Link href="/login" className="btn btn-ghost btn-sm px-2 sm:px-4">
              로그인
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm px-2 sm:px-4">
              회원가입
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
