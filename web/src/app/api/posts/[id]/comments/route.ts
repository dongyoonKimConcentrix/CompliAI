import { ModerationStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { analyzeContent } from "@/lib/ai";
import { getSarcasmThreshold, needsModerationReview } from "@/lib/settings";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const comments = await prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, displayId: true, email: true } } },
  });

  return NextResponse.json({ comments });
}

export async function POST(request: Request, { params }: Params) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id: postId } = await params;
  const { content, parentId } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "댓글 내용을 입력해 주세요." }, { status: 400 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  let resolvedParentId: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.postId !== postId) {
      return NextResponse.json({ error: "부모 댓글을 찾을 수 없습니다." }, { status: 400 });
    }
    // 대댓글의 대댓글은 최상위 부모에 붙여 1단 깊이로 유지
    resolvedParentId = parent.parentId ?? parent.id;
  }

  let analysis;
  try {
    analysis = await analyzeContent(content, "comment");
  } catch {
    return NextResponse.json(
      { error: "AI 분석 서버에 연결할 수 없습니다." },
      { status: 503 }
    );
  }

  const threshold = await getSarcasmThreshold();
  const moderationStatus = needsModerationReview(
    analysis.sarcasm_score,
    analysis.aggression,
    threshold
  )
    ? ModerationStatus.PENDING
    : ModerationStatus.APPROVED;

  const comment = await prisma.comment.create({
    data: {
      content,
      postId,
      parentId: resolvedParentId,
      authorId: session!.user.id,
      sarcasmScore: analysis.sarcasm_score,
      aggression: analysis.aggression,
      isBlinded: false,
      moderationStatus,
      aiReport: analysis.ai_report as Prisma.InputJsonValue,
    },
    include: { author: { select: { id: true, displayId: true, email: true } } },
  });

  return NextResponse.json({ comment, analysis }, { status: 201 });
}
