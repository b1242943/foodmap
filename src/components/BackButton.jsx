import React from 'react';

export default function BackButton({ onReturn }) {
  return (
    <button 
      onClick={onReturn}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: 'bold',
        color: 'var(--bg-primary)',
        backgroundColor: 'var(--text-primary)',
        border: '2px solid var(--text-primary)',
        borderRadius: 'var(--border-radius)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease-in-out',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--text-secondary)';
        e.currentTarget.style.borderColor = 'var(--text-secondary)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--text-primary)';
        e.currentTarget.style.borderColor = 'var(--text-primary)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      aria-label="Return to Home"
    >
      <span aria-hidden="true" style={{ fontSize: '18px', lineHeight: 1 }}>&larr;</span> Return
    </button>
  );
}
