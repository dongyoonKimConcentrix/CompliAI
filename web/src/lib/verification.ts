import crypto from "crypto";
import { getAppBaseUrl } from "@/lib/app-url";
import { sendVerificationEmail, isSmtpConfigured } from "@/lib/mail";

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function createVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getVerifyUrl(token: string): string {
  return `${getAppBaseUrl()}/api/auth/verify?token=${token}`;
}

export type SendVerificationResult = {
  sent: boolean;
  verifyUrl?: string;
  message: string;
};

export async function dispatchVerificationEmail(
  email: string,
  nickname: string,
  token: string
): Promise<SendVerificationResult> {
  const verifyUrl = getVerifyUrl(token);

  if (isSmtpConfigured()) {
    await sendVerificationEmail(email, nickname, verifyUrl);
    return {
      sent: true,
      message: "입력하신 이메일로 인증 링크를 발송했습니다. 메일함을 확인해 주세요.",
    };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[CompliAI] 이메일 인증 링크:", verifyUrl);
    return {
      sent: false,
      verifyUrl,
      message:
        "SMTP가 설정되지 않아 개발 모드로 동작합니다. 터미널 또는 아래 링크로 인증해 주세요.",
    };
  }

  throw new Error("이메일 발송 설정이 없습니다. 관리자에게 문의해 주세요.");
}

export function isTokenExpired(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > TOKEN_EXPIRY_MS;
}
