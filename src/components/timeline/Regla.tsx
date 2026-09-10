"use client";

/**
 * Regla — marcas de tiempo en canvas (un solo nodo, no uno por marca).
 * Paso adaptativo 1-2-5 × 10ⁿ ms con al menos 60 px entre etiquetas, y
 * marcas de cuadro cuando el acercamiento lo permite.
 */

import { useEffect, useRef } from "react";
import {
  ticks,
  tickStepMs,
  formatTick,
  timeToPx,
  type Viewport,
} from "@/lib/timeline/viewport";
import {
  FRAME_TICKS_BELOW_MS_PER_PX,
  ASSUMED_FPS,
} from "@/lib/timeline/constants";

interface ReglaProps {
  view: Viewport;
  widthPx: number;
  heightPx?: number;
  fps?: number;
}

export default function Regla({
  view,
  widthPx,
  heightPx = 26,
  fps = ASSUMED_FPS,
}: ReglaProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || widthPx <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(widthPx * dpr);
    cv.height = Math.round(heightPx * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, heightPx);

    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--color-ink").trim() || "#0B0B0C";
    const gris = "#9CA3AF";

    // Marcas de cuadro (solo muy de cerca): fondo tenue antes que todo.
    if (view.msPerPx <= FRAME_TICKS_BELOW_MS_PER_PX) {
      const f = 1000 / fps;
      ctx.strokeStyle = "#E5E7EB";
      ctx.lineWidth = 1;
      const primero = Math.ceil(view.startMs / f) * f;
      for (let t = primero; ; t += f) {
        const x = timeToPx(view, t);
        if (x > widthPx) break;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, heightPx - 6);
        ctx.lineTo(Math.round(x) + 0.5, heightPx);
        ctx.stroke();
      }
    }

    // Marcas principales con etiqueta.
    const step = tickStepMs(view.msPerPx);
    ctx.strokeStyle = gris;
    ctx.fillStyle = ink;
    ctx.font =
      "10px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.textBaseline = "top";
    for (const t of ticks(view, widthPx)) {
      const x = Math.round(timeToPx(view, t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, heightPx - 10);
      ctx.lineTo(x, heightPx);
      ctx.stroke();
      ctx.fillText(formatTick(t, view.msPerPx), x + 3, 2);
    }

    // Media marca entre etiquetas, para leer sin contar.
    ctx.strokeStyle = "#D1D5DB";
    const medio = step / 2;
    const primeroMedio = Math.ceil(view.startMs / medio) * medio;
    for (let t = primeroMedio; ; t += medio) {
      const x = timeToPx(view, t);
      if (x > widthPx) break;
      if (Math.abs((t / step) % 1) < 1e-6) continue;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, heightPx - 5);
      ctx.lineTo(Math.round(x) + 0.5, heightPx);
      ctx.stroke();
    }
  }, [view, widthPx, heightPx, fps]);

  return (
    <canvas
      ref={ref}
      style={{ width: widthPx, height: heightPx }}
      className="block"
      aria-hidden
    />
  );
}
