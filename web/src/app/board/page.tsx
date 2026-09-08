"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { PostCard } from "@/components/post-card";
import { Icon } from "@/components/icon";
import { http } from "@/lib/http";

type Post = {
  id: string;
  title: string;
  content: string;
  isBlinded: boolean;
  sarcasmScore: number;
  authorId: string;
  createdAt: string;
  author: { displayId: string; email: string };
  target: { id: string; name: string };
  _count: { likes: number; comments: number; reports: number };
};

async function fetchPosts({ pageParam, query }: { pageParam?: string; query: string }) {
  const { data } = await http.get<{ posts: Post[]; nextCursor: string | null }>("/api/posts", {
    params: { cursor: pageParam, q: query || undefined },
  });
  return data;
}

export default function BoardPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["posts", query],
    queryFn: ({ pageParam }) => fetchPosts({ pageParam, query }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">칭찬 게시판</h1>
        <form
          className="flex flex-col sm:flex-row sm:join w-full sm:w-auto gap-2 sm:gap-0"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
        >
          <input
            className="input input-bordered w-full sm:w-64 sm:join-item"
            placeholder="제목, 본문, 대상 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-primary sm:join-item gap-2 w-full sm:w-auto">
            <Icon name="fa-solid fa-magnifying-glass" />
            검색
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : posts.length === 0 ? (
        <div className="alert alert-neutral">
          <span>아직 칭찬 글이 없습니다. 첫 번째 칭찬을 남겨 보세요!</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="text-center">
          <button
            className="btn btn-outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <span className="loading loading-spinner" />
            ) : (
              "더 보기"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
