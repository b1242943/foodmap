import { create } from "zustand";

/**
 * Static attribution catalog for Compare Zones' resource-count metrics. Not reactive
 * state — this never changes at runtime, so it's exported as a plain constant rather
 * than wrapped in the store, alongside the store it's used by.
 *
 * `freshness` tells the tooltip UI how to phrase the "as of" line, since each source
 * carries a genuinely different kind of provenance:
 *   - "live":     fetched fresh on every search — show the per-search fetchedAt timestamp.
 *   - "dataYear": a dated annual snapshot — show the real Year value from the source data.
 *   - "static":   a bundled snapshot with no date encoded in the source data at all —
 *                 say so plainly instead of inventing a refresh date.
 */
export const DATA_SOURCE_META = {
  markets: {
    label: "Grocery Markets",
    sources: [
      { name: "OpenStreetMap (Overpass API)", url: "https://www.openstreetmap.org/", freshness: "live" },
      { name: "NYC Open Data — DOHMH Farmers Markets", url: "https://data.cityofnewyork.us/Health/NYC-Farmers-Markets/8vwk-6iz2", freshness: "dataYear" },
    ],
  },
  pantries: {
    label: "Food Pantries",
    sources: [
      { name: "Feeding America", url: "https://www.feedingamerica.org/research", freshness: "static" },
    ],
  },
  snap: {
    label: "SNAP / EBT Retailers",
    sources: [
      { name: "USDA FNS SNAP Retailer Locator", url: "https://www.fns.usda.gov/snap/retailer/historical-data", freshness: "static" },
    ],
  },
};

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
  /**
   * @type {[Object|null, Object|null]} Compare Zones' per-zone results (counts, distance/
   * walk-time metrics, and attribution timestamps). Global so the variance bar and data-
   * source tooltips re-render immediately as each zone's search resolves.
   */
  compareResults: [null, null],

  setSearchQuery: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ loading }),
  setExecutiveLocation: (loc) => set({ executiveLocation: loc }),
  setCompareResult: (idx, result) =>
    set((state) => {
      const next = [...state.compareResults];
      next[idx] = result;
      return { compareResults: next };
    }),

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
