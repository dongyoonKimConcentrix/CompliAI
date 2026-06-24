import { ModerationStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { analyzeContent } from "@/lib/ai";
import { getSarcasmThreshold, needsModerationReview } from "@/lib/settings";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const q = searchParams.get("q")?.trim();

  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { content: { contains: q, mode: "insensitive" as const } },
          { targetName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const posts = await prisma.post.findMany({
    where,
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { nickname: true, email: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  let nextCursor: string | null = null;
  if (posts.length > PAGE_SIZE) {
    const next = posts.pop();
    nextCursor = next?.id ?? null;
  }

  return NextResponse.json({ posts, nextCursor });
}

export async function POST(request: Request) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const { title, content, targetName, fileUrl } = await request.json();

    if (!title || !content || !targetName) {
      return NextResponse.json({ error: "필수 항목을 입력해 주세요." }, { status: 400 });
    }

    const text = `${title}\n${content}`;
    let analysis;
    try {
      analysis = await analyzeContent(text, "post");
    } catch (err) {
      console.error("[CompliAI] AI 분석 실패:", err);
      return NextResponse.json(
        { error: "AI 분석 서버에 연결할 수 없습니다. FastAPI(api) 서버가 실행 중인지 확인해 주세요." },
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

    const post = await prisma.post.create({
      data: {
        title,
        content,
        targetName,
        fileUrl: fileUrl || null,
        authorId: session!.user.id,
        sarcasmScore: analysis.sarcasm_score,
        aggression: analysis.aggression,
        isBlinded: false,
        moderationStatus,
        aiReport: analysis.ai_report as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ post, analysis }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "게시글 작성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
