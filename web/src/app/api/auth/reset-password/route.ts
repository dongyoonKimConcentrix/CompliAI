import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPasswordResetTokenExpired } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }

    if (isPasswordResetTokenExpired(user.passwordResetTokenExpiresAt)) {
      return NextResponse.json({ error: "expired_token" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return NextResponse.json({ message: "비밀번호가 변경되었습니다." });
  } catch {
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }
}
