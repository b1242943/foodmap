import { create } from "zustand";

const DEFAULT_STATS = {
  label: "ZIP 53703 · Madison, WI",
  score: 72,
  markets: 8,
  pantries: 5,
  snap: 12,
  resources: [],
  bars: {
    Proximity: { val: 82, color: "var(--color-market)" },
    Affordability: { val: 64, color: "var(--color-pantry)" },
    Variety: { val: 71, color: "var(--color-market)" },
    SNAP: { val: 55, color: "var(--color-snap)" },
    Transit: { val: 43, color: "var(--text-muted)" },
    Pantries: { val: 30, color: "var(--color-desert)" },
  },
};

export const useMapStore = create((set) => ({
  searchQuery: "",
  stats: DEFAULT_STATS,
  loading: false,
  activeView: "Dashboard",

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ loading }),
  setActiveView: (view) => set({ activeView: view }),
  setStats: (newStats) =>
    set((state) => {
      const prev = state.stats;
      return {
        stats: {
          ...prev,
          label: newStats.label ?? prev.label,
          lat: newStats.lat ?? prev.lat,
          lon: newStats.lon ?? prev.lon,
          score: newStats.score ?? prev.score,
          markets: newStats.markets ?? prev.markets,
          pantries: newStats.pantries ?? prev.pantries,
          snap: newStats.snap ?? prev.snap,
          resources: newStats.resources ?? prev.resources,
          bars: {
            ...prev.bars,
            Proximity: {
              ...prev.bars.Proximity,
              val: newStats.marketScore ?? prev.bars.Proximity.val,
            },
            Pantries: {
              ...prev.bars.Pantries,
              val: newStats.pantryScore ?? prev.bars.Pantries.val,
            },
            SNAP: {
              ...prev.bars.SNAP,
              val: newStats.snapScore ?? prev.bars.SNAP.val,
            },
          },
        },
      };
    }),
}));
