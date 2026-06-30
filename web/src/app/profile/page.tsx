"use client";

import { useQuery } from "@tanstack/react-query";
import { DeleteAccountSection } from "@/components/delete-account-section";

export default function ProfilePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("조회 실패");
      return res.json();
    },
  });

  if (isLoading) return <span className="loading loading-spinner loading-lg" />;

  const user = data?.user;

  return (
    <div className="card bg-base-100 shadow-lg max-w-md mx-auto w-full">
      <div className="card-body">
        <h1 className="card-title text-2xl">프로필</h1>
        <div className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text">이름</span></label>
            <input className="input input-bordered" value={user?.name ?? ""} disabled />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">게시판 표시 ID</span></label>
            <input className="input input-bordered font-mono" value={user?.displayId ?? ""} disabled />
            <p className="text-xs text-base-content/50 mt-1">
              게시글·댓글에 표시되는 익명 ID입니다.
            </p>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">이메일</span></label>
            <input className="input input-bordered" value={user?.email ?? ""} disabled />
          </div>
        </div>

        <div className="divider my-2" />
        <DeleteAccountSection />
      </div>
    </div>
  );
}
