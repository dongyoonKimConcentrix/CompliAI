"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ALLOWED_EMAIL_ERROR, isAllowedCompanyEmail } from "@/lib/email-policy";
import { http } from "@/lib/http";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setResetUrl("");

    if (!isAllowedCompanyEmail(email)) {
      setError(ALLOWED_EMAIL_ERROR);
      setLoading(false);
      return;
    }

    try {
      const { data: json } = await http.post<{ message: string; resetUrl?: string }>(
        "/api/auth/forgot-password",
        { email }
      );
      setLoading(false);
      setMessage(json.message);
      if (json.resetUrl) {
        setResetUrl(json.resetUrl);
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
    }
  }

  return (
    <div className="card bg-base-100 shadow-lg max-w-md mx-auto w-full">
      <div className="card-body">
        <h1 className="card-title text-2xl justify-center">비밀번호 찾기</h1>
        <p className="text-sm text-base-content/60 text-center">
          가입한 사내 이메일로 비밀번호 재설정 링크를 보내 드립니다.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            className="input input-bordered w-full"
            placeholder="name@concentrix.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="text-base-content text-sm">{error}</p>}
          {message && (
            <div className="alert alert-neutral text-sm">
              <div>
                <p>{message}</p>
                {resetUrl && (
                  <p className="mt-2 break-all">
                    <span className="font-semibold">개발용 재설정 링크:</span>{" "}
                    <a href={resetUrl} className="link">{resetUrl}</a>
                  </p>
                )}
              </div>
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <span className="loading loading-spinner" /> : "재설정 링크 받기"}
          </button>
        </form>
        <p className="text-center text-sm">
          <Link href="/login" className="link link-neutral">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
