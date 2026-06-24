import { ModerationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "PENDING") as ModerationStatus;

  const [posts, comments] = await Promise.all([
    prisma.post.findMany({
      where: { moderationStatus: status },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: { id: true, nickname: true, email: true, name: true } },
      },
    }),
    prisma.comment.findMany({
      where: { moderationStatus: status },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: { id: true, nickname: true, email: true, name: true } },
        post: { select: { id: true, title: true } },
      },
    }),
  ]);

  const items = [
    ...posts.map((post) => ({
      type: "post" as const,
      id: post.id,
      title: post.title,
      content: post.content,
      targetName: post.targetName,
      sarcasmScore: post.sarcasmScore,
      aggression: post.aggression,
      aiReport: post.aiReport,
      moderationStatus: post.moderationStatus,
      createdAt: post.createdAt.toISOString(),
      author: post.author,
      postTitle: null,
      postId: null,
    })),
    ...comments.map((comment) => ({
      type: "comment" as const,
      id: comment.id,
      title: null,
      content: comment.content,
      targetName: null,
      sarcasmScore: comment.sarcasmScore,
      aggression: comment.aggression,
      aiReport: comment.aiReport,
      moderationStatus: comment.moderationStatus,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
      postTitle: comment.post.title,
      postId: comment.post.id,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingCount = await Promise.all([
    prisma.post.count({ where: { moderationStatus: ModerationStatus.PENDING } }),
    prisma.comment.count({ where: { moderationStatus: ModerationStatus.PENDING } }),
  ]);

  return NextResponse.json({
    items,
    pendingCount: pendingCount[0] + pendingCount[1],
  });
}

export async function PATCH(request: Request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { type, id, action } = await request.json();

  if (!id || !["post", "comment"].includes(type) || !["approve", "delete"].includes(action)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const now = new Date();
  const adminId = session!.user.id;

  if (action === "delete") {
    if (type === "post") {
      await prisma.post.delete({ where: { id } });
    } else {
      await prisma.comment.delete({ where: { id } });
    }
    return NextResponse.json({ message: "삭제되었습니다." });
  }

  const data = {
    moderationStatus: ModerationStatus.APPROVED,
    adminReviewedAt: now,
    adminReviewedBy: adminId,
  };

  if (type === "post") {
    await prisma.post.update({ where: { id }, data });
  } else {
    await prisma.comment.update({ where: { id }, data });
  }

  return NextResponse.json({ message: "검토 완료(승인) 처리되었습니다." });
}
