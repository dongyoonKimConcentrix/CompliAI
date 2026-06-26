import Link from "next/link";
import { Icon } from "@/components/icon";
import { getAuthorDisplayName } from "@/lib/author-display";
import { NegativeNuanceScore } from "@/components/negative-nuance-score";
import { PostReportButton } from "@/components/post-report-button";

type PostCardProps = {
  post: {
    id: string;
    title: string;
    content: string;
    targetName: string;
    sarcasmScore: number;
    authorId: string;
    createdAt: string;
    author: { nickname: string; email: string };
    _count: { likes: number; comments: number; reports: number };
  };
};

export function PostCard({ post }: PostCardProps) {
  const authorName = getAuthorDisplayName(post.author, post.sarcasmScore, post._count.reports);

  return (
    <div className="card bg-base-100 hover:shadow-apple-lg transition-shadow">
      <Link href={`/posts/${post.id}`} className="card-body">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge badge-neutral badge-outline">{post.targetName}님께</span>
          <NegativeNuanceScore score={post.sarcasmScore} />
        </div>
        <h2 className="card-title text-lg">{post.title}</h2>
        <p className="text-base-content/70 line-clamp-2">{post.content}</p>
        <div className="card-actions flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-2">
          <span className="text-sm text-base-content/50">
            {authorName} · {new Date(post.createdAt).toLocaleDateString("ko-KR")}
          </span>
          <div className="flex gap-4 text-sm text-base-content/60 shrink-0">
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
      <div className="px-6 pb-4 flex justify-end">
        <PostReportButton
          postId={post.id}
          authorId={post.authorId}
          reportCount={post._count.reports}
          size="xs"
        />
      </div>
    </div>
  );
}
