"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { http } from "@/lib/http";

export default function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["mypage"],
    queryFn: async () => {
      const { data } = await http.get("/api/mypage");
      return data;
    },
  });

  if (isLoading) return <span className="loading loading-spinner loading-lg" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold">마이페이지</h1>

      <section>
        <h2 className="text-xl font-semibold mb-4">내가 쓴 칭찬 글</h2>
        {data?.posts?.length === 0 ? (
          <p className="text-base-content/60">작성한 글이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {data?.posts?.map((post: { id: string; title: string; target: { name: string }; _count: { likes: number; comments: number } }) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="block card bg-base-100 hover:shadow-apple transition-shadow">
                <div className="card-body py-4">
                  <span className="badge badge-sm badge-neutral badge-outline w-fit">{post.target.name}님께</span>
                  <h3 className="font-medium">{post.title}</h3>
                  <div className="text-sm text-base-content/50 flex gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="fa-regular fa-heart" />
                      {post._count.likes}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="fa-regular fa-comment" />
                      {post._count.comments}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">내가 쓴 댓글</h2>
        {data?.comments?.length === 0 ? (
          <p className="text-base-content/60">작성한 댓글이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {data?.comments?.map((c: { id: string; content: string; post: { id: string; title: string } }) => (
              <Link key={c.id} href={`/posts/${c.post.id}`} className="block card bg-base-100 hover:shadow-apple transition-shadow">
                <div className="card-body py-4">
                  <p className="text-sm text-base-content/50">게시글: {c.post.title}</p>
                  <p>{c.content}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <DeleteAccountSection />
    </div>
  );
}
