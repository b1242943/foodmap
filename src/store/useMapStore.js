import { create } from "zustand";

const DEFAULT_STATS = {
  label: "ZIP 53703 · Madison, WI",
  markets: 8,
  pantries: 5,
  snap: 12,
  resources: [],
  nearestDistance: 0.4,
  walkTime: 8,
  snapCoverage: 60,
  resourcesWalkable: 3,
  resourcesTravelable: 15,
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
   * Updates stats object
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
          markets: newStats.markets ?? prev.markets,
          pantries: newStats.pantries ?? prev.pantries,
          snap: newStats.snap ?? prev.snap,
          resources: newStats.resources ?? prev.resources,
          nearestDistance: newStats.nearestDistance ?? prev.nearestDistance,
          walkTime: newStats.walkTime ?? prev.walkTime,
          snapCoverage: newStats.snapCoverage ?? prev.snapCoverage,
          resourcesWalkable: newStats.resourcesWalkable ?? prev.resourcesWalkable,
          resourcesTravelable: newStats.resourcesTravelable ?? prev.resourcesTravelable,
        },
      };
    }),
}));
