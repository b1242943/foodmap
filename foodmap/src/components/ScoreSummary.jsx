import React from 'react';
import '../styles/ScoreSummary.css';

export default function ScoreSummary({ score, onLearnMore }) {
  let label = "Loading";
  let color = "var(--text-muted)";
  
  if (score >= 80) { label = "High Access"; color = "var(--color-market)"; }
  else if (score >= 60) { label = "Moderate Access"; color = "var(--color-pantry)"; }
  else if (score >= 0) { label = "Food Desert"; color = "var(--color-desert)"; }

  return (
    <div className="score-summary">
      <div className="score-summary__main">
        <div className="score-summary__text" style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "16px", display: "flex", alignItems: "center", gap: 8 }}>
          ⭐ {score ?? '--'}/100 <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>-</span> <span style={{ color }}>{label}</span>
        </div>
      </div>
      <button className="score-summary__btn" onClick={onLearnMore} title="Score Breakdown" aria-label="View score breakdown">
        ?
      </button>
    </div>
  );
}
