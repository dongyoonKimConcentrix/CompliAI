import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export function isAdmin(session: Session) {
  return session.user.role === UserRole.ADMIN;
}

export function canDeletePost(session: Session, authorId: string) {
  return session.user.id === authorId || isAdmin(session);
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { session: null, error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireAuth();
  if (error) return { session: null, error };

  if (session!.user.role !== UserRole.ADMIN) {
    return {
      session: null,
      error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }),
    };
  }

  return { session, error: null };
}
