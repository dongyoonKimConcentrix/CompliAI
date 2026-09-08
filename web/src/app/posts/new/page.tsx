"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PraiseTargetSelect } from "@/components/praise-target-select";
import { useUIStore } from "@/store/ui-store";
import { http } from "@/lib/http";

export default function NewPostPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      content: string;
      targetUserId: string;
      fileUrl: string | null;
    }) => {
      const { data } = await http.post("/api/posts", payload);
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const previous = queryClient.getQueryData(["posts"]);
      return { previous };
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
    try {
      const { data: json } = await http.post<{ url: string }>("/api/upload", formData);
      setFileUrl(json.url);
    } catch (err) {
      openModal(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!targetUserId) {
      openModal("칭찬 대상을 선택해 주세요.");
      return;
    }
    mutation.mutate({ title, content, targetUserId, fileUrl });
  }

  return (
    <div className="card bg-base-100 shadow-lg max-w-2xl mx-auto w-full">
      <div className="card-body">
        <h1 className="card-title text-2xl">칭찬 글 작성</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PraiseTargetSelect
            value={targetUserId}
            onChange={(userId, name) => {
              setTargetUserId(userId);
              setTargetName(name);
            }}
          />
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
          <button type="submit" className="btn btn-primary w-full" disabled={mutation.isPending || uploading || !targetUserId}>
            {mutation.isPending ? <span className="loading loading-spinner" /> : "칭찬 등록"}
          </button>
          {targetName && (
            <p className="text-xs text-center text-base-content/50">{targetName}님께 칭찬을 남깁니다.</p>
          )}
        </form>
      </div>
    </div>
  );
}
