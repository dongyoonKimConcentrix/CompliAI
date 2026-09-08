import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { TOKEN_COOKIE, type Session } from "@/lib/types";

function secret() {
  const value = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) return null;
  return new TextEncoder().encode(value);
}

export async function getServerSession(): Promise<Session | null> {
  const key = secret();
  if (!key) return null;
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    const id = typeof payload.sub === "string" ? payload.sub : "";
    if (!id) return null;
    return {
      user: {
        id,
        email: typeof payload.email === "string" ? payload.email : null,
        name: typeof payload.name === "string" ? payload.name : null,
        role: payload.role === "ADMIN" ? "ADMIN" : "USER",
      },
    };
  } catch {
    return null;
  }
}
