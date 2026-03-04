import { create } from "zustand"

type UiState = {
  isSidebarOpen: boolean
  closeSidebar: () => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}))
