import React from 'react';
import '../styles/ScoreDetailModal.css';

function BreakdownFactor({ label, val, color }) {
  return (
    <div className="breakdown-factor">
      <div className="breakdown-factor__label">{label}</div>
      <div className="breakdown-factor__track">
        <div className="breakdown-factor__fill" style={{ width: `${val}%`, background: color }} />
      </div>
      <div className="breakdown-factor__val" style={{ color }}>{val}</div>
    </div>
  );
}

export default function ScoreDetailModal({ isOpen, score, bars, onClose }) {
  if (!isOpen) return null;
  
  return (
    <div className="score-modal-overlay" onClick={onClose}>
      <div className="score-modal" onClick={e => e.stopPropagation()}>
        <div className="score-modal__header">
          <h2>Score Breakdown</h2>
          <button className="score-modal__close" onClick={onClose}>&times;</button>
        </div>
        <div className="score-modal__content">
          <p className="score-modal__desc">
            Food access isn't just about how many stores are nearby. We weigh proximity, variety, affordability, and transit into a single composite score.
          </p>
          <div className="score-modal__factors">
            {bars && Object.entries(bars).map(([label, { val, color }]) => (
              <BreakdownFactor key={label} label={label} val={val} color={color} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
