import { useState, useCallback, useRef, useEffect } from "react";
import FoodMap from "./Map";
import HomePage from "./HomePage";
import { useMapStore } from "./store/useMapStore";
import ExecutiveReport from "./ExecutiveReport";
import ResourceListContainer from "./components/ResourceListContainer";
import ScoreSummary from "./components/ScoreSummary";
import ScoreDetailModal from "./components/ScoreDetailModal";
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
const TYPE_COLORS = { markets: "var(--color-market)", pantries: "var(--color-pantry)", snap: "var(--color-snap)", desert: "var(--color-desert)" };
const TYPE_LABELS = { markets: "Grocery Market", pantries: "Food Pantry", snap: "SNAP / EBT Retailer" };

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

function scoreColor(v) {
  if (v >= 70) return "var(--color-market)";
  if (v >= 45) return "var(--color-snap)";
  return "var(--color-desert)";
}

function ScoreBadge({ score }) {
  const color = scoreColor(score);
  const label = score >= 70 ? "Good Access" : score >= 45 ? "Limited Access" : "Food Desert";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16, background: "var(--bg-secondary)", padding: 16, borderRadius: "var(--border-radius)", border: "1px solid var(--border-color)" }}>
      <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-secondary)", fontWeight: 600 }}>OVERALL SCORE</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: "48px", fontWeight: 700, color, lineHeight: 1, letterSpacing: "-1px" }}>{score}</div>
        <div style={{ fontSize: "var(--font-size-lg)", color: "var(--text-secondary)", fontWeight: 600 }}>/ 100</div>
      </div>
      <div style={{ fontSize: "var(--font-size-lg)", color, fontWeight: 700, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function ResourcesView() {
  const stats = useMapStore((state) => state.stats);
  const [filter, setFilter] = useState("all");
  const [renderCount, setRenderCount] = useState(20);
  const observerRef = useRef();

  const resources = stats.resources || [];
  const filtered = filter === "all" ? resources : resources.filter((r) => r.type === filter);

  useEffect(() => {
    setRenderCount(20);
  }, [filter, stats.resources]);

  const loadMoreRef = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setRenderCount((prev) => prev + 20);
      }
    });
    if (node) observerRef.current.observe(node);
  }, []);

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

const OVERPASS_URL = "/api/overpass";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function buildQuery(bbox) {
  const b = `${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]}`;
  return `[out:json][timeout:90];(
    nwr["shop"="supermarket"](${b});
    nwr["shop"="grocery"](${b});
    nwr["amenity"="food_bank"](${b});
    nwr["amenity"="social_facility"]["social_facility"="food_bank"]["social_facility"!~"nursing|care|doctors|hospital"](${b});
    nwr["amenity"="social_facility"]["social_facility"="food_pantry"]["social_facility"!~"nursing|care|doctors|hospital"](${b});
    nwr["social_facility"="food_bank"]["social_facility"!~"nursing|care|doctors|hospital"](${b});
    nwr["social_facility"="soup_kitchen"]["social_facility"!~"nursing|care|doctors|hospital"](${b});
    nwr["government"="social_services"](${b});
  );out center;`;
}

function classifyNode(tags = {}) {
  const name = (tags.name || "").toLowerCase();
  if (tags.government === "social_services" || /snap|food stamp|dhs|benefit|human service/.test(name)) return "snap";
  if (tags.amenity === "food_bank" || tags.social_facility === "food_bank" || /pantry|food bank|soup kitchen|hunger|salvation army|food shelf/.test(name)) return "pantries";
  return "markets";
}

function computeScore({ markets, pantries, snap }) {
  const mkt = Math.min(100, markets * 14);
  const pan = Math.min(100, pantries * 22);
  const snp = Math.min(100, snap * 10);
  return { score: Math.round(mkt * 0.45 + pan * 0.25 + snp * 0.3), marketScore: mkt, pantryScore: pan, snapScore: snp };
}

function CompareView() {
  const [zips, setZips] = useState(["", ""]);
  const [results, setResults] = useState([null, null]);
  const [loading, setLoading] = useState([false, false]);
  const [errors, setErrors] = useState(["", ""]);

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
        const geoRes = await fetch(`${NOMINATIM_URL}?q=${encodeURIComponent(val)}&format=json&limit=1`);
        const geoData = await geoRes.json();
        if (!geoData.length) throw new Error(`Location not found: "${val}"`);
        const lat = parseFloat(geoData[0].lat);
        const lon = parseFloat(geoData[0].lon);
        const bbox = geoData[0].boundingbox;
        const label = geoData[0].display_name.split(",").slice(0, 2).join(", ");
        const cacheKey = `overpass_${lat.toFixed(3)}_${lon.toFixed(3)}`;
        const cached = sessionStorage.getItem(cacheKey);
        let elements = [];

        if (cached) {
          elements = JSON.parse(cached);
        } else {
          const ovRes = await fetch(OVERPASS_URL, { method: "POST", body: `data=${encodeURIComponent(buildQuery(bbox))}` });
          if (!ovRes.ok) throw new Error("Database error");
          const ovData = await ovRes.json();
          elements = ovData.elements || [];
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(elements));
          } catch (e) {
            console.warn("Could not cache overpass data", e);
          }
        }

        const counts = { markets: 0, pantries: 0, snap: 0 };
        elements.forEach((n) => counts[classifyNode(n.tags)]++);
        const scores = computeScore(counts);
        setResults((p) => {
          const n = [...p];
          n[idx] = { label, counts, ...scores };
          return n;
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
        ["Overall Score", results[0].score, results[1].score],
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
                <ScoreBadge score={results[i].score} />
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
  const [showScoringModal, setShowScoringModal] = useState(false);
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
                <ScoreBadge score={stats.score} />

                <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary)' }}>SCORE BREAKDOWN</div>
                  {Object.entries(stats.bars).map(([label, { val, color }]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', width: 90, flexShrink: 0 }}>{label}</div>
                      <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 100 }} />
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color, width: 30, textAlign: 'right' }}>{val}</div>
                    </div>
                  ))}
                </div>
                
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
      <ScoreDetailModal 
        isOpen={showScoringModal} 
        score={stats.score} 
        bars={stats.bars} 
        onClose={() => setShowScoringModal(false)} 
      />
      <ResourceDetailModal 
        resource={selectedResource} 
        onClose={() => setSelectedResource(null)} 
      />
    </div>
    </ErrorBoundary>
  );
}
