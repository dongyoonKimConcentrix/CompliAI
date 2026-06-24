"use client";

import { useMutation } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { FormEvent, useState } from "react";
import { Icon } from "@/components/icon";
import { useUIStore } from "@/store/ui-store";

export function DeleteAccountSection() {
  const openModal = useUIStore((s) => s.openModal);
  const [password, setPassword] = useState("");
  const [showForm, setShowForm] = useState(false);

  const deleteAccount = useMutation({
    mutationFn: async (body: { password: string }) => {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: async () => {
      await signOut({ callbackUrl: "/" });
    },
    onError: (err: Error) => openModal(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      openModal("비밀번호를 입력해 주세요.");
      return;
    }
    if (
      !window.confirm(
        "정말 탈퇴하시겠습니까?\n작성한 칭찬 글·댓글·좋아요가 모두 삭제되며 복구할 수 없습니다."
      )
    ) {
      return;
    }
    deleteAccount.mutate({ password });
  }

  return (
    <section className="border border-error/30 rounded-xl p-4 space-y-3">
      <h2 className="text-lg font-semibold text-error flex items-center gap-2">
        <Icon name="fa-solid fa-user-xmark" />
        회원 탈퇴
      </h2>
      <p className="text-sm text-base-content/60">
        탈퇴 시 계정과 작성한 칭찬 글·댓글·좋아요가 영구 삭제됩니다.
      </p>
      {!showForm ? (
        <button
          type="button"
          className="btn btn-outline btn-error btn-sm"
          onClick={() => setShowForm(true)}
        >
          회원 탈퇴
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text">비밀번호 확인</span>
            </label>
            <input
              type="password"
              className="input input-bordered input-sm"
              placeholder="현재 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn btn-error btn-sm"
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "탈퇴하기"
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={deleteAccount.isPending}
              onClick={() => {
                setShowForm(false);
                setPassword("");
              }}
            >
              취소
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
