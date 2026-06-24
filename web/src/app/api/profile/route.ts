import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { isDuplicateName, normalizeName } from "@/lib/praise-policy";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      nickname: true,
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

  const { nickname, profileImage, name } = await request.json();

  const currentUser = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { name: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const updateData: { nickname?: string; profileImage?: string | null; name?: string } = {};

  if (nickname) updateData.nickname = nickname;
  if (profileImage !== undefined) updateData.profileImage = profileImage;

  if (name !== undefined) {
    const normalizedName = normalizeName(String(name));

    if (normalizedName.length > 0 && normalizedName.length < 2) {
      return NextResponse.json({ error: "이름은 2자 이상 입력해 주세요." }, { status: 400 });
    }

    if (currentUser.name && normalizedName && normalizedName !== currentUser.name) {
      return NextResponse.json(
        { error: "이름은 가입 후 변경할 수 없습니다." },
        { status: 400 }
      );
    }

    if (!currentUser.name && normalizedName) {
      const registeredUsers = await prisma.user.findMany({
        where: { name: { not: "" }, NOT: { id: session!.user.id } },
        select: { id: true, name: true, nickname: true },
      });

      if (isDuplicateName(normalizedName, registeredUsers)) {
        return NextResponse.json(
          { error: "동일한 이름으로 등록된 회원이 있습니다." },
          { status: 409 }
        );
      }

      updateData.name = normalizedName;
    }
  }

  const user = await prisma.user.update({
    where: { id: session!.user.id },
    data: updateData,
    select: { id: true, email: true, name: true, nickname: true, profileImage: true },
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
