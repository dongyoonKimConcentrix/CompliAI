"use client";

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResend, setShowResend] = useState(false);

  const verified = searchParams.get("verified");
  const urlError = searchParams.get("error");

  const urlErrorMessage =
    urlError === "invalid_token"
      ? "유효하지 않거나 이미 사용된 인증 링크입니다. 로그인 화면에서 인증 메일을 다시 요청해 주세요."
      : urlError === "expired_token"
        ? "인증 링크가 만료되었습니다. 인증 메일을 다시 요청해 주세요."
        : "";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    setShowResend(false);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "EMAIL_NOT_VERIFIED") {
        setError("이메일 인증이 완료되지 않았습니다. 메일함을 확인하거나 인증 메일을 재발송해 주세요.");
        setShowResend(true);
      } else {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      }
    } else {
      const session = await getSession();
      const callbackUrl = searchParams.get("callbackUrl");
      const isAdmin = session?.user?.role === UserRole.ADMIN;

      let destination = "/board";
      if (isAdmin) {
        destination =
          callbackUrl && callbackUrl.startsWith("/admin") ? callbackUrl : "/admin";
      } else if (callbackUrl && callbackUrl.startsWith("/")) {
        destination = callbackUrl;
      }

      window.location.href = destination;
    }
  }

  async function handleResend() {
    if (!email || !password) {
      setError("인증 메일 재발송을 위해 이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    setResending(true);
    setError("");
    setInfo("");

    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    setResending(false);

    if (!res.ok) {
      setError(json.error || "인증 메일 재발송에 실패했습니다.");
      return;
    }

    setInfo(json.message);
    if (json.verifyUrl) {
      setInfo(`${json.message} (개발용 링크: ${json.verifyUrl})`);
    }
  }

  return (
    <div className="card bg-base-100 shadow-lg max-w-md mx-auto w-full">
      <div className="card-body">
        <h1 className="card-title text-2xl justify-center">로그인</h1>
        {verified && (
          <div className="alert alert-neutral text-sm">
            이메일 인증이 완료되었습니다. 로그인해 주세요.
          </div>
        )}
        {urlErrorMessage && (
          <div className="alert alert-neutral text-sm">{urlErrorMessage}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            className="input input-bordered w-full"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input input-bordered w-full"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-base-content text-sm">{error}</p>}
          {info && <p className="text-base-content/70 text-sm break-all">{info}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <span className="loading loading-spinner" /> : "로그인"}
          </button>
        </form>
        {(showResend || urlError === "expired_token") && (
          <button
            type="button"
            className="btn btn-outline btn-sm w-full"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? <span className="loading loading-spinner" /> : "인증 메일 재발송"}
          </button>
        )}
        <p className="text-center text-sm">
          계정이 없으신가요?{" "}
          <Link href="/register" className="link link-neutral">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
