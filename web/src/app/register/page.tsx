"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ALLOWED_EMAIL_ERROR, isAllowedCompanyEmail } from "@/lib/email-policy";
import { http } from "@/lib/http";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (!isAllowedCompanyEmail(email)) {
      setError(ALLOWED_EMAIL_ERROR);
      setLoading(false);
      return;
    }

    try {
      const { data: json } = await http.post<{ message: string; verifyUrl?: string }>(
        "/api/auth/register",
        { email, password, name }
      );
      setLoading(false);
      setMessage(json.message);
      if (json.verifyUrl) {
        setVerifyUrl(json.verifyUrl);
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "회원가입에 실패했습니다.");
    }
  }

  return (
    <div className="card bg-base-100 shadow-lg max-w-md mx-auto w-full">
      <div className="card-body">
        <h1 className="card-title text-2xl justify-center">회원가입</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text">이름</span></label>
            <input
              className="input input-bordered w-full"
              placeholder="홍길동 (칭찬 대상·랭킹에 사용)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <input type="email" className="input input-bordered w-full" placeholder="name@concentrix.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" className="input input-bordered w-full" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="text-base-content text-sm">{error}</p>}
          {message && (
            <div className="alert alert-neutral text-sm">
              <div>
                <p>{message}</p>
                {verifyUrl && (
                  <p className="mt-2 break-all">
                    <span className="font-semibold">개발용 인증 링크:</span>{" "}
                    <a href={verifyUrl} className="link">{verifyUrl}</a>
                  </p>
                )}
                {!verifyUrl && (
                  <p className="mt-2 text-base-content/70">
                    메일이 보이지 않으면 스팸함을 확인해 주세요.
                  </p>
                )}
              </div>
            </div>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <span className="loading loading-spinner" /> : "가입하기"}
          </button>
        </form>
        <p className="text-center text-sm">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="link link-neutral">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
