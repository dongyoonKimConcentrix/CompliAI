"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

type PraiseTarget = {
  id: string;
  name: string;
};

type PraiseTargetSelectProps = {
  value: string;
  initialLabel?: string;
  onChange: (userId: string, name: string) => void;
  disabled?: boolean;
};

export function PraiseTargetSelect({
  value,
  initialLabel,
  onChange,
  disabled = false,
}: PraiseTargetSelectProps) {
  const [query, setQuery] = useState(initialLabel ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["praise-targets", query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/users/praise-targets?${params}`);
      if (!res.ok) throw new Error("회원 목록 조회 실패");
      return res.json() as Promise<{ users: PraiseTarget[] }>;
    },
    enabled: open,
  });

  useEffect(() => {
    if (initialLabel) setQuery(initialLabel);
  }, [initialLabel]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const users = data?.users ?? [];

  return (
    <div className="form-control" ref={containerRef}>
      <label className="label">
        <span className="label-text">칭찬 대상</span>
      </label>
      <div className="relative">
        <div className="join w-full">
          <input
            className="input input-bordered join-item w-full"
            placeholder="이름으로 검색..."
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (!e.target.value.trim()) onChange("", "");
            }}
            onFocus={() => setOpen(true)}
            required={!value}
          />
          <button
            type="button"
            className="btn btn-outline join-item"
            disabled={disabled}
            onClick={() => setOpen((prev) => !prev)}
            aria-label="칭찬 대상 목록 열기"
          >
            <Icon name="fa-solid fa-chevron-down" />
          </button>
        </div>
        {open && (
          <ul className="menu absolute z-20 mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <li className="px-4 py-3 text-sm text-base-content/60">
                <span className="loading loading-spinner loading-sm" />
              </li>
            ) : users.length === 0 ? (
              <li className="px-4 py-3 text-sm text-base-content/60">검색 결과가 없습니다.</li>
            ) : (
              users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className={value === user.id ? "active" : undefined}
                    onClick={() => {
                      onChange(user.id, user.name);
                      setQuery(user.name);
                      setOpen(false);
                    }}
                  >
                    {user.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {value && (
        <p className="text-xs text-base-content/50 mt-1">선택됨: {query || initialLabel}</p>
      )}
    </div>
  );
}
