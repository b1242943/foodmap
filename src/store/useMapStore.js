import { create } from "zustand";

const DEFAULT_STATS = {
  label: "ZIP 53703 · Madison, WI",
  markets: 8,
  pantries: 5,
  snap: 12,
  /** NYC Open Data: GrowNYC Farmers Market count in viewport */
  farmersMarkets: 0,
  /** SNAP-Ed Health Bucks: markets in viewport accepting Health Bucks */
  healthBucksCount: 0,
  resources: [],
  nearestDistance: 0.4,
  walkTime: 8,
  /** Health-Bucks-adjusted effective walk time (minutes). May be lower than walkTime
   *  when the nearest food access point accepts Health Bucks, offsetting transit cost.
   *  Capped so it never offsets more than 15 minutes. */
  effectiveWalkTime: 8,
  snapCoverage: 60,
  resourcesWalkable: 3,
  resourcesTravelable: 15,
};

/**
 * Zustand Global Map Store
 * Maintains application-wide state for the map interface and analytics.
 */
export const useMapStore = create((set, get) => ({
  /** @type {string} Current location search query */
  searchQuery: "",
  /** @type {Object} Core statistics and scoring data for the viewport */
  stats: DEFAULT_STATS,
  /** @type {boolean} Global loading indicator for async GIS processing */
  loading: false,
  /** @type {string} Active UI panel (e.g., 'Dashboard', 'Executive Report') */
  activeView: "Dashboard",
  /**
   * @type {{lat: number, lon: number}|null} Last panned-to center on the Executive
   * Report map. Tracked independently of `stats` so free exploration there (panning
   * away from the current search) doesn't retrigger a live search on every move —
   * only setActiveView() reconciles it against `stats`, and only when the user
   * actually switches to Dashboard/Resources.
   */
  executiveLocation: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ loading }),
  setExecutiveLocation: (loc) => set({ executiveLocation: loc }),

  /**
   * Switches the active view. Specifically when leaving Executive Report for
   * Dashboard/Resources, reconciles the shared search against wherever the user
   * last panned the Executive Report map, so those views target the same location
   * instead of the last real search. Scoped to that exact transition — e.g. the
   * Dashboard "View All" button (Dashboard -> Resources) must NOT pick up a stale
   * executiveLocation left over from an unrelated earlier Executive Report visit.
   */
  setActiveView: (view) => {
    const state = get();
    const cameFromExecutiveReport = state.activeView === "Executive Report";
    if (cameFromExecutiveReport && (view === "Dashboard" || view === "Resources")) {
      const loc = state.executiveLocation;
      if (loc) {
        const EPSILON = 0.0005; // ~50m — avoids a no-op resync from float precision
        const sameLat = state.stats.lat != null && Math.abs(state.stats.lat - loc.lat) < EPSILON;
        const sameLon = state.stats.lon != null && Math.abs(state.stats.lon - loc.lon) < EPSILON;
        if (!(sameLat && sameLon)) {
          set({ activeView: view, searchQuery: `${loc.lat.toFixed(6)},${loc.lon.toFixed(6)}` });
          return;
        }
      }
    }
    set({ activeView: view });
  },

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
          farmersMarkets: newStats.farmersMarkets ?? prev.farmersMarkets,
          healthBucksCount: newStats.healthBucksCount ?? prev.healthBucksCount,
          resources: newStats.resources ?? prev.resources,
          nearestDistance: newStats.nearestDistance ?? prev.nearestDistance,
          walkTime: newStats.walkTime ?? prev.walkTime,
          effectiveWalkTime: newStats.effectiveWalkTime ?? prev.effectiveWalkTime,
          snapCoverage: newStats.snapCoverage ?? prev.snapCoverage,
          resourcesWalkable: newStats.resourcesWalkable ?? prev.resourcesWalkable,
          resourcesTravelable: newStats.resourcesTravelable ?? prev.resourcesTravelable,
        },
      };
    }),
}));
