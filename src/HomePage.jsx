import { useEffect, useState } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');

  .fm-home * { box-sizing: border-box; margin: 0; padding: 0; }

  .fm-home {
    font-family: 'Plus Jakarta Sans', sans-serif;
    color: #111827;
    background: #fff;
    overflow-x: hidden;
  }

  .fm-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 3rem;
    border-bottom: 1px solid #f0f0f0;
    position: sticky;
    top: 0;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(8px);
    z-index: 100;
  }

  .fm-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 600;
    font-size: 18px;
    color: #111827;
    text-decoration: none;
  }

  .fm-logo-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #059669;
  }

  .fm-nav-cta {
    background: #059669;
    color: #fff;
    border: none;
    padding: 0.6rem 1.4rem;
    border-radius: 8px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .fm-nav-cta:hover { background: #047857; }

  .fm-hero {
    padding: 6rem 3rem 4rem;
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: center;
  }

  .fm-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ecfdf5;
    color: #065f46;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 6px 12px;
    border-radius: 100px;
    margin-bottom: 1.5rem;
  }

  .fm-tag-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #059669;
  }

  .fm-hero h1 {
    font-family: 'Fraunces', serif;
    font-size: 3.2rem;
    font-weight: 300;
    line-height: 1.15;
    color: #111827;
    margin-bottom: 1.25rem;
    padding-left: 4px;
    margin-left: -4px;
  }

  .fm-hero h1 em {
    font-style: italic;
    color: #059669;
  }

  .fm-hero p {
    font-size: 1.05rem;
    color: #6b7280;
    line-height: 1.7;
    margin-bottom: 2rem;
    max-width: 480px;
  }

  .fm-hero-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .fm-btn-primary {
    background: #059669;
    color: #fff;
    border: none;
    padding: 0.85rem 2rem;
    border-radius: 10px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
  }

  .fm-btn-primary:hover { background: #047857; transform: translateY(-1px); }

  .fm-btn-secondary {
    background: transparent;
    color: #374151;
    border: 1.5px solid #e5e7eb;
    padding: 0.85rem 1.75rem;
    border-radius: 10px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .fm-btn-secondary:hover { border-color: #9ca3af; }

  .fm-hero-visual {
    background: #f9fafb;
    border-radius: 16px;
    border: 1px solid #f0f0f0;
    padding: 1.5rem;
    position: relative;
  }

  .fm-mini-score {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #f0f0f0;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
  }

  .fm-mini-score-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9ca3af;
    margin-bottom: 0.5rem;
  }

  .fm-mini-score-number {
    font-family: 'Fraunces', serif;
    font-size: 2.5rem;
    font-weight: 400;
    color: #059669;
    line-height: 1;
    margin-bottom: 4px;
  }

  .fm-mini-score-sub {
    font-size: 13px;
    color: #6b7280;
  }

  .fm-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 1rem;
  }

  .fm-bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .fm-bar-label {
    font-size: 12px;
    color: #6b7280;
    width: 90px;
    flex-shrink: 0;
  }

  .fm-bar-track {
    flex: 1;
    height: 5px;
    background: #f3f4f6;
    border-radius: 100px;
    overflow: hidden;
  }

  .fm-bar-fill {
    height: 100%;
    border-radius: 100px;
    background: #059669;
    transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
  }

  .fm-bar-fill.amber { background: #d97706; }
  .fm-bar-fill.blue { background: #2563eb; }

  .fm-mini-chips {
    display: flex;
    gap: 8px;
    margin-top: 1rem;
  }

  .fm-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #374151;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 100px;
    padding: 4px 10px;
  }

  .fm-chip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .fm-stats {
    background: #111827;
    padding: 3.5rem 3rem;
  }

  .fm-stats-inner {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2rem;
  }

  .fm-stat {
    text-align: center;
  }

  .fm-stat-number {
    font-family: 'Fraunces', serif;
    font-size: 2.5rem;
    font-weight: 400;
    color: #34d399;
    margin-bottom: 6px;
  }

  .fm-stat-label {
    font-size: 13px;
    color: #9ca3af;
    line-height: 1.4;
  }

  .fm-section {
    padding: 5rem 3rem;
    max-width: 1100px;
    margin: 0 auto;
  }

  .fm-section-tag {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #059669;
    margin-bottom: 0.75rem;
  }

  .fm-section h2 {
    font-family: 'Fraunces', serif;
    font-size: 2.25rem;
    font-weight: 300;
    line-height: 1.25;
    color: #111827;
    margin-bottom: 1rem;
    max-width: 500px;
  }

  .fm-section h2 em { font-style: italic; color: #059669; }

  .fm-section-sub {
    font-size: 1rem;
    color: #6b7280;
    line-height: 1.7;
    max-width: 520px;
    margin-bottom: 3rem;
  }

  .fm-how-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .fm-how-card {
    padding: 1.75rem;
    background: #f9fafb;
    border-radius: 14px;
    border: 1px solid #f0f0f0;
  }

  .fm-how-num {
    font-family: 'Fraunces', serif;
    font-size: 2rem;
    font-weight: 300;
    color: #d1fae5;
    margin-bottom: 1rem;
    -webkit-text-stroke: 1px #059669;
  }

  .fm-how-title {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .fm-how-desc {
    font-size: 14px;
    color: #6b7280;
    line-height: 1.6;
  }

  .fm-methodology {
    background: #f9fafb;
    padding: 5rem 3rem;
    border-top: 1px solid #f0f0f0;
    border-bottom: 1px solid #f0f0f0;
  }

  .fm-methodology-inner {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5rem;
    align-items: center;
  }

  .fm-score-weights {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .fm-weight-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .fm-weight-label {
    font-size: 14px;
    color: #374151;
    font-weight: 500;
    width: 110px;
    flex-shrink: 0;
  }

  .fm-weight-track {
    flex: 1;
    height: 8px;
    background: #e5e7eb;
    border-radius: 100px;
    overflow: hidden;
  }

  .fm-weight-fill {
    height: 100%;
    border-radius: 100px;
    background: #059669;
  }

  .fm-weight-pct {
    font-size: 13px;
    font-weight: 600;
    color: #059669;
    width: 36px;
    text-align: right;
    flex-shrink: 0;
  }

  .fm-users {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-top: 0;
  }

  .fm-user-card {
    padding: 2rem;
    border-radius: 14px;
    border: 1px solid #e5e7eb;
    background: #fff;
  }

  .fm-user-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: #ecfdf5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-bottom: 1rem;
  }

  .fm-user-title {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  .fm-user-desc {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.6;
  }

  .fm-cta-section {
    padding: 6rem 3rem;
    text-align: center;
    max-width: 700px;
    margin: 0 auto;
  }

  .fm-cta-section h2 {
    font-family: 'Fraunces', serif;
    font-size: 2.75rem;
    font-weight: 300;
    color: #111827;
    line-height: 1.2;
    margin-bottom: 1rem;
  }

  .fm-cta-section h2 em { font-style: italic; color: #059669; }

  .fm-cta-section p {
    font-size: 1rem;
    color: #6b7280;
    line-height: 1.7;
    margin-bottom: 2.5rem;
  }

  .fm-footer {
    padding: 2rem 3rem;
    border-top: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .fm-footer-copy {
    font-size: 13px;
    color: #9ca3af;
  }

  .fm-footer-sources {
    font-size: 12px;
    color: #9ca3af;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .fm-animate { animation: fadeUp 0.6s ease both; }
  .fm-delay-1 { animation-delay: 0.1s; }
  .fm-delay-2 { animation-delay: 0.2s; }
  .fm-delay-3 { animation-delay: 0.3s; }
`;



export default function HomePage({ onEnter }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fm-home">
      <style>{styles}</style>

      {/* Nav */}
      <nav className="fm-nav">
        <div className="fm-logo">
          <span style={{ fontSize: "24px" }}>🍃</span>
          FoodMap
        </div>
        <button className="fm-nav-cta" onClick={onEnter}>
          Open Dashboard →
        </button>
      </nav>

      {/* Hero */}
      <section style={{ background: "#fff" }}>
        <div className="fm-hero">
          <div className="fm-animate">
            <div className="fm-tag">
              <div className="fm-tag-dot" />
              Food Access Intelligence
            </div>
            <h1>
              Where your community <em>gets</em> its food
            </h1>
            <p>
              FoodMap is an open-access tool that cross-references live U.S. Census poverty data with active SNAP and pantry registries to highlight high-need food deserts. Built to help organizers target outreach and secure grants. 100% free to use.
            </p>
            <div className="fm-hero-actions">
              <button className="fm-btn-primary" onClick={onEnter}>
                Explore your area
              </button>
              <button
                className="fm-btn-secondary"
                onClick={() =>
                  document
                    .getElementById("methodology")
                    .scrollIntoView({ behavior: "smooth" })
                }
              >
                How logistics work
              </button>
            </div>
          </div>

          {/* Mini dashboard preview */}
          <div className="fm-hero-visual fm-animate fm-delay-2">
            <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "12px", border: "1px solid #f0f0f0", marginBottom: "1rem" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: "0.75rem" }}>
                Mobility Tier Status · Far Rockaway, NY
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#d97706" }} />
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#111827" }}>Transit/Vehicle Reliant</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #f0f0f0" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>Nearest Food</div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>Nearest store is 1.2 miles away (~24 mins walk).</div>
                </div>
                <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #f0f0f0" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>SNAP Coverage</div>
                  <div style={{ fontSize: "13px", color: "#6b7280" }}>45% of nearby food resources accept EBT cards.</div>
                </div>
              </div>
            </div>
            <div className="fm-mini-chips">
              <div className="fm-chip">
                <div className="fm-chip-dot" style={{ background: "#059669" }} />
                2 Markets
              </div>
              <div className="fm-chip">
                <div className="fm-chip-dot" style={{ background: "#2563eb" }} />
                4 Pantries
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="fm-stats">
        <div className="fm-stats-inner">
          <div className="fm-stat">
            <div className="fm-stat-number">200k+</div>
            <div className="fm-stat-label">SNAP retailers from USDA registry</div>
          </div>
          <div className="fm-stat">
            <div className="fm-stat-number">50</div>
            <div className="fm-stat-label">States covered across the US</div>
          </div>
          <div className="fm-stat">
            <div className="fm-stat-number">4</div>
            <div className="fm-stat-label">Data sources cross-referenced, including live U.S. Census Bureau Demographics.</div>
          </div>
          <div className="fm-stat">
            <div className="fm-stat-number">Real‑time</div>
            <div className="fm-stat-label">Live OpenStreetMap data</div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="fm-section">
        <div className="fm-section-tag">How it works</div>
        <h2>
          Three steps to understanding <em>food access</em>
        </h2>
        <p className="fm-section-sub">
          Enter any US zip code or city and FoodMap pulls live data from
          government registries and OpenStreetMap to give you a complete
          picture within seconds.
        </p>
        <div className="fm-how-grid">
          {[
            {
              n: "01",
              title: "Search any location",
              desc: "Enter a zip code, neighborhood, or city name. FoodMap pins you to the right place every time.",
            },
            {
              n: "02",
              title: "See what's nearby",
              desc: "Grocery markets, food pantries, and SNAP-authorized retailers appear on the map within a 5-mile radius.",
            },
            {
              n: "03",
              title: "Identify Critical Gaps",
              desc: "Switch to the Executive Report to reveal accessible, color-coded census tracts that instantly highlight high-poverty zones with zero food resources.",
            },
          ].map((s) => (
            <div className="fm-how-card" key={s.n}>
              <div className="fm-how-num">{s.n}</div>
              <div className="fm-how-title">{s.title}</div>
              <div className="fm-how-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology */}
      <div className="fm-methodology" id="methodology">
        <div className="fm-methodology-inner">
          <div>
            <div className="fm-section-tag">Travel & Time Logistics</div>
            <h2 style={{ marginBottom: "1rem" }}>
              Measuring <em>real-world</em> transit burdens
            </h2>
            <p style={{ fontSize: "0.95rem", color: "#6b7280", lineHeight: 1.7, marginBottom: "2rem" }}>
              We've replaced abstract scoring systems with concrete, real-world logistics. FoodMap categorizes neighborhoods by estimating exact walking times to the nearest market, tracking explicit counts of emergency pantries, and calculating the percentage of locations accepting EBT—giving organizers the exact metrics needed to measure transit strain.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ padding: "16px", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>🟢 Highly Walkable Access</div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>A grocery resource is available within a 10-minute walk (≤ 0.5 miles).</div>
              </div>
              <div style={{ padding: "16px", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>🟠 Transit/Vehicle Reliant</div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>Stores require transit or a lengthy walk of up to 30 minutes (0.5 - 1.5 miles).</div>
              </div>
              <div style={{ padding: "16px", background: "#fff", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>🔴 Severe Transit Burden</div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>Food sources are far outside walkable ranges ({">"} 1.5 miles), imposing high strain.</div>
              </div>
            </div>
          </div>

          <div>
            <div className="fm-section-tag" style={{ marginBottom: "1rem" }}>
              Who uses FoodMap
            </div>
            <div className="fm-users">
              {[
                {
                  icon: "🤝",
                  title: "Nonprofits & Organizers",
                  desc: "Identify critical gap zones, optimize mobile food pantries, and export data-backed maps for grant applications.",
                },
                {
                  icon: "🏛️",
                  title: "City officials",
                  desc: "Identify underserved zip codes and make the case for resource investment.",
                },
                {
                  icon: "🏘️",
                  title: "Community members",
                  desc: "Find the closest open grocery store, pantry, or SNAP retailer near home.",
                },
                {
                  icon: "🔬",
                  title: "Researchers",
                  desc: "Analyze food environment data across neighborhoods, boroughs, and cities.",
                },
              ].map((u) => (
                <div className="fm-user-card" key={u.title}>
                  <div className="fm-user-icon">{u.icon}</div>
                  <div className="fm-user-title">{u.title}</div>
                  <div className="fm-user-desc">{u.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="fm-cta-section">
        <h2>
          Start with your <em>own</em> neighborhood
        </h2>
        <p>
          Enter your zip code and see your community's food access score in
          seconds. No signup required.
        </p>
        <button className="fm-btn-primary" onClick={onEnter}>
          Open FoodMap →
        </button>
      </div>

      {/* Footer */}
      <footer className="fm-footer">
        <div className="fm-logo">
          <span style={{ fontSize: "24px" }}>🍃</span>
          FoodMap
        </div>
        <div className="fm-footer-sources">
          Data: USDA FNS · OpenStreetMap · Nominatim
        </div>
        <div className="fm-footer-copy">Built for communities.</div>
      </footer>
    </div>
  );
}
