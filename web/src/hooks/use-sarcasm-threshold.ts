"use client";

import { useQuery } from "@tanstack/react-query";
import { SARCASM_THRESHOLD } from "@/lib/ai";

export function useSarcasmThreshold() {
  const { data } = useQuery({
    queryKey: ["threshold"],
    queryFn: async () => {
      const res = await fetch("/api/settings/threshold");
      if (!res.ok) return { threshold: SARCASM_THRESHOLD };
      return res.json() as Promise<{ threshold: number }>;
    },
    staleTime: 60_000,
  });

  return data?.threshold ?? SARCASM_THRESHOLD;
}
