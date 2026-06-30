"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useUIStore } from "@/store/ui-store";
import { getAuthorDisplayName } from "@/lib/author-display";
import { NegativeNuanceScore } from "@/components/negative-nuance-score";
import { Icon } from "@/components/icon";
import { PostReportButton } from "@/components/post-report-button";

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
  comments: {
    id: string;
    content: string;
    isBlinded: boolean;
    sarcasmScore: number;
    authorId: string;
    createdAt: string;
    author: { id: string; displayId: string; email: string };
  }[];
  _count: { likes: number; reports: number };
};

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);
  const [comment, setComment] = useState("");

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
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ["post", id] });
      const prev = queryClient.getQueryData(["post", id]);
      queryClient.setQueryData(["post", id], (old: { post: PostDetail } | undefined) => {
        if (!old) return old;
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
      setComment("");
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
                if (comment.trim()) commentMutation.mutate(comment);
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
            {post.comments.map((c) => {
              const commentAuthorName = getAuthorDisplayName(c.author, c.sarcasmScore);
              return (
              <div key={c.id} className="bg-base-200 rounded-lg p-3">
                <p>{c.content}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-base-content/50 font-mono">
                    {commentAuthorName} · {new Date(c.createdAt).toLocaleString("ko-KR")}
                  </span>
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
            );
            })}
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
