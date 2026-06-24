const ALLOWED_EMAIL_DOMAIN = "@concentrix.com";

export function isAllowedCompanyEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

export const ALLOWED_EMAIL_ERROR =
  "Concentrix 사내 이메일(@concentrix.com)만 가입할 수 있습니다.";
