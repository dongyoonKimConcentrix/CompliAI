"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@/lib/types";
import { http } from "@/lib/http";

type Status = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  data: Session | null;
  status: Status;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  data: null,
  status: "loading",
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const refresh = useCallback(async () => {
    try {
      const { data: json } = await http.get<{ user?: Session["user"] | null }>("/api/auth/session");
      if (json?.user?.id) {
        setData({ user: json.user });
        setStatus("authenticated");
      } else {
        setData(null);
        setStatus("unauthenticated");
      }
    } catch {
      setData(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <AuthContext.Provider value={{ data, status, refresh }}>{children}</AuthContext.Provider>;
}

export function useSession() {
  return useContext(AuthContext);
}

export async function signOut(options?: { callbackUrl?: string }) {
  await http.post("/api/auth/logout");
  window.location.href = options?.callbackUrl || "/";
}
