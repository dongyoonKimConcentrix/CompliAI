/**
 * 공개 접속 URL (이메일 링크, 인증 후 리다이렉트 등).
 * Docker 내부 request.url 은 0.0.0.0:3000 이므로 사용하지 않습니다.
 */
export function getAppBaseUrl(request?: Request): string {
  const envUrl = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (envUrl && isUsablePublicUrl(envUrl)) {
    return envUrl;
  }

  if (request) {
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host")?.trim();
    if (host && !host.startsWith("0.0.0.0")) {
      const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
      return `${proto}://${host}`;
    }
  }

  return envUrl || "http://localhost:3000";
}

function isUsablePublicUrl(url: string): boolean {
  if (url.includes("0.0.0.0")) return false;
  if (url === "http://localhost") return false;
  if (url === "http://localhost:3000") return false;
  return true;
}

export function appUrl(path: string, request?: Request): string {
  const base = getAppBaseUrl(request);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
