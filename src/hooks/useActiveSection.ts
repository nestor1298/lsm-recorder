"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Tracks which section is closest to the viewport center.
 * Returns the ID (without the "section-" prefix).
 */
export function useActiveSection(sectionIds: string[]): string {
  const [active, setActive] = useState(sectionIds[0] ?? "");

  const update = useCallback(() => {
    const viewportMid = window.innerHeight / 2;
    let closest = sectionIds[0] ?? "";
    let closestDist = Infinity;

    for (const id of sectionIds) {
      const el = document.getElementById(`section-${id}`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const sectionMid = rect.top + rect.height / 2;
      const dist = Math.abs(sectionMid - viewportMid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = id;
      }
    }
    setActive(closest);
  }, [sectionIds]);

  useEffect(() => {
    let rafId: number;

    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // initial
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [update]);

  return active;
}
