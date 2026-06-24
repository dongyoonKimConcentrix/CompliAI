"use client";

import { Icon } from "@/components/icon";
import { getKSTNow } from "@/lib/praise-policy";

type MonthPickerProps = {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
};

export function MonthPicker({ year, month, onChange }: MonthPickerProps) {
  const now = getKSTNow();

  function goPrev() {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  }

  function goNext() {
    const isCurrent = year === now.year && month === now.month;
    if (isCurrent) return;
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  }

  const isCurrent = year === now.year && month === now.month;

  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={goPrev} aria-label="이전 달">
        <Icon name="fa-solid fa-chevron-left" />
      </button>
      <div className="text-center min-w-[8rem]">
        <p className="text-xl font-semibold">{year}년 {month}월</p>
        {isCurrent && (
          <span className="badge badge-neutral badge-sm badge-outline mt-1">이번 달</span>
        )}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-circle"
        onClick={goNext}
        disabled={isCurrent}
        aria-label="다음 달"
      >
        <Icon name="fa-solid fa-chevron-right" />
      </button>
    </div>
  );
}
