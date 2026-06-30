import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function findValidPraiseTarget(targetUserId: string, authorId: string) {
  if (targetUserId === authorId) {
    return { target: null, error: "본인에게는 칭찬할 수 없습니다." };
  }

  const target = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      role: UserRole.USER,
      emailVerified: { not: null },
      name: { not: "" },
    },
    select: { id: true, name: true },
  });

  if (!target) {
    return { target: null, error: "유효하지 않은 칭찬 대상입니다." };
  }

  return { target, error: null };
}
