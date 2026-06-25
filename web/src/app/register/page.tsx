"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ALLOWED_EMAIL_ERROR, isAllowedCompanyEmail } from "@/lib/email-policy";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
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

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, nickname }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error);
      return;
    }

    setMessage(json.message);
    if (json.verifyUrl) {
      setVerifyUrl(json.verifyUrl);
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
              placeholder="홍길동 (칭찬 대상 매칭·자기 칭찬 제외용)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">닉네임</span></label>
            <input
              className="input input-bordered w-full"
              placeholder="게시판에 표시될 닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
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
