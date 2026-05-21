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

/**
 * Zustand Global Map Store
 * Maintains application-wide state for the map interface and analytics.
 */
export const useMapStore = create((set) => ({
  /** @type {string} Current location search query */
  searchQuery: "",
  /** @type {Object} Core statistics and scoring data for the viewport */
  stats: DEFAULT_STATS,
  /** @type {boolean} Global loading indicator for async GIS processing */
  loading: false,
  /** @type {string} Active UI panel (e.g., 'Dashboard', 'Executive Report') */
  activeView: "Dashboard",

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ loading }),
  setActiveView: (view) => set({ activeView: view }),
  
  /**
   * Deep merges new statistics into the existing stats object.
   * This ensures sub-objects (like the 'bars' breakdown) are partially updated
   * without overwriting unspecified values.
   * @param {Object} newStats - The updated statistics payload
   */
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
