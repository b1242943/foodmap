import React from 'react';
import '../styles/ResourceDetailModal.css';

const TYPE_COLORS = {
  markets: "var(--color-market)",
  pantries: "var(--color-pantry)",
  snap: "var(--color-snap)",
  desert: "var(--color-desert)",
};

const TYPE_LABELS = {
  markets: "Grocery Market",
  pantries: "Food Pantry",
  snap: "SNAP / EBT Retailer",
  desert: "Food Desert",
};

export default function ResourceDetailModal({ resource, onClose }) {
  if (!resource) return null;

  const { name, detail, distance, type, phone, hours, attributes, source, website, organization } = resource;
  const color = TYPE_COLORS[type] || "var(--text-secondary)";
  const label = TYPE_LABELS[type] || "Unknown";

  const handleDirections = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (detail || ''))}`;
    window.open(url, '_blank');
  };

  return (
    <div className="resource-modal-overlay" onClick={onClose}>
      <div className="resource-modal" onClick={e => e.stopPropagation()}>
        <div className="resource-modal__header">
          <div className="resource-modal__title-group">
            <h2 className="resource-modal__title">{name}</h2>
            {source === 'feeding_america' ? (
              <div style={{ display: "inline-block", fontSize: "12px", fontWeight: 700, color: "white", padding: "4px 8px", borderRadius: 100, border: "1px solid #F7941D", background: "#F7941D", marginTop: 8, width: "fit-content" }}>
                Food Insecurity Help - Feeding America
              </div>
            ) : (
              <div style={{ display: "inline-block", fontSize: "12px", fontWeight: 600, color, padding: "4px 8px", borderRadius: 100, border: `1px solid ${color}40`, background: `${color}15`, marginTop: 8, width: "fit-content" }}>
                {label}
              </div>
            )}
          </div>
          <button className="resource-modal__close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="resource-modal__content">
          <div className="resource-modal__section">
            <span className="resource-modal__label">Address</span>
            <span className="resource-modal__value">{detail || 'Address not available'}</span>
            {distance && <span className="resource-modal__value" style={{ color: "var(--text-muted)", fontSize: "14px" }}>{distance} miles away</span>}
          </div>

          {(phone || hours) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {phone && (
                <div className="resource-modal__section">
                  <span className="resource-modal__label">Phone</span>
                  <a href={`tel:${phone}`} className="resource-modal__link">{phone}</a>
                </div>
              )}
              {hours && (
                <div className="resource-modal__section">
                  <span className="resource-modal__label">Hours</span>
                  <span className="resource-modal__value">{hours}</span>
                </div>
              )}
            </div>
          )}

          {organization && (
            <div className="resource-modal__section">
              <span className="resource-modal__label">Organization</span>
              <span className="resource-modal__value" style={{ fontWeight: 600 }}>{organization}</span>
            </div>
          )}
          
          {website && (
            <div className="resource-modal__section">
              <span className="resource-modal__label">Website</span>
              <a href={website} target="_blank" rel="noreferrer" className="resource-modal__link">Visit Website</a>
            </div>
          )}

          {attributes && attributes.length > 0 && (
            <div className="resource-modal__section">
              <span className="resource-modal__label">{source === 'feeding_america' ? 'Services' : 'Additional Details'}</span>
              <div className="resource-modal__badges">
                {attributes.map((attr, idx) => (
                  <span key={idx} className="resource-modal__badge">
                    {source === 'feeding_america' ? `✓ ${attr}` : attr}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            {source === 'feeding_america' ? (
              <button 
                onClick={() => website ? window.open(website, '_blank') : window.open(`tel:${phone}`, '_self')}
                style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700, color: "white", background: "#F7941D", border: "none", borderRadius: "var(--border-radius)", cursor: "pointer" }}
              >
                Get Help / Find Local Programs
              </button>
            ) : (
              <button 
                onClick={handleDirections}
                style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 700, color: "var(--bg-primary)", background: "var(--text-primary)", border: "none", borderRadius: "var(--border-radius)", cursor: "pointer" }}
              >
                Get Directions
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
