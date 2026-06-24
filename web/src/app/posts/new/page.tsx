"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useUIStore } from "@/store/ui-store";

export default function NewPostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetName, setTargetName] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: { title: string; content: string; targetName: string; fileUrl: string | null }) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "작성 실패");
      return json;
    },
    onMutate: async (newPost) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const previous = queryClient.getQueryData(["posts"]);
      queryClient.setQueryData(["posts"], (old: unknown) => old);
      return { previous, optimistic: newPost };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      router.push(`/posts/${data.post.id}`);
    },
    onError: (err: Error) => {
      openModal(err.message);
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();
    setUploading(false);
    if (res.ok) setFileUrl(json.url);
    else openModal(json.error || "업로드 실패");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ title, content, targetName, fileUrl });
  }

  return (
    <div className="card bg-base-100 shadow-lg max-w-2xl mx-auto">
      <div className="card-body">
        <h1 className="card-title text-2xl">칭찬 글 작성</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text">칭찬 대상</span></label>
            <input className="input input-bordered" value={targetName} onChange={(e) => setTargetName(e.target.value)} required placeholder="팀원 이름" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">제목</span></label>
            <input className="input input-bordered" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="칭찬 제목" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">내용</span></label>
            <textarea className="textarea textarea-bordered h-32" value={content} onChange={(e) => setContent(e.target.value)} required placeholder="진심 어린 칭찬을 작성해 주세요" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">이미지 첨부 (선택)</span></label>
            <input type="file" className="file-input file-input-bordered" accept="image/*" onChange={handleFileChange} disabled={uploading} />
            {fileUrl && <p className="text-sm text-base-content/70 mt-1">업로드 완료: {fileUrl}</p>}
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={mutation.isPending || uploading}>
            {mutation.isPending ? <span className="loading loading-spinner" /> : "칭찬 등록"}
          </button>
        </form>
      </div>
    </div>
  );
}
