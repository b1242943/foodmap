import { useState, useCallback, useRef, useEffect } from "react";
import { Analytics } from '@vercel/analytics/react';
import FoodMap from "./Map";
import HomePage from "./HomePage";
import { useMapStore, DATA_SOURCE_META } from "./store/useMapStore";
import { useIntersectionObserver } from "./hooks/useIntersectionObserver";
import {
  haversineDistance,
  fetchOverpassData,
  classifyNode,
  loadSnapCSV,
  loadFeedingAmericaCSV,
  loadFarmersMarketsCSV,
  getFarmersMarketsDataYear,
  getSnapNearby,
  getFoodbanksNearby,
  getFarmersMarketsNearby,
  computeHealthBucksOffset,
} from "./utils/dataFetchers";
import ExecutiveReport from "./ExecutiveReport";
import ResourceListContainer from "./components/ResourceListContainer";
import ResourceDetailModal from "./components/ResourceDetailModal";
import ErrorBoundary from "./components/ErrorBoundary";
import BackButton from "./components/BackButton";
import NearMeButton from "./components/NearMeButton";

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

const VIEWS = ["Dashboard", "Executive Report", "Resources", "Compare Zones"];
const TYPE_COLORS = {
  markets: "var(--color-market)",
  pantries: "var(--color-pantry)",
  snap: "var(--color-snap)",
  desert: "var(--color-desert)",
  health_bucks: "#7c3aed"
};
const TYPE_LABELS = {
  markets: "Grocery Market",
  pantries: "Food Pantry",
  snap: "SNAP / EBT Retailer",
  health_bucks: "Farmers Market (Health Bucks)"
};

const Icon = {
  Dashboard: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  MapIcon: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  ),
  Resources: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3" cy="6" r="2" fill="currentColor" />
      <circle cx="3" cy="12" r="2" fill="currentColor" />
      <circle cx="3" cy="18" r="2" fill="currentColor" />
    </svg>
  ),
  Compare: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <path d="M11 18H8a2 2 0 0 1-2-2V9" />
    </svg>
  ),
  Search: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Dot: ({ color }) => (
    <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: color, flexShrink: 0 }} />
  ),
};

const NAV_ITEMS = [
  { label: "Dashboard", Icon: Icon.Dashboard },
  { label: "Executive Report", Icon: Icon.MapIcon },
  { label: "Resources", Icon: Icon.Resources },
  { label: "Compare Zones", Icon: Icon.Compare },
];

function TimeTravelSummary({ stats }) {
  const { nearestDistance, walkTime, snapCoverage, pantries } = stats;

  let tier = "Severe Transit Burden";
  let tierColor = "var(--color-desert)";
  if (nearestDistance !== null) {
    if (nearestDistance <= 0.5) {
      tier = "Highly Walkable Access";
      tierColor = "var(--color-market)";
    } else if (nearestDistance <= 1.5) {
      tier = "Transit/Vehicle Reliant";
      tierColor = "var(--color-snap)";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: "var(--border-radius)", border: "2px solid var(--border-color)" }}>
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8, letterSpacing: "1px" }}>MOBILITY TIER STATUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: tierColor }} />
          <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 800, color: "var(--text-primary)" }}>{tier}</div>
        </div>
      </div>

      <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: "var(--border-radius)", border: "2px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "1px" }}>TIME & TRAVEL MATRIX</div>
        
        <div style={{ background: "var(--bg-primary)", padding: "16px", borderRadius: "var(--border-radius)", border: "2px solid var(--border-color)" }}>
          <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Nearest Food</div>
          <div style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)" }}>
            {nearestDistance !== null ? `Nearest store is ${nearestDistance.toFixed(1)} miles away (~${walkTime} mins walk).` : "No stores found."}
          </div>
        </div>

        <div style={{ background: "var(--bg-primary)", padding: "16px", borderRadius: "var(--border-radius)", border: "2px solid var(--border-color)" }}>
          <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>SNAP Coverage</div>
          <div style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)" }}>
            {snapCoverage}% of nearby food resources accept EBT cards.
          </div>
        </div>

        <div style={{ background: "var(--bg-primary)", padding: "16px", borderRadius: "var(--border-radius)", border: "2px solid var(--border-color)" }}>
          <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Emergency Infrastructure</div>
          <div style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)" }}>
            {pantries} food pantries or soup kitchens found within your transit zone.
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourcesView() {
  const stats = useMapStore((state) => state.stats);
  const [filter, setFilter] = useState("all");
  const [renderCount, setRenderCount] = useState(20);
  const resources = stats.resources || [];
  const filtered = filter === "all" ? resources : resources.filter((r) => r.type === filter);

  useEffect(() => {
    setRenderCount(20);
  }, [filter, stats.resources]);

  const loadMoreRef = useIntersectionObserver(() => setRenderCount((prev) => prev + 20));

  const visibleItems = filtered.slice(0, renderCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      <div style={{ display: "flex", gap: 12, padding: "24px", borderBottom: "2px solid var(--border-color)", flexShrink: 0, flexWrap: "wrap", alignItems: "center", background: "var(--bg-secondary)" }}>
        {["all", "markets", "pantries", "snap"].map((f) => {
          const count = f === "all" ? resources.length : resources.filter((r) => r.type === f).length;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: active ? "var(--text-primary)" : "var(--bg-primary)",
                border: "2px solid var(--border-color)",
                borderColor: active ? "var(--text-primary)" : "var(--border-color)",
                color: active ? "white" : "var(--text-secondary)",
                fontSize: "var(--font-size-base)",
                padding: "10px 20px",
                borderRadius: "var(--border-radius)",
                textTransform: "capitalize",
              }}
            >
              {f === "all" ? `All (${count})` : `${TYPE_LABELS[f]} (${count})`}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--text-secondary)" }}>{stats.label}</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "var(--font-size-lg)", marginTop: 60 }}>
            {resources.length === 0 ? "Search a location to discover resources" : "No resources match this filter"}
          </div>
        ) : (
          <>
            {visibleItems.map((r, i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-primary)",
                  border: "2px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                  padding: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <Icon.Dot color={TYPE_COLORS[r.type]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{r.name}</div>
                  <div style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)" }}>{r.detail}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, padding: "6px 12px", borderRadius: 20, background: `var(--color-${r.type}-light)`, color: TYPE_COLORS[r.type], border: `1px solid ${TYPE_COLORS[r.type]}` }}>
                    {TYPE_LABELS[r.type]}
                  </span>
                  {r.distance && <span style={{ fontSize: "var(--font-size-base)", color: "var(--text-secondary)", fontWeight: 500 }}>{r.distance} miles away</span>}
                </div>
              </div>
            ))}
            {renderCount < filtered.length && (
              <div ref={loadMoreRef} style={{ height: 20 }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const VARIANCE_ROWS = [
  { key: "markets", label: "Grocery Markets", color: "var(--color-market)" },
  { key: "pantries", label: "Food Pantries", color: "var(--color-pantry)" },
  { key: "snap", label: "SNAP / EBT Retailers", color: "var(--color-snap)" },
];

// Each metric's underlying source carries a different kind of provenance (live query vs.
// a dated annual snapshot vs. a static bundle with no date encoded at all) — see
// DATA_SOURCE_META's `freshness` field for why these can't share one label format.
function formatSourceFreshness(source, result) {
  if (source.freshness === "live") {
    if (!result?.fetchedAt) return "Live data";
    const secondsAgo = Math.max(0, Math.round((Date.now() - new Date(result.fetchedAt).getTime()) / 1000));
    let ago;
    if (secondsAgo < 60) ago = `${secondsAgo}s ago`;
    else if (secondsAgo < 3600) ago = `${Math.round(secondsAgo / 60)}m ago`;
    else ago = `${Math.round(secondsAgo / 3600)}h ago`;
    return `Live data · fetched ${ago}`;
  }
  if (source.freshness === "dataYear") {
    return result?.farmersMarketDataYear ? `Dataset year ${result.farmersMarketDataYear}` : "Dataset year unavailable";
  }
  return "Static dataset bundled with this app — exact refresh date not encoded in the source data";
}

function DataSourceTooltip({ metricKey, result, onClose, side }) {
  const meta = DATA_SOURCE_META[metricKey];
  if (!meta) return null;
  // Anchor from the edge closer to the card's center instead of centering under the
  // trigger — the "A" (left) button sits near the container's left edge and a centered
  // popover overflows off-screen there; same for "B" on the right.
  const sideStyle = side === "A" ? { left: 0 } : { right: 0 };
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        ...sideStyle,
        zIndex: 20,
        width: 260,
        background: "var(--bg-primary)",
        border: "2px solid var(--border-color)",
        borderRadius: "var(--border-radius)",
        boxShadow: "var(--shadow-lg)",
        padding: 16,
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: "var(--text-primary)" }}>
          Data Source{meta.sources.length > 1 ? "s" : ""}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, padding: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {meta.sources.map((source) => (
          <div key={source.name}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: "var(--color-market)" }}
            >
              {source.name} ↗
            </a>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {formatSourceFreshness(source, result)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VarianceBar({ metricKey, label, color, valueA, valueB, resultA, resultB, openSide, onToggleSide }) {
  const total = valueA + valueB;
  const pctA = total > 0 ? (valueA / total) * 100 : 50;
  const pctB = total > 0 ? (valueB / total) * 100 : 50;
  const delta = valueA - valueB;

  let deltaText;
  if (total === 0) {
    deltaText = "Even — no resources found in either zone";
  } else if (delta === 0) {
    deltaText = "Even";
  } else if (delta > 0) {
    deltaText = `Zone 1 +${delta}`;
  } else {
    deltaText = `Zone 2 +${Math.abs(delta)}`;
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: "var(--font-size-base)", color: "var(--text-primary)" }}>{label}</span>
        <span style={{ fontWeight: 700, fontSize: "var(--font-size-sm)", color: delta === 0 ? "var(--text-muted)" : color }}>{deltaText}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => onToggleSide("A")}
            title="View data source"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 28, textAlign: "right", fontWeight: 700, fontSize: "var(--font-size-lg)", color: "var(--text-primary)", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
          >
            {valueA}
          </button>
          {openSide === "A" && <DataSourceTooltip metricKey={metricKey} result={resultA} side="A" onClose={() => onToggleSide("A")} />}
        </div>
        <div style={{ flex: 1, height: 12, borderRadius: 6, overflow: "hidden", display: "flex", background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <div style={{ width: `${pctA}%`, background: color, transition: "width 0.3s ease" }} />
          <div style={{ width: `${pctB}%`, background: "var(--border-color)", transition: "width 0.3s ease" }} />
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => onToggleSide("B")}
            title="View data source"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 28, textAlign: "left", fontWeight: 700, fontSize: "var(--font-size-lg)", color: "var(--text-primary)", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
          >
            {valueB}
          </button>
          {openSide === "B" && <DataSourceTooltip metricKey={metricKey} result={resultB} side="B" onClose={() => onToggleSide("B")} />}
        </div>
      </div>
    </div>
  );
}

function CompareView() {
  const [zips, setZips] = useState(["", ""]);
  const results = useMapStore((state) => state.compareResults);
  const setCompareResult = useMapStore((state) => state.setCompareResult);
  const [loading, setLoading] = useState([false, false]);
  const [errors, setErrors] = useState(["", ""]);
  const [openTooltip, setOpenTooltip] = useState(null); // { zoneIdx, metricKey } | null

  const analyzeZip = useCallback(
    async (idx) => {
      const val = zips[idx].trim();
      if (!val) return;
      setLoading((p) => {
        const n = [...p];
        n[idx] = true;
        return n;
      });
      setErrors((p) => {
        const n = [...p];
        n[idx] = "";
        return n;
      });
      try {
        const hasCountry = val.includes(",");
        const countryParam = hasCountry ? "" : "&countrycodes=us";

        // Geocoding failures (network/HTTP) are the only thing that should hard-fail this
        // location — mirrors Map.jsx's classification instead of letting a raw fetch/JSON
        // error surface as a generic message.
        let geoData;
        try {
          const geoRes = await fetch(
            `${NOMINATIM_URL}?q=${encodeURIComponent(val)}&format=json&addressdetails=1&limit=1${countryParam}`
          );
          if (!geoRes.ok) throw new Error(`Geocoding service returned HTTP ${geoRes.status}.`);
          geoData = await geoRes.json();
        } catch (geoErr) {
          const err = new Error("Could not reach the location lookup service. Check your connection and try again.");
          err.code = "GEOCODING_ERROR";
          throw err;
        }

        if (!Array.isArray(geoData) || !geoData.length) {
          throw new Error(`Location not found: "${val}"`);
        }

        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);
        const label = geoData[0].display_name.split(",").slice(0, 2).join(", ");

        // Same dynamic radius shrinking as Map.jsx: zip searches use a plain radius (no
        // bbox), and known isolated peninsula ZIPs (e.g. 11691 Far Rockaway) clamp the
        // Overpass radius so the live query finishes inside the Vercel timeout.
        const isZipSearch = /^\d{5}$/.test(val);
        const isPeninsula = /1169[1-7]|rockaway|edgemere/i.test(val);

        let overpassBbox = null;
        if (!isZipSearch && geoData[0].boundingbox) {
          const [southLat, northLat, westLon, eastLon] = geoData[0].boundingbox.map(parseFloat);
          overpassBbox = `${southLat},${westLon},${northLat},${eastLon}`;
        }

        let searchRadius = isZipSearch ? 2500 : 5000;
        if (isPeninsula) searchRadius = Math.min(searchRadius, 3218);

        // Decoupled fetch: live Overpass plus the three local fallback datasets all run
        // concurrently. A slow/failed Overpass call can never block local data or bubble
        // up as a hard "Database error" — it's caught below and reported as a soft warning.
        const [overpassResult, snapResult, faResult, fmResult] = await Promise.allSettled([
          fetchOverpassData(lat, lon, isZipSearch ? null : overpassBbox, searchRadius),
          loadSnapCSV(),
          loadFeedingAmericaCSV(),
          loadFarmersMarketsCSV(),
        ]);
        // Real retrieval timestamp for this search — used by the data-source tooltips to
        // show a genuine "fetched X ago" for the live-queried Overpass data, not a guess.
        const fetchedAt = new Date().toISOString();

        const counts = { markets: 0, pantries: 0, snap: 0 };
        const resources = [];

        let overpassError = null;
        if (overpassResult.status === "fulfilled") {
          (overpassResult.value || []).forEach((node) => {
            const itemLat = node.lat || node.center?.lat;
            const itemLon = node.lon || node.center?.lon;
            if (!itemLat || !itemLon) return;
            const type = classifyNode(node);
            counts[type]++;
            resources.push({ type, distance: parseFloat(haversineDistance(lat, lon, itemLat, itemLon)) });
          });
        } else {
          overpassError = overpassResult.reason;
          console.warn("[Compare] Overpass fetch failed (non-fatal):", overpassError?.message || overpassError);
        }

        // Local SNAP retailers — getSnapNearby enforces the shared MAX_LOCAL_RADIUS_MILES cap.
        const snapData = snapResult.status === "fulfilled" ? snapResult.value || [] : [];
        getSnapNearby(snapData, lat, lon, searchRadius, null, isZipSearch ? val : null).forEach((row) => {
          const rlat = parseFloat(row.Latitude);
          const rlon = parseFloat(row.Longitude);
          counts.snap++;
          resources.push({ type: "snap", distance: parseFloat(haversineDistance(lat, lon, rlat, rlon)) });
        });

        // Local Feeding America food banks/pantries — same 5-mile cap applied inside getFoodbanksNearby.
        const faData = faResult.status === "fulfilled" ? faResult.value || [] : [];
        const countyName =
          geoData[0].address?.county ||
          geoData[0].display_name.split(",").find((p) => p.includes("County"))?.trim() ||
          "";
        getFoodbanksNearby(faData, countyName, lat, lon).forEach((row) => {
          const rlat = parseFloat(row.Latitude);
          const rlon = parseFloat(row.Longitude);
          counts.pantries++;
          resources.push({ type: "pantries", distance: parseFloat(haversineDistance(lat, lon, rlat, rlon)) });
        });

        // Local NYC Farmers Markets — also feeds the Health Bucks offset below.
        const fmData = fmResult.status === "fulfilled" ? fmResult.value || [] : [];
        let healthBucksCount = 0;
        let nearestHBDist = null;
        let nearestHBMultiplier = 1.0;
        getFarmersMarketsNearby(fmData, lat, lon, searchRadius * 2, null).forEach((market) => {
          const rlat = parseFloat(market.lat);
          const rlon = parseFloat(market.lon);
          const distance = parseFloat(haversineDistance(lat, lon, rlat, rlon));
          const type = market.accepts_health_bucks ? "health_bucks" : "markets";
          counts.markets++;
          if (market.accepts_health_bucks) {
            healthBucksCount++;
            if (nearestHBDist === null || distance < nearestHBDist) {
              nearestHBDist = distance;
              nearestHBMultiplier = parseFloat(market.health_bucks_multiplier) || 1.0;
            }
          }
          resources.push({ type, distance });
        });

        resources.sort((a, b) => a.distance - b.distance);

        const allGrocery = resources.filter((r) => r.type === "markets" || r.type === "snap" || r.type === "health_bucks");
        const nearestDistance = allGrocery.length > 0 ? allGrocery[0].distance : null;
        const walkTime = nearestDistance !== null ? Math.round(nearestDistance * 20) : null;
        const { effectiveWalkTime } =
          walkTime !== null
            ? computeHealthBucksOffset(walkTime, nearestHBDist, nearestHBMultiplier)
            : { effectiveWalkTime: null };

        let snapCoverage = 0;
        if (allGrocery.length > 0) {
          const snapMarkets = allGrocery.filter((r) => r.type === "snap").length;
          snapCoverage = Math.round((snapMarkets / allGrocery.length) * 100);
        }

        // Overpass failing/timing out is a degraded-but-recovered state as long as at
        // least one local fallback source came through — render normally with no warning
        // in that case. Only surface a warning when every source (live + all three local
        // datasets) failed, since then there is genuinely nothing to show for this location.
        const allSourcesFailed =
          overpassResult.status === "rejected" &&
          snapResult.status === "rejected" &&
          faResult.status === "rejected" &&
          fmResult.status === "rejected";
        const partialDataWarning = allSourcesFailed
          ? "Could not load any grocery, SNAP, food bank, or farmers market data for this location."
          : null;

        setCompareResult(idx, {
          label,
          counts,
          nearestDistance,
          walkTime,
          effectiveWalkTime,
          snapCoverage,
          healthBucksCount,
          partialDataWarning,
          fetchedAt,
          farmersMarketDataYear: getFarmersMarketsDataYear(),
        });
      } catch (e) {
        setErrors((p) => {
          const n = [...p];
          n[idx] = e.message;
          return n;
        });
      }
      setLoading((p) => {
        const n = [...p];
        n[idx] = false;
        return n;
      });
    },
    [zips],
  );

  const metrics =
    results[0] && results[1]
      ? [
        ["Nearest Distance", results[0].nearestDistance ? `${results[0].nearestDistance.toFixed(1)} mi` : "N/A", results[1].nearestDistance ? `${results[1].nearestDistance.toFixed(1)} mi` : "N/A"],
        ["Est. Walk Time", results[0].walkTime ? `${results[0].walkTime} mins` : "N/A", results[1].walkTime ? `${results[1].walkTime} mins` : "N/A"],
        ["Effective Walk Time", results[0].effectiveWalkTime != null ? `${results[0].effectiveWalkTime} mins` : "N/A", results[1].effectiveWalkTime != null ? `${results[1].effectiveWalkTime} mins` : "N/A"],
        ["SNAP Coverage", `${results[0].snapCoverage}%`, `${results[1].snapCoverage}%`],
        ["Grocery Markets", results[0].counts.markets, results[1].counts.markets],
        ["Food Pantries", results[0].counts.pantries, results[1].counts.pantries],
        ["SNAP / EBT Retailers", results[0].counts.snap, results[1].counts.snap],
      ]
      : [];

  return (
    <div style={{ height: "100%", background: "var(--bg-primary)", overflowY: "auto", padding: 32 }}>
      <h2 style={{ fontSize: "var(--font-size-2xl)", fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 32, textAlign: "center", color: "var(--text-primary)" }}>Compare Two Locations</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, maxWidth: 1000, margin: "0 auto" }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ background: "var(--bg-secondary)", border: "2px solid var(--border-color)", borderRadius: "var(--border-radius)", padding: 24 }}>
            <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16 }}>LOCATION {i + 1}</div>
            <div style={{ display: "flex", gap: 12, marginBottom: errors[i] ? 12 : 24 }}>
              <input
                value={zips[i]}
                onChange={(e) =>
                  setZips((p) => {
                    const n = [...p];
                    n[i] = e.target.value;
                    return n;
                  })
                }
                onKeyDown={(e) => e.key === "Enter" && analyzeZip(i)}
                placeholder="Enter ZIP code..."
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={() => analyzeZip(i)} disabled={loading[i]}>
                {loading[i] ? "Loading..." : "Check"}
              </button>
            </div>
            {errors[i] && (
              <div style={{ fontSize: "var(--font-size-base)", color: "var(--color-desert)", marginBottom: 16, padding: "12px", background: "#fef2f2", borderRadius: "var(--border-radius)", border: "2px solid #fecaca", fontWeight: 600 }}>
                {errors[i]}
              </div>
            )}
            {results[i] ? (
              <div>
                <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>{results[i].label}</div>
                {results[i].partialDataWarning && (
                  <div style={{ fontSize: "var(--font-size-sm)", color: "#92400e", marginBottom: 16, padding: "10px 14px", background: "#fffbeb", borderRadius: "var(--border-radius)", border: "2px solid #f59e0b", fontWeight: 600 }}>
                    ⏱ {results[i].partialDataWarning}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[["Grocery Markets", results[i].counts.markets, "var(--color-market)"], ["Food Pantries", results[i].counts.pantries, "var(--color-pantry)"], ["SNAP / EBT Retailers", results[i].counts.snap, "var(--color-snap)"]].map(([label, val, color]) => (
                    <div key={label} style={{ background: "var(--bg-primary)", padding: "12px 16px", borderRadius: "var(--border-radius)", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</div>
                      <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "var(--font-size-lg)", padding: "40px 0" }}>{loading[i] ? "Finding resources..." : "Enter a location to see results"}</div>
            )}
          </div>
        ))}
      </div>

      {results[0] && results[1] && (
        <div style={{ maxWidth: 1000, margin: "40px auto 0", background: "var(--bg-primary)", border: "2px solid var(--border-color)", borderRadius: "var(--border-radius)", padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--font-size-lg)", color: "var(--text-primary)", marginBottom: 4, textAlign: "center" }}>Resource Variance</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginBottom: 24 }}>
            Zone 1 ({results[0].label}) vs Zone 2 ({results[1].label}) — click a count to see its data source
          </div>
          {VARIANCE_ROWS.map(({ key, label, color }) => (
            <VarianceBar
              key={key}
              metricKey={key}
              label={label}
              color={color}
              valueA={results[0].counts[key]}
              valueB={results[1].counts[key]}
              resultA={results[0]}
              resultB={results[1]}
              openSide={openTooltip?.metricKey === key ? openTooltip.side : null}
              onToggleSide={(side) =>
                setOpenTooltip((prev) => (prev?.metricKey === key && prev.side === side ? null : { metricKey: key, side }))
              }
            />
          ))}
        </div>
      )}

      {metrics.length > 0 && (
        <div style={{ maxWidth: 1000, margin: "40px auto 0", background: "var(--bg-primary)", border: "2px solid var(--border-color)", borderRadius: "var(--border-radius)", overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", background: "var(--bg-secondary)", borderBottom: "2px solid var(--border-color)", fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>COMPARISON RESULTS</div>
          {metrics.map(([label, a, b]) => {
            const winner = a > b ? 0 : b > a ? 1 : -1;
            return (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 200px 1fr", padding: "16px 24px", borderBottom: "1px solid var(--border-color)", alignItems: "center" }}>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color: winner === 0 ? "var(--color-market)" : "var(--text-primary)", textAlign: "center" }}>{a}</div>
                <div style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--text-secondary)", textAlign: "center" }}>{label}</div>
                <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color: winner === 1 ? "var(--color-market)" : "var(--text-primary)", textAlign: "center" }}>{b}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [input, setInput] = useState("");
  const searchQuery = useMapStore((state) => state.searchQuery);
  const setSearchQuery = useMapStore((state) => state.setSearchQuery);
  const stats = useMapStore((state) => state.stats);
  const loading = useMapStore((state) => state.loading);
  const activeView = useMapStore((state) => state.activeView);
  const setActiveView = useMapStore((state) => state.setActiveView);

  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [selectedResource, setSelectedResource] = useState(null);

  const filteredResources = selectedResourceType === 'all' 
    ? (stats.resources || [])
    : (stats.resources || []).filter(r => r.type === selectedResourceType);

  const handleSearch = () => {
    const q = input.trim();
    if (!q || loading) return;
    setActiveView("Dashboard");
    setSearchQuery(q);
  };

  const viewIndex = VIEWS.indexOf(activeView);

  if (showLanding) {
    return (
      <ErrorBoundary>
        <HomePage onEnter={() => setShowLanding(false)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gridTemplateRows: "80px 1fr", height: "100vh", background: "var(--bg-primary)", overflow: "hidden" }}>
      {/* Top Header */}
      <div style={{ gridColumn: "1 / -1", background: "var(--bg-primary)", borderBottom: "2px solid var(--border-color)", display: "flex", alignItems: "center", gap: 32, padding: "0 32px", zIndex: 100 }}>
        <BackButton onReturn={() => setShowLanding(true)} />
        <div style={{ flexShrink: 0 }}>
          <span style={{ 
            fontSize: "var(--font-size-xl)", 
            fontWeight: 600, 
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ fontSize: "28px" }}>🍃</span>
            FoodMap
          </span>
        </div>

        <div style={{ flex: 1, maxWidth: 750, display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex" }}>
              <Icon.Search />
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter your ZIP code or City..."
              style={{ width: "100%", paddingLeft: 48, height: 52, fontSize: "var(--font-size-lg)" }}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleSearch}
            disabled={loading}
            style={{ height: 52, fontSize: "var(--font-size-lg)", minWidth: 120 }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
          <NearMeButton />
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div style={{ background: "var(--bg-secondary)", borderRight: "2px solid var(--border-color)", display: "flex", flexDirection: "column", overflowY: "auto", padding: "24px 16px" }}>
        <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--text-muted)", padding: "0 16px 12px", textTransform: "uppercase", letterSpacing: "1px" }}>Menu</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {NAV_ITEMS.map(({ label, Icon: NavIcon }) => {
            const active = activeView === label;
            return (
              <button
                key={label}
                onClick={() => setActiveView(label)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px",
                  fontSize: "var(--font-size-lg)",
                  fontWeight: active ? 700 : 500,
                  color: active ? "white" : "var(--text-secondary)",
                  background: active ? "var(--color-pantry)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <NavIcon />
                {label}
              </button>
            );
          })}
        </div>


      </div>

      {/* Main Content Area */}
      <div style={{ overflow: "hidden", position: "relative" }}>
        <div style={{ display: "flex", width: `${VIEWS.length * 100}%`, height: "100%", transform: `translateX(-${viewIndex * (100 / VIEWS.length)}%)`, transition: "transform 0.4s ease" }}>

          {/* Dashboard View */}
          <div style={{ width: `${100 / VIEWS.length}%`, height: "100%", display: "flex", flexDirection: "column", flexShrink: 0, padding: 32, overflowY: "auto" }}>
            <h1 style={{ fontSize: "var(--font-size-2xl)", fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>Location Dashboard</h1>
            <div style={{ fontSize: "var(--font-size-lg)", color: "var(--text-secondary)", marginBottom: 32 }}>Viewing results for: <strong style={{ color: "var(--text-primary)" }}>{stats.label}</strong></div>

            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 32, alignItems: "start" }}>
              {/* Left Column: Stats */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <TimeTravelSummary stats={stats} />
                
                <div style={{ background: "var(--bg-secondary)", padding: 24, borderRadius: "var(--border-radius)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Resource Counts</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[["Grocery Markets", stats.markets, "var(--color-market)"], ["Food Insecurity Help", stats.pantries, "var(--color-pantry)"], ["SNAP / EBT Retailers", stats.snap, "var(--color-snap)"]].map(([label, val, color]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: color }} />
                          <div style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</div>
                        </div>
                        <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 700, color: "var(--text-primary)" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 24, fontSize: "11px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.4 }}>
                    Food insecurity resources provided by Feeding America member organizations, verified and updated regularly.
                  </div>
                </div>
              </div>

              {/* Right Column: Mini Map & Top Resources */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ height: 400, borderRadius: "var(--border-radius)", overflow: "hidden", border: "2px solid var(--border-color)", position: "relative" }}>
                  <FoodMap />
                  <div style={{ position: "absolute", top: 16, right: 16, zIndex: 1000, background: "var(--bg-primary)", padding: 12, borderRadius: "var(--border-radius)", border: "2px solid var(--border-color)", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>MAP LEGEND</div>
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon.Dot color={TYPE_COLORS[key]} />
                        <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div style={{ background: "var(--bg-primary)", padding: 24, borderRadius: "var(--border-radius)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--text-primary)" }}>Closest Resources</div>
                    <button className="btn-primary" onClick={() => setActiveView("Resources")} style={{ padding: "8px 16px", fontSize: "var(--font-size-sm)" }}>View All</button>
                  </div>
                  
                  {loading ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "var(--font-size-lg)" }}>Loading nearby resources...</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "500px", overflowY: "auto", paddingRight: 8 }}>
                      <ResourceListContainer resources={filteredResources} loading={loading} onSelectResource={setSelectedResource} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Executive Report View */}
          <div style={{ width: `${100 / VIEWS.length}%`, height: "100%", flexShrink: 0, position: "relative", display: "flex", background: "var(--bg-secondary)" }}>
            <ExecutiveReport />
          </div>

          {/* Resources View */}
          <div style={{ width: `${100 / VIEWS.length}%`, height: "100%", flexShrink: 0 }}>
            <ResourcesView />
          </div>

          {/* Compare View */}
          <div style={{ width: `${100 / VIEWS.length}%`, height: "100%", flexShrink: 0 }}>
            <CompareView />
          </div>
        </div>
      </div>

      <ResourceDetailModal 
        resource={selectedResource} 
        onClose={() => setSelectedResource(null)} 
      />
      <Analytics />
    </div>
    </ErrorBoundary>
  );
}
