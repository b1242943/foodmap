import React, { useState } from 'react';
import { useMapStore } from '../store/useMapStore';

export default function NearMeButton() {
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const setSearchQuery = useMapStore((state) => state.setSearchQuery);
  const setActiveView = useMapStore((state) => state.setActiveView);

  const handleNearMe = () => {
    setErrorMsg("");
    setIsLoading(true);
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation not supported by this browser. Please use the search bar.");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setActiveView("Dashboard");
        setSearchQuery(`${latitude}, ${longitude}`);
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMsg("Location access denied. Please use the search bar.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setErrorMsg("Location information unavailable. Please use the search bar.");
        } else if (error.code === error.TIMEOUT) {
          setErrorMsg("Location request timed out. Please use the search bar.");
        } else {
          setErrorMsg("An unknown error occurred. Please use the search bar.");
        }
        
        // Auto-hide error after 5 seconds
        setTimeout(() => setErrorMsg(""), 5000);
      },
      { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button 
        onClick={handleNearMe}
        disabled={isLoading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 20px',
          height: '52px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
          backgroundColor: 'transparent',
          border: '3px solid var(--text-primary)',
          borderRadius: 'var(--border-radius)',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap'
        }}
        onMouseOver={(e) => {
          if (!isLoading) {
            e.currentTarget.style.backgroundColor = 'var(--text-primary)';
            e.currentTarget.style.color = 'var(--bg-primary)';
          }
        }}
        onMouseOut={(e) => {
          if (!isLoading) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        aria-label="Find resources near my location"
      >
        <span aria-hidden="true" style={{ fontSize: '20px' }}>📍</span> 
        {isLoading ? "Locating..." : "Near Me"}
      </button>
      {errorMsg && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          padding: '12px 16px',
          backgroundColor: 'var(--color-desert)',
          color: 'white',
          fontSize: '14px',
          fontWeight: 'bold',
          borderRadius: 'var(--border-radius)',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          boxShadow: 'var(--shadow-md)',
          border: '2px solid #b91c1c'
        }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
