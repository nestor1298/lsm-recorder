"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import type { CMEntry } from "@/lib/types";
import { useActiveSection } from "@/hooks/useActiveSection";
import GlassPanel from "@/components/learn/GlassPanel";
import ChannelNav from "@/components/learn/ChannelNav";
import CMControls from "@/components/learn/CMControls";
import ORControls from "@/components/learn/ORControls";
import UBControls from "@/components/learn/UBControls";
import MVControls from "@/components/learn/MVControls";
import RNMControls from "@/components/learn/RNMControls";

// Single 3D viewer — no SSR, shared across all channels
const Hand3DViewer = dynamic(() => import("@/components/Hand3D/Hand3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        <p className="text-sm text-indigo-300">Cargando modelo 3D...</p>
      </div>
    </div>
  ),
});

// ── Channel configuration ──────────────────────────────────────

const CHANNELS = [
  {
    id: "cm",
    label: "CM",
    fullName: "Configuración Manual",
    description:
      "El canal de configuración manual codifica qué dedos están seleccionados, su nivel de flexión (extendido, curvado, doblado o cerrado), la posición del pulgar, la separación entre dedos y las interacciones entre ellos. Cruz Aldrete (2008) documentó 101 configuraciones manuales distintas en la LSM.",
    color: "#4f46e5",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22V8M12 8l-3-6M12 8l3-6M7 16l-4-3M17 16l4-3" />
      </svg>
    ),
  },
  {
    id: "ub",
    label: "UB",
    fullName: "Ubicación",
    description:
      "El canal de ubicación especifica en qué parte del cuerpo se articula la seña. Las 80 ubicaciones documentadas abarcan 8 regiones corporales. Cada punto se codifica con una abreviatura de origen latino.",
    color: "#059669",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="5" r="3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="9" y1="22" x2="12" y2="16" />
        <line x1="15" y1="22" x2="12" y2="16" />
      </svg>
    ),
  },
  {
    id: "or",
    label: "OR",
    fullName: "Orientación",
    description:
      "La orientación describe la postura espacial de la mano: dirección de la palma y dirección de los dedos. Juntos definen 36 orientaciones posibles en el espacio 3D relativo al cuerpo del señante.",
    color: "#7c3aed",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4M6.34 6.34l2.83 2.83m5.66 5.66l2.83 2.83M17.66 6.34l-2.83 2.83M8.17 14.83l-2.83 2.83" />
      </svg>
    ),
  },
  {
    id: "mv",
    label: "MV",
    fullName: "Movimiento",
    description:
      "El movimiento describe cómo se desplaza la mano: contorno (trayectoria geométrica), movimientos locales (movimiento interno) y plano (dimensión espacial).",
    color: "#0284c7",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    id: "rnm",
    label: "RNM",
    fullName: "Rasgos No Manuales",
    description:
      "Los rasgos no manuales son expresiones faciales, movimientos de cabeza y posturas corporales que funcionan como morfemas gramaticales en la lengua de señas.",
    color: "#e11d48",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="10" r="7" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
        <path d="M9 13q3 2 6 0" />
      </svg>
    ),
  },
];

const SECTION_IDS = ["intro", "cm", "ub", "or", "mv", "rnm"];

// ── Main Page Component ─────────────────────────────────────────

export default function LearnPage() {
  // Channel state
  const [activeCM, setActiveCM] = useState<CMEntry | null>(null);
  const [activeOrientation, setActiveOrientation] = useState<{
    palm: string;
    fingers: string;
  }>({ palm: "FORWARD", fingers: "UP" });

  // Scroll-driven active section
  const activeChannel = useActiveSection(SECTION_IDS);

  // Stable callbacks
  const handleCMChange = useCallback((cm: CMEntry | null) => setActiveCM(cm), []);
  const handleOrientationChange = useCallback(
    (o: { palm: string; fingers: string }) => setActiveOrientation(o),
    [],
  );

  // Derive 3D hand props from active channel
  const hand3DProps = useMemo(() => {
    switch (activeChannel) {
      case "cm":
        return { cm: activeCM, orientation: undefined, autoRotate: !activeCM };
      case "or":
        return { cm: null, orientation: activeOrientation, autoRotate: false };
      default:
        return { cm: null, orientation: undefined, autoRotate: true };
    }
  }, [activeChannel, activeCM, activeOrientation]);

  // Scroll to section
  const scrollToSection = useCallback((id: string) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8">
      {/* ─── Layer 0: Sticky 3D Background ─── */}
      <div className="sticky top-0 z-0 h-[40vh] w-full lg:h-screen">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-slate-900 to-violet-950">
          <Hand3DViewer
            cm={hand3DProps.cm}
            orientation={hand3DProps.orientation}
            autoRotate={hand3DProps.autoRotate}
            height="100%"
            className="rounded-none"
          />
        </div>
        {/* Gradient overlays for text contrast */}
        <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-black/50 via-black/20 to-transparent lg:block" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

        {/* Active channel indicator on 3D panel */}
        <div className="pointer-events-none absolute bottom-4 right-4 lg:bottom-8 lg:right-8">
          {activeChannel !== "intro" && (
            <div className="rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
              <span
                className="text-xs font-bold"
                style={{ color: CHANNELS.find((c) => c.id === activeChannel)?.color ?? "#fff" }}
              >
                {CHANNELS.find((c) => c.id === activeChannel)?.label ?? ""}
              </span>
              <span className="ml-2 text-xs text-white/60">
                {CHANNELS.find((c) => c.id === activeChannel)?.fullName ?? ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Layer 1: Scrollable Sections ─── */}
      <div className="learn-scroll-container relative z-10 -mt-[40vh] lg:-mt-[100vh]">
        {/* ── Intro Section ── */}
        <section
          id="section-intro"
          className="learn-section flex min-h-[60vh] items-center px-4 sm:px-6 lg:min-h-screen lg:px-8"
        >
          <div className="mx-auto w-full max-w-7xl">
            <div className="max-w-lg rounded-2xl bg-white/75 p-8 shadow-2xl backdrop-blur-xl border border-white/20 lg:bg-white/70">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-indigo-700">Referencia Interactiva</span>
              </div>
              <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
                Representación{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Fonológica
                </span>{" "}
                de la LSM
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                Una guía interactiva del sistema de notación fonológica de 5 canales para
                la Lengua de Señas Mexicana, basada en{" "}
                <b className="text-gray-800">Cruz Aldrete (2008)</b>.
              </p>

              {/* Channel quick-nav */}
              <div className="mt-6 flex flex-wrap gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => scrollToSection(ch.id)}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold tracking-wider transition-all hover:scale-105"
                    style={{
                      backgroundColor: `${ch.color}10`,
                      borderColor: `${ch.color}40`,
                      color: ch.color,
                    }}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>

              {/* Formula */}
              <div className="mt-6 rounded-lg bg-gray-900 px-4 py-2">
                <span className="font-mono text-xs font-bold text-emerald-400">
                  SEÑA = CM + UB + OR + MV + RNM
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Channel Sections ── */}
        {CHANNELS.map((ch) => (
          <section
            key={ch.id}
            id={`section-${ch.id}`}
            className="learn-section flex min-h-[70vh] items-start px-4 py-12 sm:px-6 lg:min-h-screen lg:items-center lg:px-8 lg:py-16"
          >
            <div className="mx-auto w-full max-w-7xl">
              <div className="w-full lg:max-w-xl">
                <GlassPanel
                  channelColor={ch.color}
                  channelLabel={ch.label}
                  channelName={ch.fullName}
                  description={ch.description}
                  icon={ch.icon}
                  isActive={activeChannel === ch.id}
                >
                  {ch.id === "cm" && <CMControls onCMChange={handleCMChange} />}
                  {ch.id === "ub" && <UBControls />}
                  {ch.id === "or" && <ORControls onOrientationChange={handleOrientationChange} />}
                  {ch.id === "mv" && <MVControls />}
                  {ch.id === "rnm" && <RNMControls />}
                </GlassPanel>
              </div>
            </div>
          </section>
        ))}

        {/* ── Reference / Credits Section (opaque) ── */}
        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-6 text-xl font-bold text-gray-900">Acerca de Esta Notación</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Fuente Primaria</h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  Cruz Aldrete, M. (2008). <i>Gramática de la Lengua de Señas Mexicana</i>.
                  Tesis doctoral, El Colegio de México. Capítulo 4: Representación fonológica
                  de las señas manuales.
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Formato LSM-PN</h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  LSM-PN (Notación Fonológica de LSM) es una extensión legible por máquinas del
                  marco de Cruz Aldrete, diseñada para procesamiento computacional manteniendo
                  la precisión lingüística.
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Cobertura</h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { n: "101", label: "Configuraciones" },
                    { n: "80", label: "Ubicaciones" },
                    { n: "36", label: "Orientaciones" },
                    { n: "5+11", label: "Tipos de mov." },
                    { n: "3", label: "Canales NM" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg bg-gray-50 px-3 py-2 shadow-sm">
                      <span className="text-lg font-bold text-indigo-600">{stat.n}</span>
                      <span className="ml-1.5 text-xs text-gray-500">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Proyecto</h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  SignaLab está construyendo el primer pipeline computacional para el análisis
                  fonológico de la LSM. Esta referencia interactiva ayuda a investigadores,
                  educadores y a la comunidad Sorda a comprender el sistema de notación.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ─── Layer 2: Fixed Navigation Dots ─── */}
      <ChannelNav
        channels={CHANNELS}
        activeChannel={activeChannel}
        onNavigate={scrollToSection}
      />
    </div>
  );
}
