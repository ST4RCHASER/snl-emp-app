import { create } from "zustand";

export interface VirtualDesktop {
  id: string;
  name: string;
  order: number;
}

interface DesktopStore {
  desktops: VirtualDesktop[];
  activeDesktopId: string;
  isLoaded: boolean;

  // Actions
  loadFromPreferences: (
    desktops: VirtualDesktop[] | null,
    activeDesktopId: string | null,
  ) => void;
  addDesktop: () => string;
  removeDesktop: (desktopId: string) => void;
  renameDesktop: (desktopId: string, name: string) => void;
  setActiveDesktop: (desktopId: string) => void;
  reorderDesktops: (desktopIds: string[]) => void;
  getState: () => { desktops: VirtualDesktop[]; activeDesktopId: string };
}

const DEFAULT_DESKTOP_ID = "desktop-1";
const DEFAULT_DESKTOPS: VirtualDesktop[] = [
  { id: DEFAULT_DESKTOP_ID, name: "Desktop 1", order: 0 },
];

export const useDesktopStore = create<DesktopStore>()((set, get) => ({
  desktops: DEFAULT_DESKTOPS,
  activeDesktopId: DEFAULT_DESKTOP_ID,
  isLoaded: false,

  loadFromPreferences: (desktops, activeDesktopId) => {
    const validDesktops =
      desktops && Array.isArray(desktops) && desktops.length > 0
        ? desktops
        : DEFAULT_DESKTOPS;

    const validActiveId =
      activeDesktopId && validDesktops.some((d) => d.id === activeDesktopId)
        ? activeDesktopId
        : validDesktops[0].id;

    set({
      desktops: validDesktops,
      activeDesktopId: validActiveId,
      isLoaded: true,
    });
  },

  addDesktop: () => {
    const desktops = get().desktops;
    const newOrder = desktops.length;
    const newId = `desktop-${Date.now()}`;
    const newDesktop: VirtualDesktop = {
      id: newId,
      name: `Desktop ${newOrder + 1}`,
      order: newOrder,
    };

    set((state) => ({
      desktops: [...state.desktops, newDesktop],
    }));

    return newId;
  },

  removeDesktop: (desktopId) => {
    const { desktops, activeDesktopId } = get();

    // Can't remove the last desktop
    if (desktops.length <= 1) return;

    // Can't remove the default desktop
    if (desktopId === DEFAULT_DESKTOP_ID) return;

    const newDesktops = desktops
      .filter((d) => d.id !== desktopId)
      .map((d, index) => ({ ...d, order: index }));

    // If removing the active desktop, switch to the first one
    const newActiveId =
      activeDesktopId === desktopId ? newDesktops[0].id : activeDesktopId;

    set({
      desktops: newDesktops,
      activeDesktopId: newActiveId,
    });
  },

  renameDesktop: (desktopId, name) => {
    set((state) => ({
      desktops: state.desktops.map((d) =>
        d.id === desktopId ? { ...d, name } : d,
      ),
    }));
  },

  setActiveDesktop: (desktopId) => {
    const desktop = get().desktops.find((d) => d.id === desktopId);
    if (desktop) {
      set({ activeDesktopId: desktopId });
    }
  },

  reorderDesktops: (desktopIds) => {
    set((state) => ({
      desktops: desktopIds
        .map((id, index) => {
          const desktop = state.desktops.find((d) => d.id === id);
          return desktop ? { ...desktop, order: index } : null;
        })
        .filter((d): d is VirtualDesktop => d !== null),
    }));
  },

  getState: () => {
    const { desktops, activeDesktopId } = get();
    return { desktops, activeDesktopId };
  },
}));
