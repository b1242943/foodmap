import React from 'react';

// Shared styling constants
const TYPE_COLORS = {
  markets: "var(--color-market)",
  pantries: "var(--color-pantry)",
  snap: "var(--color-snap)",
  desert: "var(--color-desert)",
};

const TYPE_LABELS = {
  markets: "Grocery",
  pantries: "Pantry",
  snap: "SNAP/EBT",
  desert: "Desert",
};

export default function ResourceListItem({ resource, onSelectResource }) {
  const { name, detail, distance, type } = resource;
  const color = TYPE_COLORS[type] || "var(--text-secondary)";
  const label = TYPE_LABELS[type] || "Unknown";

  // Note: we can't easily rely on css vars for background alpha like we do in App.jsx 
  // since we didn't define color-market-light globally (wait, yes we did in index.css!).
  // Let's assume var(--color-{type}-light) exists if TYPE_COLORS match. 
  // But to be safe and match the current UI, I will just use a transparent background or rely on the CSS var if it exists.

  return (
    <div className="resource-item">
      <div className="resource-item__icon" style={{ background: color, boxShadow: `0 0 8px ${color}60` }} />
      <div className="resource-item__content">
        <div className="resource-item__name">{name}</div>
        <div className="resource-item__detail">{detail}</div>
        <div className="resource-item__actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button 
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (detail || ''))}`, '_blank')}
            style={{ padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: "var(--bg-primary)", background: "var(--text-primary)", border: "none", borderRadius: 4, cursor: "pointer" }}>Directions</button>
          <button 
            onClick={onSelectResource}
            style={{ padding: "4px 10px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 4, cursor: "pointer" }}>Details</button>
        </div>
      </div>
      <div className="resource-item__meta">
        {resource.source === 'feeding_america' ? (
          <div className="resource-item__type" style={{ background: '#F7941D', color: 'white', borderColor: '#F7941D' }}>
            Food Insecurity Help
          </div>
        ) : (
          <div className="resource-item__type" style={{ color, borderColor: `${color}40`, background: `${color}15` }}>
            {label}
          </div>
        )}
        {distance && <div className="resource-item__dist">{distance} mi</div>}
      </div>
    </div>
  );
}
