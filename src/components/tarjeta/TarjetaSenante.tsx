"use client";

/**
 * TarjetaSenante — la tarjeta para compartir (1080 × 1350): apodo, el
 * círculo de nueve manos, las señas en las que eres una mano, los círculos
 * completos, tu atlas de la mano y tus sellos de ruta, y la marca LSM
 * CORPUS. Se dibuja en un canvas y se descarga como PNG; nunca lleva el
 * nombre real.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { GLIFOS_MARCA, LADO_MARCA } from "@/components/marca/lsm_corpus_glifos";
import { MANOS_POR_SENA } from "@/lib/nueve_manos";

export interface DatosTarjeta {
  apodo: string;
  videos: number;
  /** señas en las que eres una mano */
  senas: number;
  /** de esas, con sus nueve manos */
  completas: number;
  atlas: { tuyas: number; total: number };
  sellos: { tuyos: number; total: number };
}

const W = 1080;
const H = 1350;
const COLORES = {
  ink: "#0b0b0c",
  paper: "#ffffff",
  gray500: "#75757e",
  gray200: "#e4e4e8",
  gray50: "#f8f8f9",
  accent: "#2b5bf7",
  magenta: "#e0379b",
  gold: "#ffb81c",
  green: "#00a878",
  coral: "#ff5a3c",
};
const FUENTE = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace';

function redondeado(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function marcaLSM(c: CanvasRenderingContext2D, x: number, y: number, lado: number) {
  // tarjeta blanca con los glifos gruesos en verde, como la marca compacta
  c.save();
  redondeado(c, x, y, lado, lado, lado * 0.1);
  c.fillStyle = COLORES.paper;
  c.fill();
  c.strokeStyle = COLORES.gray200;
  c.lineWidth = 2;
  c.stroke();
  c.translate(x, y);
  c.scale(lado / LADO_MARCA, lado / LADO_MARCA);
  c.fillStyle = COLORES.green;
  for (const g of GLIFOS_MARCA) {
    for (const d of g.fina) c.fill(new Path2D(d));
  }
  c.restore();
}

export function dibujarTarjeta(canvas: HTMLCanvasElement, d: DatosTarjeta) {
  const c = canvas.getContext("2d");
  if (!c) return;
  canvas.width = W;
  canvas.height = H;

  // papel
  c.fillStyle = COLORES.paper;
  c.fillRect(0, 0, W, H);
  // franja espectro
  const franja = [COLORES.accent, COLORES.magenta, COLORES.gold, COLORES.green, COLORES.coral];
  franja.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect((W / 5) * i, 0, W / 5, 14);
  });

  // cabecera
  c.fillStyle = COLORES.gray500;
  c.font = `500 26px ${MONO}`;
  c.textBaseline = "top";
  c.fillText("SIGNALAB · TARJETA DE SEÑANTE", 80, 70);
  marcaLSM(c, W - 80 - 200, 60, 200);

  // apodo
  c.fillStyle = COLORES.ink;
  c.font = `700 96px ${FUENTE}`;
  let apodo = d.apodo;
  while (c.measureText(apodo).width > W - 160 - 220 && apodo.length > 3) apodo = apodo.slice(0, -1);
  if (apodo !== d.apodo) apodo += "…";
  c.fillText(apodo, 80, 130);

  // el círculo de nueve manos, completo, a la derecha del texto
  const colores = [COLORES.accent, COLORES.magenta, COLORES.gold, COLORES.green, COLORES.coral];
  const cx = 80 + 70;
  const cy = 300 + 70;
  c.strokeStyle = COLORES.ink;
  c.lineWidth = 5;
  c.beginPath();
  c.arc(cx, cy, 56, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < MANOS_POR_SENA; i++) {
    const a = (-90 + (360 / MANOS_POR_SENA) * i) * (Math.PI / 180);
    c.beginPath();
    c.arc(cx + 56 * Math.cos(a), cy + 56 * Math.sin(a), 13, 0, Math.PI * 2);
    c.fillStyle = colores[i % colores.length];
    c.fill();
  }
  c.fillStyle = COLORES.ink;
  c.font = `700 44px ${FUENTE}`;
  c.fillText("Una de las nueve manos", 80 + 170, 318);
  c.fillStyle = COLORES.gray500;
  c.font = `400 30px ${FUENTE}`;
  c.fillText(`${d.videos} ${d.videos === 1 ? "video" : "videos"} en el corpus de la LSM`, 80 + 170, 378);

  // cifras
  const cifras: [string, string][] = [
    [String(d.senas), d.senas === 1 ? "seña con mi mano" : "señas con mi mano"],
    [String(d.completas), d.completas === 1 ? "círculo completo" : "círculos completos"],
    [`${d.atlas.tuyas}/${d.atlas.total}`, "atlas de la mano"],
    [`${d.sellos.tuyos}/${d.sellos.total}`, "sellos de ruta"],
  ];
  const top = 480;
  const alto = 180;
  const ancho = (W - 160 - 24) / 2;
  cifras.forEach(([n, etiqueta], i) => {
    const x = 80 + (i % 2) * (ancho + 24);
    const y = top + Math.floor(i / 2) * (alto + 24);
    redondeado(c, x, y, ancho, alto, 28);
    c.fillStyle = COLORES.gray50;
    c.fill();
    c.fillStyle = COLORES.ink;
    c.font = `700 80px ${FUENTE}`;
    c.fillText(n, x + 36, y + 28);
    c.fillStyle = COLORES.gray500;
    c.font = `500 30px ${FUENTE}`;
    c.fillText(etiqueta, x + 36, y + 124);
  });

  // mensaje
  c.fillStyle = COLORES.ink;
  c.font = `700 56px ${FUENTE}`;
  c.fillText("Cada seña busca nueve manos.", 80, 940);
  c.fillText("Yo soy una.", 80, 1008);
  c.fillStyle = COLORES.gray500;
  c.font = `400 34px ${FUENTE}`;
  c.fillText("El corpus de la LSM, seña por seña, con la comunidad sorda:", 80, 1090);
  c.fillText("para investigar, enseñar y jugar.", 80, 1134);

  // pie
  c.fillStyle = COLORES.gray200;
  c.fillRect(80, 1210, W - 160, 2);
  c.fillStyle = COLORES.ink;
  c.font = `600 34px ${FUENTE}`;
  c.fillText("signalab.other-ai.com", 80, 1240);
  c.fillStyle = COLORES.gray500;
  c.font = `400 30px ${FUENTE}`;
  const otherai = "OtherAI";
  c.fillText(otherai, W - 80 - c.measureText(otherai).width, 1242);
}

export default function TarjetaSenante({ datos }: { datos: DatosTarjeta }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Solo se monta con datos ya cargados (cliente), así que navigator existe.
  const [puedeCompartir] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dibujar = () => dibujarTarjeta(canvas, datos);
    dibujar();
    // vuelve a dibujar cuando carguen las fuentes del sistema
    document.fonts?.ready.then(dibujar).catch(() => {});
  }, [datos]);

  const aBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        canvasRef.current?.toBlob((b) => resolve(b), "image/png");
      }),
    [],
  );

  const descargar = useCallback(async () => {
    const blob = await aBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signalab-${datos.apodo.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [aBlob, datos.apodo]);

  const compartir = useCallback(async () => {
    const blob = await aBlob();
    if (!blob) return;
    const archivo = new File([blob], "signalab-tarjeta.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          title: "Mi tarjeta de señante",
          text: "Cada seña de la LSM busca nueve manos. Yo soy una, en SignaLab.",
        });
      } else await descargar();
    } catch {
      // la persona canceló: no pasa nada
    }
  }, [aBlob, descargar]);

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full rounded-2xl border border-gray-200 shadow-raised"
        style={{ aspectRatio: `${W} / ${H}` }}
        role="img"
        aria-label={`Tarjeta de señante de ${datos.apodo}: mano de ${datos.senas} señas, ${datos.completas} círculos completos, atlas ${datos.atlas.tuyas} de ${datos.atlas.total}, ${datos.sellos.tuyos} sellos de ruta`}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void descargar()}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper hover:bg-gray-800"
        >
          Descargar PNG
        </button>
        {puedeCompartir && (
          <button
            type="button"
            onClick={() => void compartir()}
            className="rounded-full border-[1.5px] border-gray-300 px-6 py-2.5 text-sm font-semibold text-ink hover:border-ink"
          >
            Compartir
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">Lleva tu apodo, nunca tu nombre.</p>
    </div>
  );
}
