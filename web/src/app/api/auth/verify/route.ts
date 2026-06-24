import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { isTokenExpired } from "@/lib/verification";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(appUrl("/login?error=invalid_token", request));
  }

  const user = await prisma.user.findUnique({ where: { verificationToken: token } });

  if (!user) {
    return NextResponse.redirect(appUrl("/login?error=invalid_token", request));
  }

  if (isTokenExpired(user.createdAt)) {
    return NextResponse.redirect(appUrl("/login?error=expired_token", request));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      verificationToken: null,
    },
  });

  return NextResponse.redirect(appUrl("/login?verified=1", request));
}
