"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { useUIStore } from "@/store/ui-store";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (body: { nickname: string; name?: string; profileImage?: string }) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      openModal("프로필이 업데이트되었습니다.");
    },
    onError: (err: Error) => openModal(err.message),
  });

  if (isLoading) return <span className="loading loading-spinner loading-lg" />;

  const user = data?.user;
  const canSetName = !user?.name;

  return (
    <div className="card bg-base-100 shadow-lg max-w-md mx-auto">
      <div className="card-body">
        <h1 className="card-title text-2xl">프로필 설정</h1>
        <p className="text-sm text-base-content/60">{user?.email}</p>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mutation.mutate({
              nickname: nickname || user?.nickname,
              ...(canSetName && name ? { name } : {}),
            });
          }}
          className="space-y-4"
        >
          <div className="form-control">
            <label className="label">
              <span className="label-text">이름</span>
              {!canSetName && (
                <span className="label-text-alt text-base-content/50">변경 불가</span>
              )}
            </label>
            <input
              className="input input-bordered"
              defaultValue={user?.name}
              placeholder={canSetName ? "홍길동" : undefined}
              disabled={!canSetName}
              onChange={(e) => setName(e.target.value)}
            />
            {canSetName && (
              <p className="text-xs text-base-content/50 mt-1">
                칭찬 랭킹 집계 및 자기 칭찬 제외에 사용됩니다. 한 번만 설정할 수 있습니다.
              </p>
            )}
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">닉네임</span></label>
            <input
              className="input input-bordered"
              defaultValue={user?.nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={mutation.isPending}>
            저장
          </button>
        </form>

        <div className="divider my-2" />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
