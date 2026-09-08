import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

type Ctx = { params: Promise<{ path: string[] }> };

function apiOrigin() {
  return (process.env.FASTAPI_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
}

function cookieOptions() {
  const publicUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: publicUrl.startsWith("https"),
  };
}

async function proxy(req: NextRequest, path: string[]) {
  const target = `${apiOrigin()}/api/${path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  let upstream: Response;
  try {
    const init: RequestInit = {
      method: req.method,
      headers,
      redirect: "manual",
      cache: "no-store",
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.arrayBuffer();
    }
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { error: "API 서버에 연결할 수 없습니다. FastAPI(포트 8000)가 실행 중인지 확인해 주세요." },
      { status: 502 }
    );
  }

  const route = path.join("/");
  if (route === "auth/login" || route === "auth/logout") {
    const data = await upstream.json().catch(() => null);
    const res = NextResponse.json(data ?? { error: "응답을 처리하지 못했습니다." }, {
      status: upstream.status,
    });
    if (route === "auth/login" && upstream.ok && data?.access_token) {
      res.cookies.set(TOKEN_COOKIE, data.access_token, cookieOptions());
    }
    if (route === "auth/logout") {
      res.cookies.set(TOKEN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    }
    return res;
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie" || HOP_BY_HOP.has(lower)) return;
    out.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) {
    out.append("set-cookie", cookie);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

async function handle(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
