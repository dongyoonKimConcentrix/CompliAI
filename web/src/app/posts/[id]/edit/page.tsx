"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { PraiseTargetSelect } from "@/components/praise-target-select";
import { useUIStore } from "@/store/ui-store";

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const openModal = useUIStore((s) => s.openModal);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetName, setTargetName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${id}`);
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.post) {
      setTitle(data.post.title);
      setContent(data.post.content);
      setTargetUserId(data.post.target.id);
      setTargetName(data.post.target.name);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, targetUserId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => router.push(`/posts/${id}`),
    onError: (err: Error) => openModal(err.message),
  });

  if (isLoading) return <span className="loading loading-spinner loading-lg" />;

  return (
    <div className="card bg-base-100 shadow-lg max-w-2xl mx-auto w-full">
      <div className="card-body">
        <h1 className="card-title text-2xl">칭찬 글 수정</h1>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!targetUserId) {
              openModal("칭찬 대상을 선택해 주세요.");
              return;
            }
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <PraiseTargetSelect
            value={targetUserId}
            initialLabel={targetName}
            onChange={(userId, name) => {
              setTargetUserId(userId);
              setTargetName(name);
            }}
          />
          <input className="input input-bordered w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea className="textarea textarea-bordered w-full h-32" value={content} onChange={(e) => setContent(e.target.value)} required />
          <button type="submit" className="btn btn-primary w-full" disabled={mutation.isPending || !targetUserId}>
            {mutation.isPending ? <span className="loading loading-spinner" /> : "수정 완료"}
          </button>
        </form>
      </div>
    </div>
  );
}
