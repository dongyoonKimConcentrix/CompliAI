"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Icon } from "@/components/icon";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const errorMessages: Record<string, string> = {
    invalid_token: "유효하지 않거나 이미 사용된 재설정 링크입니다. 비밀번호 찾기를 다시 시도해 주세요.",
    expired_token: "재설정 링크가 만료되었습니다. 비밀번호 찾기를 다시 시도해 주세요.",
    reset_failed: "비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(errorMessages[json.error as string] ?? json.error ?? errorMessages.reset_failed);
      return;
    }

    setDone(true);
  }

  if (!token) {
    return (
      <div className="card bg-base-100 shadow-lg max-w-md mx-auto w-full">
        <div className="card-body text-center space-y-4">
          <Icon name="fa-solid fa-link-slash text-4xl text-error" />
          <h1 className="text-xl font-bold">재설정 링크 오류</h1>
          <p className="text-base-content/60">{errorMessages.invalid_token}</p>
          <Link href="/forgot-password" className="btn btn-primary">
            비밀번호 찾기
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card bg-base-100 shadow-lg max-w-md mx-auto w-full">
        <div className="card-body text-center space-y-4">
          <Icon name="fa-solid fa-circle-check text-4xl text-success" />
          <h1 className="text-xl font-bold">비밀번호 변경 완료</h1>
          <p className="text-base-content/60">새 비밀번호로 로그인해 주세요.</p>
          <Link href="/login" className="btn btn-primary">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-lg max-w-md mx-auto w-full">
      <div className="card-body space-y-4">
        <h1 className="card-title text-2xl justify-center gap-2">
          <Icon name="fa-solid fa-key" />
          새 비밀번호 설정
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            className="input input-bordered w-full"
            placeholder="새 비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            className="input input-bordered w-full"
            placeholder="새 비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="text-base-content text-sm">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <span className="loading loading-spinner" /> : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<span className="loading loading-spinner loading-lg mx-auto block" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
