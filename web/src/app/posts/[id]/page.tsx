"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { getAuthorDisplayName } from "@/lib/author-display";
import { NegativeNuanceScore } from "@/components/negative-nuance-score";
import { Icon } from "@/components/icon";
import { PostReportButton } from "@/components/post-report-button";

type CommentAuthor = { id: string; displayId: string; email: string };

type CommentItem = {
  id: string;
  content: string;
  isBlinded: boolean;
  sarcasmScore: number;
  authorId: string;
  parentId: string | null;
  createdAt: string;
  author: CommentAuthor;
};

type PostDetail = {
  id: string;
  title: string;
  content: string;
  fileUrl: string | null;
  isBlinded: boolean;
  sarcasmScore: number;
  aggression: boolean;
  aiReport: Record<string, unknown> | null;
  authorId: string;
  createdAt: string;
  author: { id: string; displayId: string; email: string };
  target: { id: string; name: string };
  comments: CommentItem[];
  _count: { likes: number; reports: number };
};

type CommentThread = CommentItem & { replies: CommentItem[] };

function buildCommentThreads(comments: CommentItem[]): CommentThread[] {
  const roots = comments.filter((c) => !c.parentId);
  return roots.map((root) => ({
    ...root,
    replies: comments.filter((c) => c.parentId === root.id),
  }));
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);
  const [comment, setComment] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${id}`);
      if (!res.ok) throw new Error("조회 실패");
      return res.json() as Promise<{ post: PostDetail }>;
    },
  });

  const { data: likeData } = useQuery({
    queryKey: ["like", id],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${id}/like`);
      if (!res.ok) return { liked: false, count: 0 };
      return res.json() as Promise<{ liked: boolean; count: number }>;
    },
    enabled: !!session,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${id}/like`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["like", id] }),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string | null }) => {
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId: parentId ?? null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onMutate: async ({ content, parentId }) => {
      await queryClient.cancelQueries({ queryKey: ["post", id] });
      const prev = queryClient.getQueryData(["post", id]);
      queryClient.setQueryData(["post", id], (old: { post: PostDetail } | undefined) => {
        if (!old) return old;
        let resolvedParentId: string | null = null;
        if (parentId) {
          const parent = old.post.comments.find((c) => c.id === parentId);
          resolvedParentId = parent?.parentId ?? parentId;
        }
        return {
          post: {
            ...old.post,
            comments: [
              ...old.post.comments,
              {
                id: `temp-${Date.now()}`,
                content,
                isBlinded: false,
                sarcasmScore: 0,
                authorId: session?.user?.id ?? "",
                parentId: resolvedParentId,
                createdAt: new Date().toISOString(),
                author: {
                  id: session?.user?.id ?? "",
                  displayId: "pending",
                  email: session?.user?.email ?? "",
                },
              },
            ],
          },
        };
      });
      if (parentId) {
        setReplyContent("");
        setReplyToId(null);
      } else {
        setComment("");
      }
      return { prev };
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["post", id], ctx.prev);
      openModal(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
    },
    onSuccess: () => {
      const admin = session?.user?.role === UserRole.ADMIN;
      router.push(admin ? "/admin" : "/board");
    },
  });

  const threads = useMemo(
    () => (data ? buildCommentThreads(data.post.comments) : []),
    [data]
  );

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const post = data.post;
  const isOwner = session?.user?.id === post.authorId;
  const isAdmin = session?.user?.role === UserRole.ADMIN;
  const postAuthorName = getAuthorDisplayName(
    post.author,
    post.sarcasmScore,
    post._count.reports
  );

  const renderComment = (c: CommentItem, isReply = false) => {
    const commentAuthorName = getAuthorDisplayName(c.author, c.sarcasmScore);
    return (
      <div
        key={c.id}
        className={`bg-base-200 rounded-lg p-3 ${isReply ? "ml-4 sm:ml-8 border-l-2 border-base-300" : ""}`}
      >
        <p className="break-words">{c.content}</p>
        <div className="flex flex-wrap justify-between items-center gap-2 mt-1">
          <span className="text-xs text-base-content/50 font-mono">
            {commentAuthorName} · {new Date(c.createdAt).toLocaleString("ko-KR")}
          </span>
          <div className="flex gap-1">
            {session && (
              <button
                className="btn btn-xs btn-ghost gap-1"
                onClick={() => {
                  setReplyToId((prev) => (prev === c.id ? null : c.id));
                  setReplyContent("");
                }}
              >
                <Icon name="fa-solid fa-reply" />
                답글
              </button>
            )}
            {session?.user?.id === c.authorId && (
              <button
                className="btn btn-xs btn-ghost gap-1"
                onClick={async () => {
                  await fetch(`/api/comments/${c.id}`, { method: "DELETE" });
                  queryClient.invalidateQueries({ queryKey: ["post", id] });
                }}
              >
                <Icon name="fa-solid fa-trash" />
                삭제
              </button>
            )}
          </div>
        </div>
        {session && replyToId === c.id && (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (replyContent.trim()) {
                commentMutation.mutate({ content: replyContent, parentId: c.id });
              }
            }}
            className="flex flex-col sm:flex-row gap-2 mt-3"
          >
            <input
              className="input input-bordered input-sm w-full sm:flex-1"
              placeholder="답글을 입력해 주세요"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setReplyToId(null);
                  setReplyContent("");
                }}
              >
                취소
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={commentMutation.isPending}
              >
                등록
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <div className="flex gap-2 flex-wrap">
            <span className="badge badge-neutral">{post.target.name}님께</span>
            <NegativeNuanceScore score={post.sarcasmScore} size="md" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold break-words">{post.title}</h1>
          <p className="whitespace-pre-wrap break-words">{post.content}</p>
          {post.fileUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.fileUrl} alt="첨부 이미지" className="rounded-lg max-h-60 sm:max-h-80 w-full object-cover" />
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <span className="text-sm text-base-content/50 font-mono">
              {postAuthorName} · {new Date(post.createdAt).toLocaleString("ko-KR")}
            </span>
            <div className="flex flex-wrap gap-2">
              {session && (
                <button
                  className={`btn btn-sm gap-2 ${likeData?.liked ? "btn-neutral" : "btn-outline"}`}
                  onClick={() => likeMutation.mutate()}
                >
                  <Icon name={likeData?.liked ? "fa-solid fa-heart" : "fa-regular fa-heart"} />
                  {likeData?.count ?? post._count.likes}
                </button>
              )}
              <PostReportButton
                postId={post.id}
                authorId={post.authorId}
                reportCount={post._count.reports}
              />
              {isOwner && (
                <Link href={`/posts/${id}/edit`} className="btn btn-sm btn-outline gap-2">
                  <Icon name="fa-solid fa-pen" />
                  수정
                </Link>
              )}
              {(isOwner || isAdmin) && (
                <button className="btn btn-sm btn-outline gap-2" onClick={() => deleteMutation.mutate()}>
                  <Icon name="fa-solid fa-trash" />
                  {isAdmin && !isOwner ? "관리자 삭제" : "삭제"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-md border border-base-300">
          <div className="card-body">
            <h2 className="card-title gap-2">
              <Icon name="fa-solid fa-microchip" />
              AI 분석 리포트
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">부정적 뉘앙스</span>
                <NegativeNuanceScore score={post.sarcasmScore} />
              </div>
              <div>
                <span className="font-semibold">공격성:</span> {post.aggression ? "감지됨" : "없음"}
              </div>
            </div>
            {"reason" in (post.aiReport ?? {}) && (
              <p className="text-sm mt-2">{(post.aiReport as { reason?: string }).reason}</p>
            )}
            {"detected_irony" in (post.aiReport ?? {}) && (
              <div className="text-sm mt-3 space-y-1">
                <p>
                  <span className="font-semibold">모순·비아냥:</span>{" "}
                  {(post.aiReport as { detected_irony?: string }).detected_irony}
                </p>
                {"hidden_intent" in (post.aiReport ?? {}) && (
                  <p>
                    <span className="font-semibold">숨은 의도:</span>{" "}
                    {(post.aiReport as { hidden_intent?: string }).hidden_intent}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title">댓글 ({post.comments.length})</h2>
          {session && (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (comment.trim()) commentMutation.mutate({ content: comment });
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                className="input input-bordered w-full sm:flex-1"
                placeholder="따뜻한 응원 댓글을 남겨 주세요"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={commentMutation.isPending}>
                등록
              </button>
            </form>
          )}
          <div className="space-y-3 mt-4">
            {threads.map((thread) => (
              <div key={thread.id} className="space-y-2">
                {renderComment(thread)}
                {thread.replies.map((reply) => renderComment(reply, true))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link href="/board" className="btn btn-ghost gap-2">
        <Icon name="fa-solid fa-arrow-left" />
        목록으로
      </Link>
    </div>
  );
}
