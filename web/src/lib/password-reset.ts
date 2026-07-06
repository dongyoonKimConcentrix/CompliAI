import { getAppBaseUrl } from "@/lib/app-url";
import { sendPasswordResetEmail, isSmtpConfigured } from "@/lib/mail";
import { createVerificationToken } from "@/lib/verification";

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

export function createPasswordResetToken(): string {
  return createVerificationToken();
}

export function getPasswordResetUrl(token: string): string {
  return `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

export function getPasswordResetExpiry(): Date {
  return new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
}

export function isPasswordResetTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return Date.now() > expiresAt.getTime();
}

export type SendPasswordResetResult = {
  sent: boolean;
  resetUrl?: string;
  message: string;
};

export async function dispatchPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<SendPasswordResetResult> {
  const resetUrl = getPasswordResetUrl(token);

  if (isSmtpConfigured()) {
    void sendPasswordResetEmail(email, name, resetUrl).catch((err) => {
      console.error("[CompliAI] 비밀번호 재설정 메일 발송 실패:", email, err);
    });
    return {
      sent: true,
      message:
        "입력하신 이메일로 비밀번호 재설정 링크를 발송 중입니다. 수신까지 1~2분 걸릴 수 있습니다.",
    };
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[CompliAI] 비밀번호 재설정 링크:", resetUrl);
    return {
      sent: false,
      resetUrl,
      message:
        "SMTP가 설정되지 않아 개발 모드로 동작합니다. 터미널 또는 아래 링크로 재설정해 주세요.",
    };
  }

  throw new Error("이메일 발송 설정이 없습니다. 관리자에게 문의해 주세요.");
}
