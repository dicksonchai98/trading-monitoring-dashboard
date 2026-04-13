import { create } from "zustand";

interface DashboardUiStore {
  stickyBannerDismissed: boolean;
  dismissStickyBanner: () => void;
  resetStickyBanner: () => void;
}

export const useDashboardUiStore = create<DashboardUiStore>((set) => ({
  stickyBannerDismissed: false,
  dismissStickyBanner: () => set({ stickyBannerDismissed: true }),
  resetStickyBanner: () => set({ stickyBannerDismissed: false }),
}));
