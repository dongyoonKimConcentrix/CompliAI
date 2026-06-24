import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createVerificationToken,
  dispatchVerificationEmail,
} from "@/lib/verification";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "이미 인증된 계정입니다. 로그인해 주세요." }, { status: 400 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const verificationToken = createVerificationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    const mailResult = await dispatchVerificationEmail(user.email, user.nickname, verificationToken);

    return NextResponse.json({
      message: mailResult.message,
      emailSent: mailResult.sent,
      verifyUrl: mailResult.verifyUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "인증 메일 재발송 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
