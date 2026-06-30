import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      displayId: true,
      profileImage: true,
      createdAt: true,
      _count: { select: { posts: true, comments: true, likes: true } },
    },
  });

  return NextResponse.json({ user });
}

export async function PUT(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { profileImage } = await request.json();

  const updateData: { profileImage?: string | null } = {};
  if (profileImage !== undefined) updateData.profileImage = profileImage;

  const user = await prisma.user.update({
    where: { id: session!.user.id },
    data: updateData,
    select: { id: true, email: true, name: true, displayId: true, profileImage: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { password } = await request.json();

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { id: true, passwordHash: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  if (user.role === UserRole.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "마지막 관리자 계정은 탈퇴할 수 없습니다." },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ message: "회원 탈퇴가 완료되었습니다." });
}
