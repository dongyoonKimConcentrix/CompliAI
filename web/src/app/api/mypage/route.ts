import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const [posts, comments] = await Promise.all([
    prisma.post.findMany({
      where: { authorId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { likes: true, comments: true } } },
    }),
    prisma.comment.findMany({
      where: { authorId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { post: { select: { id: true, title: true } } },
    }),
  ]);

  return NextResponse.json({ posts, comments });
}
