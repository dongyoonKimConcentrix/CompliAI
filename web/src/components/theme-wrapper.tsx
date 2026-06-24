"use client";

import { ReactNode, useEffect } from "react";
import { useUIStore } from "@/store/ui-store";

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}
