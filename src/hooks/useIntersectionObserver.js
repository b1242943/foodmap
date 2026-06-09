import { useCallback, useRef } from "react";

export function useIntersectionObserver(callback) {
  const observerRef = useRef();

  const ref = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        callback();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [callback]);

  return ref;
}
