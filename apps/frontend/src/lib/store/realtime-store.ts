import { create } from "zustand";

export type SseConnectionStatus = "connected" | "retrying" | "disconnected";

interface RealtimeStore {
  status: SseConnectionStatus;
  lastMessageAt: string | null;
  setStatus: (status: SseConnectionStatus) => void;
  setLastMessageAt: (value: string) => void;
}

export const useRealtimeStore = create<RealtimeStore>((set) => ({
  status: "disconnected",
  lastMessageAt: null,
  setStatus: (status) => set({ status }),
  setLastMessageAt: (value) => set({ lastMessageAt: value }),
}));
