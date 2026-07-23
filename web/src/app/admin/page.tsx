"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { NegativeNuanceScore } from "@/components/negative-nuance-score";
import { useUIStore } from "@/store/ui-store";

type ModerationItem = {
  type: "post" | "comment";
  id: string;
  title: string | null;
  content: string;
  targetName: string | null;
  sarcasmScore: number;
  aggression: boolean;
  createdAt: string;
  author: { id: string; displayId: string; email: string; name: string };
  postTitle: string | null;
  postId: string | null;
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);
  const [threshold, setThreshold] = useState(70);

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("설정 조회 실패");
      return res.json() as Promise<{ threshold: number }>;
    },
  });

  const { data: queue, isLoading } = useQuery({
    queryKey: ["admin-moderation"],
    queryFn: async () => {
      const res = await fetch("/api/admin/moderation?status=PENDING");
      if (!res.ok) throw new Error("대기열 조회 실패");
      return res.json() as Promise<{ items: ModerationItem[]; pendingCount: number }>;
    },
  });

  useEffect(() => {
    if (settings?.threshold !== undefined) setThreshold(settings.threshold);
  }, [settings?.threshold]);

  const saveSettings = useMutation({
    mutationFn: async (value: number) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["threshold"] });
      openModal("임계치가 저장되었습니다. FastAPI 분석에도 즉시 반영됩니다.");
    },
    onError: (err: Error) => openModal(err.message),
  });

  const moderate = useMutation({
    mutationFn: async ({
      type,
      id,
      action,
    }: {
      type: "post" | "comment";
      id: string;
      action: "approve" | "delete";
    }) => {
      const res = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation"] });
      openModal(variables.action === "delete" ? "삭제되었습니다." : "승인 처리되었습니다.");
    },
    onError: (err: Error) => openModal(err.message),
  });

  function handleSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    saveSettings.mutate(threshold);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Icon name="fa-solid fa-shield-halved" />
            관리자
          </h1>
          <p className="text-base-content/60 mt-1">AI 임계치 · 월간 1등 · 검토 대기열</p>
        </div>
        <Link href="/board" className="btn btn-outline btn-sm gap-2 w-fit">
          <Icon name="fa-solid fa-arrow-left" />
          게시판
        </Link>
      </div>

      <div className="card bg-base-100 shadow-apple">
        <div className="card-body">
          <CurrentMonthLeaderPanel />
        </div>
      </div>

      <div className="card bg-base-100 shadow-apple">
        <div className="card-body">
          <h2 className="card-title gap-2">
            <Icon name="fa-solid fa-sliders" />
            AI 임계치 설정
          </h2>
          <p className="text-sm text-base-content/60">
            부정적 뉘앙스 점수가 임계치 이상이거나 공격성이 감지되면 검토 대기열에 등록됩니다.
            FastAPI와 웹 랭킹이 동일한 DB 값을 사용합니다.
          </p>
          <form onSubmit={handleSettingsSubmit} className="flex flex-col sm:flex-row gap-4 items-end mt-2">
            <div className="form-control w-full sm:max-w-xs">
              <label className="label">
                <span className="label-text">부정적 뉘앙스 임계치 (0~100)</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                className="input input-bordered"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saveSettings.isPending}>
              {saveSettings.isPending ? <span className="loading loading-spinner" /> : "저장"}
            </button>
          </form>
        </div>
      </div>

      <div className="card bg-base-100 shadow-apple">
        <div className="card-body">
          <MonthlyWinnerEmailPanel />
        </div>
      </div>

      <div className="card bg-base-100 shadow-apple">
        <div className="card-body">
          <h2 className="card-title gap-2">
            <Icon name="fa-solid fa-list-check" />
            검토 대기열
            {queue && (
              <span className="badge badge-neutral badge-sm">{queue.pendingCount}건</span>
            )}
          </h2>
          <p className="text-sm text-base-content/60 mb-4">
            고득점·공격성 콘텐츠를 검토하고 승인 또는 삭제할 수 있습니다.
          </p>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : !queue?.items.length ? (
            <p className="text-center text-base-content/50 py-8">검토 대기 중인 항목이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {queue.items.map((item) => (
                <div key={`${item.type}-${item.id}`} className="border border-base-300 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-neutral badge-outline">
                      {item.type === "post" ? "게시글" : "댓글"}
                    </span>
                    <NegativeNuanceScore score={item.sarcasmScore} threshold={threshold} />
                    {item.aggression && (
                      <span className="badge badge-score-high badge-outline">공격성</span>
                    )}
                    <span className="text-xs text-base-content/50 ml-auto">
                      {new Date(item.createdAt).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {item.type === "post" ? (
                    <>
                      <p className="font-semibold">{item.title}</p>
                      {item.targetName && (
                        <p className="text-sm text-base-content/60">대상: {item.targetName}님</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-base-content/60">
                      게시글: {item.postTitle}{" "}
                      {item.postId && (
                        <Link href={`/posts/${item.postId}`} className="link link-neutral">
                          보기
                        </Link>
                      )}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap line-clamp-3">{item.content}</p>
                  <p className="text-xs text-base-content/50">
                    작성자: {item.author.displayId} ({item.author.email}) · 실명: {item.author.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-primary btn-sm gap-2 flex-1 sm:flex-none"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ type: item.type, id: item.id, action: "approve" })}
                    >
                      <Icon name="fa-solid fa-check" />
                      승인
                    </button>
                    <button
                      className="btn btn-outline btn-sm gap-2 flex-1 sm:flex-none"
                      disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ type: item.type, id: item.id, action: "delete" })}
                    >
                      <Icon name="fa-solid fa-trash" />
                      삭제
                    </button>
                    {item.type === "post" && (
                      <Link href={`/posts/${item.id}`} className="btn btn-ghost btn-sm">
                        상세
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type MonthlyWinnerStatus = {
  smtpConfigured: boolean;
  period: { year: number; month: number; label: string };
  winners: Array<{
    name: string;
    score: number;
    praiseCount: number;
    likeCount: number;
  }>;
  verifiedRecipientCount: number;
  lastLog: {
    sentAt: string;
    recipientCount: number;
    winnerNames: string;
    triggeredBy: string;
  } | null;
};

type CurrentMonthRanking = {
  period: { year: number; month: number; label: string };
  leaders: Array<{
    rank: number;
    userId: string;
    name: string;
    praiseCount: number;
    likeCount: number;
    score: number;
  }>;
  scoring: { formula: string };
};

function CurrentMonthLeaderPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-current-month-leader"],
    queryFn: async () => {
      const res = await fetch("/api/rankings/monthly");
      if (!res.ok) throw new Error("월간 랭킹 조회 실패");
      return res.json() as Promise<CurrentMonthRanking>;
    },
  });

  const leader = data?.leaders[0] ?? null;
  const runnersUp = data?.leaders.slice(1, 3) ?? [];

  return (
    <>
      <h2 className="card-title gap-2">
        <Icon name="fa-solid fa-trophy" />
        이번 달 칭찬 점수 1등
      </h2>
      <p className="text-sm text-base-content/60">
        {data?.period.label ?? "이번 달"} 기준 · 긍정 칭찬만 집계
        {data?.scoring.formula ? ` (${data.scoring.formula})` : ""}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner" />
        </div>
      ) : !leader ? (
        <p className="text-center text-base-content/50 py-6">
          아직 집계된 칭찬이 없습니다.
        </p>
      ) : (
        <div className="mt-2 space-y-4">
          <div className="rounded-xl border border-base-300 bg-base-200/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base-content text-base-100">
                <Icon name="fa-solid fa-trophy" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-base-content/50">1위</p>
                <p className="text-xl font-bold truncate">{leader.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 sm:ml-auto text-sm">
              <div>
                <p className="text-xs text-base-content/50">점수</p>
                <p className="font-semibold">{leader.score}점</p>
              </div>
              <div>
                <p className="text-xs text-base-content/50">칭찬 건수</p>
                <p className="font-semibold">{leader.praiseCount}건</p>
              </div>
              <div>
                <p className="text-xs text-base-content/50">좋아요</p>
                <p className="font-semibold">{leader.likeCount}개</p>
              </div>
            </div>
          </div>

          {runnersUp.length > 0 && (
            <div className="text-sm space-y-2">
              <p className="text-base-content/50">참고 · 2~3위</p>
              <ul className="space-y-1">
                {runnersUp.map((entry) => (
                  <li
                    key={entry.userId}
                    className="flex justify-between gap-2 border-b border-base-300/60 py-1.5 last:border-0"
                  >
                    <span>
                      {entry.rank}위 · {entry.name}
                    </span>
                    <span className="text-base-content/60 shrink-0">
                      {entry.score}점
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link href="/rankings" className="btn btn-ghost btn-sm gap-2 w-fit">
            <Icon name="fa-solid fa-table-columns" />
            전체 랭킹 보기
          </Link>
        </div>
      )}
    </>
  );
}

function MonthlyWinnerEmailPanel() {
  const queryClient = useQueryClient();
  const openModal = useUIStore((s) => s.openModal);

  const { data: status, isLoading } = useQuery({
    queryKey: ["admin-monthly-winner"],
    queryFn: async () => {
      const res = await fetch("/api/admin/monthly-winner");
      if (!res.ok) throw new Error("칭찬왕 메일 상태 조회 실패");
      return res.json() as Promise<MonthlyWinnerStatus>;
    },
  });

  const sendEmail = useMutation({
    mutationFn: async (action: "test" | "send") => {
      const res = await fetch("/api/admin/monthly-winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json as { skipped: boolean; reason?: string; recipientCount?: number };
    },
    onSuccess: (data, action) => {
      if (data.skipped) {
        openModal(data.reason || "발송이 건너뛰어졌습니다.");
      } else if (action === "test") {
        openModal("테스트 메일을 본인 이메일로 발송했습니다.");
      } else {
        openModal(`${data.recipientCount ?? 0}명에게 칭찬왕 메일을 발송했습니다.`);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-monthly-winner"] });
    },
    onError: (err: Error) => openModal(err.message),
  });

  function handleManualSend() {
    if (
      !window.confirm(
        "인증 완료된 전체 회원에게 지난달 칭찬왕 메일을 발송합니다. 계속할까요?"
      )
    ) {
      return;
    }
    sendEmail.mutate("send");
  }

  return (
    <>
      <h2 className="card-title gap-2">
        <Icon name="fa-solid fa-envelope" />
        월간 칭찬왕 메일
      </h2>
      <p className="text-sm text-base-content/60">
        매월 1일 09:00 KST에 지난달 1등 칭찬왕을 전 회원에게 자동 발송합니다.
        1등이 없으면 메일을 보내지 않습니다.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner" />
        </div>
      ) : status ? (
        <div className="space-y-4 mt-2">
          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-base-content/60">대상 기간:</span>{" "}
              <strong>{status.period.label}</strong>
            </p>
            <p>
              <span className="text-base-content/60">SMTP:</span>{" "}
              {status.smtpConfigured ? (
                <span className="text-success">설정됨</span>
              ) : (
                <span className="text-error">미설정</span>
              )}
            </p>
            <p>
              <span className="text-base-content/60">발송 대상:</span>{" "}
              인증 회원 {status.verifiedRecipientCount}명
            </p>
            {status.winners.length > 0 ? (
              <p>
                <span className="text-base-content/60">칭찬왕:</span>{" "}
                {status.winners
                  .map((w) => `${w.name} (${w.score}점)`)
                  .join(", ")}
              </p>
            ) : (
              <p className="text-base-content/50">
                해당 월 칭찬왕 없음 — 자동/수동 발송 시 메일 미발송 (테스트 발송은 가능)
              </p>
            )}
            {status.lastLog && (
              <p className="text-xs text-base-content/50">
                마지막 처리: {new Date(status.lastLog.sentAt).toLocaleString("ko-KR")} ·{" "}
                {status.lastLog.recipientCount}명 · {status.lastLog.triggeredBy}
                {status.lastLog.winnerNames && ` · ${status.lastLog.winnerNames}`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm gap-2"
              disabled={sendEmail.isPending || !status.smtpConfigured}
              onClick={() => sendEmail.mutate("test")}
            >
              {sendEmail.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Icon name="fa-solid fa-flask" />
              )}
              테스트 발송 (본인)
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2"
              disabled={sendEmail.isPending || !status.smtpConfigured || status.winners.length === 0}
              onClick={handleManualSend}
            >
              {sendEmail.isPending ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Icon name="fa-solid fa-paper-plane" />
              )}
              수동 발송
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
