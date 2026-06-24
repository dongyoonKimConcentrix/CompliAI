"use client";

import { useUIStore } from "@/store/ui-store";

export function GlobalModal() {
  const { modalOpen, modalContent, closeModal } = useUIStore();

  if (!modalOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">알림</h3>
        <p className="py-4">{modalContent}</p>
        <div className="modal-action">
          <button className="btn" onClick={closeModal}>
            확인
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={closeModal}>
        <button>close</button>
      </form>
    </dialog>
  );
}
