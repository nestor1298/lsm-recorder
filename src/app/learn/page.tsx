"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { CM_INVENTORY } from "@/lib/data";
import type { CMEntry } from "@/lib/types";
import ChannelCard from "@/components/learn/ChannelCard";
import CMExplorer from "@/components/learn/CMExplorer";
import UBExplorer from "@/components/learn/UBExplorer";
import ORExplorer from "@/components/learn/ORExplorer";
import MVExplorer from "@/components/learn/MVExplorer";
import RNMExplorer from "@/components/learn/RNMExplorer";

// Dynamic import for 3D component (no SSR)
const Hand3DViewer = dynamic(() => import("@/components/Hand3D/Hand3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl bg-gradient-to-b from-indigo-950 to-slate-900">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        <p className="text-sm text-indigo-300">Cargando modelo 3D...</p>
      </div>
    </div>
  ),
});

// Showcase CMs for hero cycling: open hand, O-shape, point, pinky, peace
const SHOWCASE_CM_IDS = [1, 8, 63, 80, 36];
const SHOWCASE_CMS = SHOWCASE_CM_IDS.map(
  (id) => CM_INVENTORY.find((cm) => cm.cm_id === id)!
).filter(Boolean);

/** Hook: cycle through showcase CMs every interval */
function useShowcaseCycle(intervalMs = 3000) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % SHOWCASE_CMS.length);
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [intervalMs]);

  return SHOWCASE_CMS[index] ?? null;
}

// Channel configuration
const CHANNELS = [
  {
    id: "cm",
    label: "CM",
    fullName: "Configuración Manual",
    description:
      "El canal de configuración manual codifica qué dedos están seleccionados, su nivel de flexión (extendido, curvado, doblado o cerrado), la posición del pulgar, la separación entre dedos y las interacciones entre ellos. Cruz Aldrete (2008) documentó 101 configuraciones manuales distintas en la Lengua de Señas Mexicana, organizadas en 4 niveles de frecuencia y 5 grupos de dedos. Cada configuración recibe un código numérico único (CM #1 – #101) y una notación fonológica descriptiva.",
    color: "#4f46e5",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22V8M12 8l-3-6M12 8l3-6M7 16l-4-3M17 16l4-3" />
      </svg>
    ),
  },
  {
    id: "ub",
    label: "UB",
    fullName: "Ubicación",
    description:
      "El canal de ubicación especifica en qué parte del cuerpo o cerca de él se articula una seña. Las 80 ubicaciones documentadas abarcan 8 regiones corporales: cabeza, cara, cuello, tronco, brazo, antebrazo, mano y espacio neutro. Cada punto se codifica con una abreviatura de origen latino (ej., «Fr» = frons/frente, «Pe» = pectus/pecho). Modificadores como «Ipsi» (mismo lado de la mano dominante) y «X» (contralateral) añaden precisión espacial.",
    color: "#059669",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
      "La orientación describe la postura espacial de la mano a través de dos parámetros independientes: la dirección de la palma (hacia dónde apunta la superficie palmar — arriba, abajo, al frente, atrás, izquierda o derecha) y la dirección de los dedos (hacia dónde apuntan los dedos extendidos). Juntos, definen 36 orientaciones posibles de la mano en el espacio 3D relativo al cuerpo del señante.",
    color: "#7c3aed",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4M6.34 6.34l2.83 2.83m5.66 5.66l2.83 2.83M17.66 6.34l-2.83 2.83M8.17 14.83l-2.83 2.83" />
      </svg>
    ),
  },
  {
    id: "mv",
    label: "MV",
    fullName: "Movimiento",
    description:
      "El movimiento es el canal dinámico que captura cómo se desplaza la mano a través del espacio de señas. Se descompone en tres sub-parámetros: contorno (la trayectoria geométrica — recto, arco, círculo, zigzag o forma de siete), movimientos locales (movimientos internos como meneo, giro o vibración) y el plano del movimiento (horizontal, vertical, sagital u oblicuo). El movimiento también puede llevar diacríticos fonológicos de velocidad, repetición y dirección.",
    color: "#0284c7",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    id: "rnm",
    label: "RNM",
    fullName: "Rasgos No Manuales",
    description:
      "Los rasgos no manuales son las expresiones faciales, movimientos de cabeza y posturas corporales que funcionan como morfemas gramaticales en la lengua de señas. Las cejas levantadas señalan preguntas de sí/no, las cejas fruncidas marcan preguntas QU-, y las inclinaciones de cabeza añaden significado condicional o topicalizado. Estos rasgos operan simultáneamente con las señas manuales y son esenciales para la completitud gramatical. En LSM, una seña manual sin su componente no manual correcto puede cambiar completamente de significado.",
    color: "#e11d48",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="10" r="7" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
        <path d="M9 13q3 2 6 0" />
      </svg>
    ),
  },
];

export default function LearnPage() {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const showcaseCM = useShowcaseCycle(3000);

  const toggleChannel = (id: string) => {
    setActiveChannel(activeChannel === id ? null : id);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950">
        <div className="grid items-center lg:grid-cols-2">
          {/* Text */}
          <div className="relative z-10 p-8 lg:p-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-indigo-200">Referencia Interactiva</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Representación<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Fonológica
              </span>
              <br />
              de la LSM
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-indigo-200/80">
              Una guía interactiva del sistema de notación fonológica de 5 canales para
              la Lengua de Señas Mexicana (LSM-PN), basada en el trabajo fundacional de
              <b className="text-indigo-100"> Cruz Aldrete (2008)</b>.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChannel(ch.id);
                    document.getElementById(`channel-${ch.id}`)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider text-white/90 transition-all hover:scale-105 hover:text-white"
                  style={{ backgroundColor: `${ch.color}50`, border: `1px solid ${ch.color}80` }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3D Model — cycling through showcase poses */}
          <div className="relative">
            <Hand3DViewer cm={showcaseCM} height="420px" autoRotate={false} />
            {/* CM label overlay */}
            {showcaseCM && (
              <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/40 px-3 py-1.5 backdrop-blur-sm">
                <span className="text-xs font-bold text-white/80">CM #{showcaseCM.cm_id}</span>
              </div>
            )}
            {/* Decorative glow */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-indigo-950/80 lg:block hidden" />
          </div>
        </div>

        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
      </section>

      {/* Overview section */}
      <section>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Los 5 Canales de LSM-PN
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500">
            Cada seña en la Lengua de Señas Mexicana se puede descomponer en 5 canales fonológicos
            simultáneos. Juntos, forman una descripción articulatoria completa que es tanto
            legible por humanos como procesable por máquinas.
          </p>
        </div>

        {/* Channel diagram */}
        <div className="mx-auto mb-10 max-w-3xl">
          <div className="relative rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6">
            {/* Center label */}
            <div className="mb-6 text-center">
              <span className="rounded-full bg-gray-900 px-4 py-1.5 text-xs font-bold text-white">
                SEÑA = CM + UB + OR + MV + RNM
              </span>
            </div>

            {/* Channel pills in a flow */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {CHANNELS.map((ch, i) => (
                <div key={ch.id} className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-2 rounded-xl px-4 py-3 shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: `${ch.color}10`, border: `2px solid ${ch.color}30` }}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: ch.color }}
                    >
                      <span className="text-xs font-bold">{ch.label}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{ch.fullName}</p>
                    </div>
                  </div>
                  {i < CHANNELS.length - 1 && (
                    <span className="text-lg font-light text-gray-300">+</span>
                  )}
                </div>
              ))}
            </div>

            {/* Temporal axis */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-300" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                  articulación simultánea en un eje temporal
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-300" />
              </div>
              <div className="mt-3 flex items-center gap-1">
                <div className="h-2 flex-1 rounded-l-full bg-blue-200" title="Preparación" />
                <div className="h-3 flex-[2] bg-indigo-400" title="Golpe" />
                <div className="h-2 flex-1 bg-violet-200" title="Detención" />
                <div className="h-2 flex-1 rounded-r-full bg-gray-200" title="Retracción" />
              </div>
              <div className="mt-1 flex text-[9px] text-gray-400">
                <span className="flex-1 text-center">P</span>
                <span className="flex-[2] text-center font-semibold text-indigo-600">Stroke</span>
                <span className="flex-1 text-center">H</span>
                <span className="flex-1 text-center">R</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Channel explorer cards */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Explora Cada Canal
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Haz clic en un canal para expandir su explorador interactivo
          </p>
        </div>

        <div className="space-y-4">
          {CHANNELS.map((ch) => (
            <div key={ch.id} id={`channel-${ch.id}`}>
              <ChannelCard
                id={ch.id}
                label={ch.label}
                fullName={ch.fullName}
                spanishName={ch.fullName}
                description={ch.description}
                color={ch.color}
                icon={ch.icon}
                isActive={activeChannel === ch.id}
                onToggle={() => toggleChannel(ch.id)}
              >
                {ch.id === "cm" && <CMExplorer />}
                {ch.id === "ub" && <UBExplorer />}
                {ch.id === "or" && <ORExplorer />}
                {ch.id === "mv" && <MVExplorer />}
                {ch.id === "rnm" && <RNMExplorer />}
              </ChannelCard>
            </div>
          ))}
        </div>
      </section>

      {/* Reference section */}
      <section className="rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 p-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Acerca de Esta Notación</h2>
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
              la precisión lingüística. Cada seña es un objeto JSON con campos tipados para
              los 5 canales.
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
                <div key={stat.label} className="rounded-lg bg-white px-3 py-2 shadow-sm">
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
              educadores y a la comunidad Sorda a comprender el sistema de notación utilizado
              para documentar y animar la Lengua de Señas Mexicana.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
