import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      displayId: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { posts: true, comments: true } },
    },
  });

  return NextResponse.json({ users, total: users.length });
}

export async function DELETE(request: Request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { userId } = await request.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "삭제할 회원 ID가 필요합니다." }, { status: 400 });
  }

  if (userId === session!.user.id) {
    return NextResponse.json(
      { error: "본인 계정은 이 화면에서 삭제할 수 없습니다. 프로필의 회원 탈퇴를 이용해 주세요." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, name: true },
  });

  if (!target) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  if (target.role === UserRole.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "마지막 관리자 계정은 삭제할 수 없습니다." },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({ where: { id: target.id } });

  return NextResponse.json({
    message: `${target.name}(${target.email}) 계정이 삭제되었습니다.`,
  });
}
