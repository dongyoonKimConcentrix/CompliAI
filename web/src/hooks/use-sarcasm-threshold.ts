"use client";

import { useQuery } from "@tanstack/react-query";
import { SARCASM_THRESHOLD } from "@/lib/ai";
import { http } from "@/lib/http";

export function useSarcasmThreshold() {
  const { data } = useQuery({
    queryKey: ["threshold"],
    queryFn: async () => {
      try {
        const { data } = await http.get<{ threshold: number }>("/api/settings/threshold");
        return data;
      } catch {
        return { threshold: SARCASM_THRESHOLD };
      }
    },
    staleTime: 60_000,
  });

  return data?.threshold ?? SARCASM_THRESHOLD;
}
