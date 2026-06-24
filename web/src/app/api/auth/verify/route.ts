import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { isTokenExpired } from "@/lib/verification";

type VerifyResult =
  | { ok: true }
  | { error: "invalid_token" | "expired_token" | "already_verified" };

function normalizeToken(token: string | null): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

async function verifyToken(token: string | null): Promise<VerifyResult> {
  const normalized = normalizeToken(token);

  if (!normalized) {
    return { error: "invalid_token" };
  }

  const user = await prisma.user.findUnique({ where: { verificationToken: normalized } });

  if (!user) {
    return { error: "invalid_token" };
  }

  if (user.emailVerified) {
    return { error: "already_verified" };
  }

  if (isTokenExpired(user.updatedAt)) {
    return { error: "expired_token" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      verificationToken: null,
    },
  });

  return { ok: true };
}

/** 구형 메일 링크(/api/auth/verify) — 확인 페이지로 리다이렉트 (GET prefetch로 토큰 소진 방지) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(appUrl("/login?error=invalid_token", request));
  }

  return NextResponse.redirect(
    appUrl(`/verify-email?token=${encodeURIComponent(token)}`, request)
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await verifyToken(body.token ?? null);

    if ("ok" in result) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "verify_failed" }, { status: 500 });
  }
}
