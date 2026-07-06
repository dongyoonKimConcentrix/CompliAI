import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALLOWED_EMAIL_ERROR, isAllowedCompanyEmail } from "@/lib/email-policy";
import {
  createPasswordResetToken,
  dispatchPasswordResetEmail,
  getPasswordResetExpiry,
} from "@/lib/password-reset";

const GENERIC_SUCCESS_MESSAGE =
  "등록된 이메일이라면 비밀번호 재설정 링크를 발송했습니다. 메일함을 확인해 주세요.";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAllowedCompanyEmail(normalizedEmail)) {
      return NextResponse.json({ error: ALLOWED_EMAIL_ERROR }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE });
    }

    const token = createPasswordResetToken();
    const expiresAt = getPasswordResetExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetTokenExpiresAt: expiresAt,
      },
    });

    const mailResult = await dispatchPasswordResetEmail(user.email, user.name, token);

    return NextResponse.json({
      message: mailResult.message || GENERIC_SUCCESS_MESSAGE,
      emailSent: mailResult.sent,
      resetUrl: mailResult.resetUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "비밀번호 재설정 요청 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
