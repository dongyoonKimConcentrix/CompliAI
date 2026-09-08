import { cookies } from "next/headers";
import { TOKEN_COOKIE, type Session, type SessionUser } from "@/lib/types";

function apiOrigin() {
  return (process.env.FASTAPI_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function getServerSession(): Promise<Session | null> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${apiOrigin()}/api/auth/session`, {
      headers: { cookie: `${TOKEN_COOKIE}=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { user?: SessionUser | null };
    if (!json?.user?.id) return null;
    return { user: json.user };
  } catch {
    return null;
  }
}
