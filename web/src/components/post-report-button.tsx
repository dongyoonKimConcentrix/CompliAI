"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/icon";
import { useUIStore } from "@/store/ui-store";

type PostReportButtonProps = {
  postId: string;
  authorId: string;
  reportCount?: number;
  size?: "sm" | "xs";
};

export function PostReportButton({
  postId,
  authorId,
  reportCount = 0,
  size = "sm",
}: PostReportButtonProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);
  const isOwner = session?.user?.id === authorId;

  const { data: reportData } = useQuery({
    queryKey: ["report", postId],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${postId}/report`);
      if (!res.ok) return { reported: false, count: reportCount };
      return res.json() as Promise<{ reported: boolean; count: number }>;
    },
    enabled: !!session && !isOwner,
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${postId}/report`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "신고에 실패했습니다.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report", postId] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err: Error) => openModal(err.message),
  });

  if (!session || isOwner) return null;

  const count = reportData?.count ?? reportCount;
  const reported = reportData?.reported ?? false;

  return (
    <button
      type="button"
      className={`btn btn-${size} gap-2 ${reported ? "btn-error btn-outline" : "btn-ghost"}`}
      disabled={reported || reportMutation.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!reported && window.confirm("이 게시글을 신고하시겠습니까?")) {
          reportMutation.mutate();
        }
      }}
    >
      <Icon name={reported ? "fa-solid fa-flag" : "fa-regular fa-flag"} />
      {reported ? "신고됨" : "신고"}
      {count > 0 ? ` (${count})` : ""}
    </button>
  );
}
