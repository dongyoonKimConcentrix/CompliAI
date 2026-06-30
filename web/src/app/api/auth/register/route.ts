import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createVerificationToken,
  dispatchVerificationEmail,
} from "@/lib/verification";
import { ALLOWED_EMAIL_ERROR, isAllowedCompanyEmail } from "@/lib/email-policy";
import { createUniqueDisplayId } from "@/lib/display-id";
import { isDuplicateName, normalizeName } from "@/lib/praise-policy";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "모든 필드를 입력해 주세요." }, { status: 400 });
    }

    const normalizedName = normalizeName(name);
    if (normalizedName.length < 2) {
      return NextResponse.json({ error: "이름은 2자 이상 입력해 주세요." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAllowedCompanyEmail(normalizedEmail)) {
      return NextResponse.json({ error: ALLOWED_EMAIL_ERROR }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
    }

    const registeredUsers = await prisma.user.findMany({
      select: { id: true, name: true },
    });

    if (isDuplicateName(normalizedName, registeredUsers)) {
      return NextResponse.json(
        { error: "동일한 이름으로 등록된 회원이 있습니다. 이름을 확인해 주세요." },
        { status: 409 }
      );
    }

    const displayId = await createUniqueDisplayId(async (id) => {
      const found = await prisma.user.findUnique({ where: { displayId: id } });
      return !!found;
    });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = createVerificationToken();

    await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: normalizedName,
        displayId,
        verificationToken,
      },
    });

    const mailResult = await dispatchVerificationEmail(
      normalizedEmail,
      normalizedName,
      verificationToken
    );

    return NextResponse.json({
      message: mailResult.message,
      emailSent: mailResult.sent,
      verifyUrl: mailResult.verifyUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "회원가입 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
