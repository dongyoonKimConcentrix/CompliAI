import type { Metadata, Viewport } from "next";
import { getServerSession } from "next-auth";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./globals.css";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { GlobalModal } from "@/components/global-modal";
import { ThemeWrapper } from "@/components/theme-wrapper";

export const metadata: Metadata = {
  title: "CompliAI — AI 칭찬 플랫폼",
  description: "사내 직원 간 따뜻한 칭찬 문화를 AI로 보호하는 플랫폼",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="ko" data-theme="apple">
      <body className="font-sans antialiased bg-base-200 text-base-content">
        <Providers session={session}>
          <ThemeWrapper>
            <Navbar />
            <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl w-full">{children}</main>
            <GlobalModal />
          </ThemeWrapper>
        </Providers>
      </body>
    </html>
  );
}
