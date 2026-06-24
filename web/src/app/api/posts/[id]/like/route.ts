import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: postId } = await params;

  const existing = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: session!.user.id } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    const count = await prisma.like.count({ where: { postId } });
    return NextResponse.json({ liked: false, count });
  }

  await prisma.like.create({
    data: { postId, userId: session!.user.id },
  });

  const count = await prisma.like.count({ where: { postId } });
  return NextResponse.json({ liked: true, count });
}

export async function GET(_request: Request, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: postId } = await params;

  const like = await prisma.like.findUnique({
    where: { postId_userId: { postId, userId: session!.user.id } },
  });
  const count = await prisma.like.count({ where: { postId } });

  return NextResponse.json({ liked: !!like, count });
}
