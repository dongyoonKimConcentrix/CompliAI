import { create } from "zustand";

type Theme = "apple" | "apple-dark";

type UIStore = {
  theme: Theme;
  modalOpen: boolean;
  modalContent: string | null;
  setTheme: (theme: Theme) => void;
  openModal: (content: string) => void;
  closeModal: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  theme: "apple",
  modalOpen: false,
  modalContent: null,
  setTheme: (theme) => set({ theme }),
  openModal: (content) => set({ modalOpen: true, modalContent: content }),
  closeModal: () => set({ modalOpen: false, modalContent: null }),
}));
