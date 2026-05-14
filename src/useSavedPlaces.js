// useSavedPlaces.js — Manage saved places in localStorage
import { useState } from "react";

export function useSavedPlaces() {
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mad_saves") || "[]");
    } catch { return []; }
  });

  const toggle = (place) => {
    setSaved(prev => {
      const exists = prev.find(p => p.id === place.id);
      const next = exists ? prev.filter(p => p.id !== place.id) : [...prev, place];
      localStorage.setItem("mad_saves", JSON.stringify(next));
      return next;
    });
  };

  const isSaved = (id) => saved.some(p => p.id === id);
  const clear   = () => { setSaved([]); localStorage.removeItem("mad_saves"); };

  return { saved, toggle, isSaved, clear };
}