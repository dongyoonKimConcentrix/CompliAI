import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: postId } = await params;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  if (post.authorId === session!.user.id) {
    return NextResponse.json({ error: "본인 게시글은 신고할 수 없습니다." }, { status: 400 });
  }

  const existing = await prisma.report.findUnique({
    where: { postId_userId: { postId, userId: session!.user.id } },
  });

  if (existing) {
    return NextResponse.json({ error: "이미 신고한 게시글입니다." }, { status: 409 });
  }

  await prisma.report.create({
    data: { postId, userId: session!.user.id },
  });

  const count = await prisma.report.count({ where: { postId } });
  return NextResponse.json({ reported: true, count });
}

export async function GET(_request: Request, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: postId } = await params;

  const report = await prisma.report.findUnique({
    where: { postId_userId: { postId, userId: session!.user.id } },
  });
  const count = await prisma.report.count({ where: { postId } });

  return NextResponse.json({ reported: !!report, count });
}
