"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { Icon } from "@/components/icon";
import { useUIStore } from "@/store/ui-store";
import { http } from "@/lib/http";

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
      try {
        const { data } = await http.get<{ reported: boolean; count: number }>(
          `/api/posts/${postId}/report`
        );
        return data;
      } catch {
        return { reported: false, count: reportCount };
      }
    },
    enabled: !!session && !isOwner,
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await http.post(`/api/posts/${postId}/report`);
      return data;
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
