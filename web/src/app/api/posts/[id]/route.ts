import { ModerationStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canDeletePost, requireAuth } from "@/lib/api-auth";
import { analyzeContent } from "@/lib/ai";
import { getSarcasmThreshold, needsModerationReview } from "@/lib/settings";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, nickname: true, email: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, nickname: true, email: true } } },
      },
      _count: { select: { likes: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PUT(request: Request, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });

  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (post.authorId !== session!.user.id) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const { title, content, targetName, fileUrl } = await request.json();

  const analysis = await analyzeContent(`${title}\n${content}`, "post", id);
  const threshold = await getSarcasmThreshold();
  const moderationStatus = needsModerationReview(
    analysis.sarcasm_score,
    analysis.aggression,
    threshold
  )
    ? ModerationStatus.PENDING
    : ModerationStatus.APPROVED;

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title,
      content,
      targetName,
      fileUrl: fileUrl ?? post.fileUrl,
      sarcasmScore: analysis.sarcasm_score,
      aggression: analysis.aggression,
      isBlinded: false,
      moderationStatus,
      adminReviewedAt: moderationStatus === ModerationStatus.APPROVED ? post.adminReviewedAt : null,
      adminReviewedBy: moderationStatus === ModerationStatus.APPROVED ? post.adminReviewedBy : null,
      aiReport: analysis.ai_report as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ post: updated, analysis });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });

  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  if (!canDeletePost(session!, post.authorId)) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ message: "삭제되었습니다." });
}
