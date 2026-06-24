"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Icon } from "@/components/icon";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const errorMessages: Record<string, string> = {
    invalid_token: "유효하지 않은 인증 링크입니다. 인증 메일을 다시 요청해 주세요.",
    expired_token: "인증 링크가 만료되었습니다. 로그인 화면에서 인증 메일을 다시 요청해 주세요.",
    already_verified: "이미 인증된 계정입니다. 로그인해 주세요.",
    verify_failed: "인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setStatus("error");
      setErrorMessage(errorMessages.invalid_token);
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(errorMessages[json.error as string] ?? errorMessages.verify_failed);
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage(errorMessages.verify_failed);
    }
  }

  if (!token) {
    return (
      <div className="card bg-base-100 shadow-lg max-w-md mx-auto">
        <div className="card-body text-center space-y-4">
          <Icon name="fa-solid fa-link-slash text-4xl text-error" />
          <h1 className="text-xl font-bold">인증 링크 오류</h1>
          <p className="text-base-content/60">{errorMessages.invalid_token}</p>
          <Link href="/login" className="btn btn-primary">
            로그인으로 이동
          </Link>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="card bg-base-100 shadow-lg max-w-md mx-auto">
        <div className="card-body text-center space-y-4">
          <Icon name="fa-solid fa-circle-check text-4xl text-success" />
          <h1 className="text-xl font-bold">이메일 인증 완료</h1>
          <p className="text-base-content/60">이제 로그인할 수 있습니다.</p>
          <Link href="/login?verified=1" className="btn btn-primary">
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-lg max-w-md mx-auto">
      <div className="card-body space-y-4">
        <h1 className="card-title text-2xl justify-center gap-2">
          <Icon name="fa-solid fa-envelope-circle-check" />
          이메일 인증
        </h1>
        <p className="text-sm text-base-content/60 text-center">
          아래 버튼을 눌러 이메일 인증을 완료해 주세요.
        </p>

        {status === "error" && (
          <div className="alert alert-error text-sm">
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <button type="submit" className="btn btn-primary w-full" disabled={status === "loading"}>
            {status === "loading" ? (
              <span className="loading loading-spinner" />
            ) : (
              "이메일 인증하기"
            )}
          </button>
        </form>

        <p className="text-xs text-base-content/50 text-center">
          메일의 링크만 열린 상태입니다. 반드시 위 버튼을 눌러 인증을 완료해 주세요.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<span className="loading loading-spinner loading-lg mx-auto block" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
