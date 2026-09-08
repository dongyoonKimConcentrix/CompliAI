import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/types";

const PROTECTED = ["/board", "/posts", "/mypage", "/profile", "/rankings", "/admin"];

function isProtected(pathname: string) {
  return PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  if (!isProtected(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/board", "/posts/:path*", "/mypage", "/profile", "/rankings", "/admin"],
};
