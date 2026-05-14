import { useState } from "react";
import { useSavedPlaces } from "./useSavedPlaces";

// ── Constants ─────────────────────────────────────────────────────────────────
const VIEWS = ["Saved Places"];

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = {
  SavedPlaces: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Heart:       () => <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Trash:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
};

const NAV_ITEMS = [
  { label: "Saved Places", Icon: Icon.SavedPlaces },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function SavedPlacesView({ saved, onRemove }) {
  const [nameInput, setNameInput] = useState("");
  const [newPlace, setNewPlace] = useState(null);

  const handleAddPlace = () => {
    if (!nameInput.trim()) return;
    const place = {
      id: Date.now(),
      name: nameInput,
      timestamp: new Date().toLocaleString(),
    };
    onAddPlace?.(place);
    setNameInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080c10", padding: 20 }}>
      {/* Add new place section */}
      <div style={{ marginBottom: 24, display: "flex", gap: 8 }}>
        <input
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAddPlace()}
          placeholder="Add a new place..."
          style={{
            flex: 1,
            background: "#0c1118",
            border: "1px solid #1a2535",
            borderRadius: 4,
            color: "#dce8f5",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "9px 12px",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={e => e.target.style.borderColor = "#00f0a040"}
          onBlur={e => e.target.style.borderColor = "#1a2535"}
        />
        <button
          onClick={handleAddPlace}
          style={{
            background: "#00f0a0",
            border: "none",
            color: "#060a0e",
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            padding: "9px 16px",
            borderRadius: 4,
            cursor: "pointer",
            letterSpacing: "1px",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.target.style.background = "#00d98f"; }}
          onMouseLeave={e => { e.target.style.background = "#00f0a0"; }}
        >
          SAVE
        </button>
      </div>

      {/* Saved places list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {saved.length === 0 ? (
          <div style={{ textAlign: "center", color: "#2a3d52", fontFamily: "monospace", fontSize: 12, marginTop: 60 }}>
            No saved places yet. Add one to get started!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {saved.map((place, idx) => (
              <div
                key={place.id}
                style={{
                  background: "#0c1118",
                  border: "1px solid #1a2535",
                  borderRadius: 6,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  animation: `slideIn 0.25s ease ${idx * 0.03}s both`,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#00f0a0"; e.currentTarget.style.background = "#0e1520"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2535"; e.currentTarget.style.background = "#0c1118"; }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00f0a0", boxShadow: "0 0 6px #00f0a0", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#dce8f5", marginBottom: 2 }}>{place.name}</div>
                  <div style={{ fontSize: 10, color: "#4a6680" }}>{place.timestamp}</div>
                </div>
                <button
                  onClick={() => onRemove(place.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid #ff3366",
                    borderRadius: 4,
                    color: "#ff3366",
                    padding: "6px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    transition: "all 0.15s",
                    fontFamily: "monospace",
                  }}
                  onMouseEnter={e => { e.target.style.background = "rgba(255,51,102,0.1)"; }}
                  onMouseLeave={e => { e.target.style.background = "transparent"; }}
                >
                  <Icon.Trash />
                  DELETE
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Resources View ────────────────────────────────────────────────────────────
function ResourcesView({ stats }) {
  const [filter, setFilter] = useState("all");
  const resources = stats.resources || [];
  const filtered  = filter === "all" ? resources : resources.filter(r => r.type === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080c10" }}>
      <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderBottom: "1px solid #1a2535", flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "markets", "pantries", "snap"].map(f => {
          const count = f === "all" ? resources.length : resources.filter(r => r.type === f).length;
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: active ? "rgba(0,240,160,0.10)" : "transparent",
              border: `1px solid ${active ? "rgba(0,240,160,0.35)" : "#1e2d3d"}`,
              color: active ? "#00f0a0" : "#4a6680",
              fontFamily: "monospace", fontSize: 11, letterSpacing: "0.8px",
              padding: "6px 14px", borderRadius: 4, cursor: "pointer",
              textTransform: "uppercase", transition: "all 0.15s", minHeight: 32,
            }}>
              {f === "all" ? `All · ${count}` : `${f} · ${count}`}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 11, color: "#2a3d52" }}>{stats.label}</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#2a3d52", fontFamily: "monospace", fontSize: 12, marginTop: 60 }}>
            {resources.length === 0 ? "Search a location to discover resources" : "No resources match this filter"}
          </div>
        ) : filtered.map((r, i) => (
          <div key={i} style={{
            background: "#0c1118", border: "1px solid #1a2535", borderRadius: 6,
            padding: "13px 16px", display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
            animation: `slideIn 0.25s ease ${i * 0.03}s both`,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = TYPE_COLORS[r.type]; e.currentTarget.style.background = "#0e1520"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2535"; e.currentTarget.style.background = "#0c1118"; }}
          >
            <Icon.Dot color={TYPE_COLORS[r.type]} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#dce8f5", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "#4a6680", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.detail}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, padding: "2px 7px", borderRadius: 3, background: `${TYPE_COLORS[r.type]}15`, color: TYPE_COLORS[r.type], border: `1px solid ${TYPE_COLORS[r.type]}30`, letterSpacing: "1px" }}>
                {TYPE_LABELS[r.type]}
              </span>
              {r.distance && <span style={{ fontFamily: "monospace", fontSize: 10, color: "#2a3d52" }}>{r.distance} mi</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Compare View ──────────────────────────────────────────────────────────────
const OVERPASS_URL  = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function buildQuery(lat, lon, r) {
  return `[out:json][timeout:25];(
    node["shop"="supermarket"](around:${r},${lat},${lon});
    node["shop"="grocery"](around:${r},${lat},${lon});
    node["amenity"="food_bank"](around:${r},${lat},${lon});
    node["amenity"="social_facility"]["social_facility"="food_bank"](around:${r},${lat},${lon});
    node["government"="social_services"](around:${r},${lat},${lon});
  );out body;`;
}

function classifyNode(tags = {}) {
  const name = (tags.name || "").toLowerCase();
  if (tags.government === "social_services" || /snap|fsa|ebt|food stamp/.test(name)) return "snap";
  if (tags.amenity === "food_bank" || tags.social_facility === "food_bank" || /pantry|food bank|soup kitchen/.test(name)) return "pantries";
  return "markets";
}

function computeScore({ markets, pantries, snap }) {
  const mkt = Math.min(100, markets * 14);
  const pan = Math.min(100, pantries * 22);
  const snp = Math.min(100, snap * 10);
  return { score: Math.round(mkt * 0.45 + pan * 0.25 + snp * 0.30), marketScore: mkt, pantryScore: pan, snapScore: snp };
}

function CompareView() {
  const [zips, setZips]       = useState(["", ""]);
  const [results, setResults] = useState([null, null]);
  const [loading, setLoading] = useState([false, false]);
  const [errors, setErrors]   = useState(["", ""]);

  const analyzeZip = useCallback(async (idx) => {
    const val = zips[idx].trim();
    if (!val) return;
    setLoading(p => { const n=[...p]; n[idx]=true; return n; });
    setErrors(p =>  { const n=[...p]; n[idx]="";   return n; });
    try {
      const geoRes  = await fetch(`${NOMINATIM_URL}?q=${encodeURIComponent(val)}&format=json&limit=1`);
      const geoData = await geoRes.json();
      if (!geoData.length) throw new Error(`Location not found: "${val}"`);
      const lat   = parseFloat(geoData[0].lat);
      const lon   = parseFloat(geoData[0].lon);
      const label = geoData[0].display_name.split(",").slice(0, 2).join(" ·");
      const ovRes  = await fetch(OVERPASS_URL, { method: "POST", body: `data=${encodeURIComponent(buildQuery(lat, lon, 5000))}` });
      if (!ovRes.ok) throw new Error("Overpass API error");
      const ovData = await ovRes.json();
      const counts = { markets: 0, pantries: 0, snap: 0 };
      (ovData.elements || []).forEach(n => counts[classifyNode(n.tags)]++);
      const scores = computeScore(counts);
      setResults(p => { const n=[...p]; n[idx]={ label, counts, ...scores }; return n; });
    } catch (e) {
      setErrors(p => { const n=[...p]; n[idx]=e.message; return n; });
    }
    setLoading(p => { const n=[...p]; n[idx]=false; return n; });
  }, [zips]);

  const metrics = results[0] && results[1] ? [
    ["Score",    results[0].score,           results[1].score],
    ["Markets",  results[0].counts.markets,  results[1].counts.markets],
    ["Pantries", results[0].counts.pantries, results[1].counts.pantries],
    ["SNAP",     results[0].counts.snap,     results[1].counts.snap],
  ] : [];

  return (
    <div style={{ height: "100%", background: "#080c10", overflowY: "auto", padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 860, margin: "0 auto" }}>
        {[0, 1].map(i => (
          <div key={i} style={{ background: "#0c1118", border: "1px solid #1a2535", borderRadius: 8, padding: 20 }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "2px", color: "#2a3d52", marginBottom: 12 }}>ZONE {i + 1}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: errors[i] ? 8 : 16 }}>
              <input
                value={zips[i]}
                onChange={e => setZips(p => { const n=[...p]; n[i]=e.target.value; return n; })}
                onKeyDown={e => e.key === "Enter" && analyzeZip(i)}
                placeholder="ZIP or city..."
                style={{ flex: 1, background: "#111820", border: "1px solid #1e2d3d", borderRadius: 4, color: "#dce8f5", fontFamily: "monospace", fontSize: 12, padding: "9px 12px", outline: "none", transition: "border-color 0.15s" }}
                onFocus={e => e.target.style.borderColor = "#00f0a040"}
                onBlur={e => e.target.style.borderColor = "#1e2d3d"}
              />
              <button onClick={() => analyzeZip(i)} disabled={loading[i]} style={{
                background: loading[i] ? "#111820" : "#00f0a0", border: "none",
                color: loading[i] ? "#00f0a0" : "#060a0e",
                fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                padding: "9px 16px", borderRadius: 4, cursor: loading[i] ? "not-allowed" : "pointer",
                letterSpacing: "1px", minWidth: 52, transition: "all 0.2s",
              }}>{loading[i] ? "···" : "GO"}</button>
            </div>
            {errors[i] && (
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#ff3366", marginBottom: 12, padding: "7px 10px", background: "rgba(255,51,102,0.07)", borderRadius: 4, border: "1px solid rgba(255,51,102,0.18)" }}>
                ⚠ {errors[i]}
              </div>
            )}
            {results[i] ? (
              <div>
                <div style={{ fontSize: 11, color: "#4a6680", marginBottom: 10 }}>{results[i].label}</div>
                <ScoreBadge score={results[i].score} />
                {[["Markets", results[i].counts.markets, "#00f0a0"], ["Pantries", results[i].counts.pantries, "#3b9eff"], ["SNAP", results[i].counts.snap, "#ffc400"]].map(([label, val, color]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color: "#4a6680", width: 55 }}>{label}</div>
                    <div style={{ flex: 1, height: 4, background: "#1a2535", borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(100, val * 12)}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color, width: 22, textAlign: "right" }}>{val}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#2a3d52", fontFamily: "monospace", fontSize: 11, padding: "28px 0" }}>
                {loading[i] ? "Analyzing…" : "Enter a location to analyze"}
              </div>
            )}
          </div>
        ))}
      </div>

      {metrics.length > 0 && (
        <div style={{ maxWidth: 860, margin: "16px auto 0", background: "#0c1118", border: "1px solid #1a2535", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #1a2535", fontFamily: "monospace", fontSize: 10, letterSpacing: "2px", color: "#2a3d52" }}>HEAD TO HEAD</div>
          {metrics.map(([label, a, b]) => {
            const winner = a > b ? 0 : b > a ? 1 : -1;
            return (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", padding: "11px 20px", borderBottom: "1px solid rgba(26,37,53,0.5)", alignItems: "center" }}>
                <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: winner === 0 ? "#00f0a0" : "#2a3d52", textAlign: "right" }}>{a}</div>
                <div style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "1.5px", color: "#4a6680", textAlign: "center" }}>{label.toUpperCase()}</div>
                <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: winner === 1 ? "#00f0a0" : "#2a3d52" }}>{b}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { saved, toggle, clear } = useSavedPlaces();
  const [activeView] = useState("Saved Places");

  const handleAddPlace = (place) => {
    toggle(place);
  };

  const handleRemove = (id) => {
    const place = saved.find(p => p.id === id);
    if (place) toggle(place);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gridTemplateRows: "52px 1fr", height: "100vh", background: "#060a0e", color: "#dce8f5", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", overflow: "hidden" }}>

      {/* ── TOPBAR ── */}
      <div style={{ gridColumn: "1 / -1", background: "#0a0f16", borderBottom: "1px solid #141e2a", display: "flex", alignItems: "center", gap: 20, padding: "0 20px", zIndex: 100 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00f0a0", boxShadow: "0 0 8px #00f0a0" }} />
          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#00f0a0", letterSpacing: "3px" }}>MAD SAVES</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Count badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#2a3d52", letterSpacing: "1px" }}>PLACES</span>
          <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#00f0a0", background: "rgba(0,240,160,0.1)", padding: "4px 12px", borderRadius: 4, border: "1px solid rgba(0,240,160,0.25)" }}>
            {saved.length}
          </div>
        </div>

        {/* Clear button */}
        {saved.length > 0 && (
          <button
            onClick={clear}
            style={{
              background: "transparent",
              border: "1px solid #ff3366",
              borderRadius: 4,
              color: "#ff3366",
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "1px",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.target.style.background = "rgba(255,51,102,0.1)"; }}
            onMouseLeave={e => { e.target.style.background = "transparent"; }}
          >
            CLEAR ALL
          </button>
        )}
      </div>

      {/* ── SIDEBAR ── */}
      <div style={{ background: "#0a0f16", borderRight: "1px solid #141e2a", display: "flex", flexDirection: "column", padding: "16px 0" }}>
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: "2px", color: "#1e2d3d", marginBottom: 10, textTransform: "uppercase" }}>Navigation</div>
          {NAV_ITEMS.map(({ label, Icon: NavIcon }) => {
            const active = activeView === label;
            return (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                fontSize: 12, fontWeight: active ? 600 : 400,
                color: active ? "#00f0a0" : "#3a5068",
                borderLeft: `2px solid ${active ? "#00f0a0" : "transparent"}`,
                background: active ? "rgba(0,240,160,0.04)" : "transparent",
                cursor: "pointer", transition: "all 0.15s", minHeight: 44, borderRadius: "0 6px 6px 0",
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "#6a8aa0"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "#3a5068"; e.currentTarget.style.background = "transparent"; }}}
              >
                <NavIcon />
                {label}
              </div>
            );
          })}
        </div>

        {/* Info card */}
        <div style={{ margin: "24px 12px 0", padding: "12px", background: "#0e1520", border: "1px solid #141e2a", borderRadius: 6 }}>
          <div style={{ fontFamily: "monospace", fontSize: 8, letterSpacing: "2px", color: "#1e2d3d", marginBottom: 8, textTransform: "uppercase" }}>Quick Info</div>
          <div style={{ fontSize: 11, color: "#2a3d52", lineHeight: 1.6 }}>
            Save and manage your favorite places here.{" "}
            <span style={{ color: "#00f0a0", fontWeight: 600 }}>v1.0</span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ overflow: "hidden", position: "relative", height: "100%" }}>
        <SavedPlacesView saved={saved} onAddPlace={handleAddPlace} onRemove={handleRemove} />
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060a0e; }
        ::-webkit-scrollbar-thumb { background: #141e2a; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #1e2d3d; }
      `}</style>
    </div>
  );
}