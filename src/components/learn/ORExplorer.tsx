"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const Hand3DViewer = dynamic(
  () => import("@/components/Hand3D/Hand3DViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-2xl bg-gradient-to-b from-violet-950/80 to-gray-950">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          <p className="text-xs text-violet-300">Cargando modelo 3D…</p>
        </div>
      </div>
    ),
  },
);

type PalmFacing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT";
type FingerPointing = "UP" | "DOWN" | "FORWARD" | "BACK" | "LEFT" | "RIGHT";

interface OrientationState {
  palm: PalmFacing;
  fingers: FingerPointing;
}

const PALM_DIRECTIONS: { value: PalmFacing; label: string; icon: string }[] = [
  { value: "UP", label: "Arriba", icon: "↑" },
  { value: "DOWN", label: "Abajo", icon: "↓" },
  { value: "FORWARD", label: "Frente", icon: "→" },
  { value: "BACK", label: "Atrás", icon: "←" },
  { value: "LEFT", label: "Izquierda", icon: "←" },
  { value: "RIGHT", label: "Derecha", icon: "→" },
];

const FINGER_DIRECTIONS: { value: FingerPointing; label: string; icon: string }[] = [
  { value: "UP", label: "Arriba", icon: "↑" },
  { value: "DOWN", label: "Abajo", icon: "↓" },
  { value: "FORWARD", label: "Frente", icon: "↗" },
  { value: "BACK", label: "Atrás", icon: "↙" },
  { value: "LEFT", label: "Izquierda", icon: "←" },
  { value: "RIGHT", label: "Derecha", icon: "→" },
];

/** Spanish labels for palm/finger directions */
const PALM_LABEL: Record<PalmFacing, string> = {
  UP: "arriba", DOWN: "abajo", FORWARD: "frente", BACK: "atrás", LEFT: "izquierda", RIGHT: "derecha",
};
const FINGER_LABEL: Record<FingerPointing, string> = {
  UP: "arriba", DOWN: "abajo", FORWARD: "frente", BACK: "atrás", LEFT: "izquierda", RIGHT: "derecha",
};

export default function ORExplorer() {
  const [orientation, setOrientation] = useState<OrientationState>({
    palm: "FORWARD",
    fingers: "UP",
  });

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="rounded-xl bg-violet-50 p-3">
        <p className="text-xs leading-relaxed text-violet-700">
          La orientación describe <b>hacia dónde mira la palma</b> y <b>hacia dónde apuntan los dedos</b>.
          Estos dos parámetros definen la orientación espacial de la mano en 3D relativa al cuerpo del señante.
        </p>
      </div>

      {/* Mobile: 3D hand on top */}
      <div className="md:hidden">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-violet-950/80 to-gray-950">
          <Hand3DViewer
            cm={null}
            orientation={{ palm: orientation.palm, fingers: orientation.fingers }}
            autoRotate={false}
            height="280px"
          />
          {/* Orientation info overlay */}
          <div className="border-t border-violet-800/30 bg-black/40 px-4 py-2 text-center">
            <span className="text-xs text-violet-300/80">
              Palma: <b className="text-violet-200">{PALM_LABEL[orientation.palm]}</b>
              {" · "}
              Dedos: <b className="text-violet-200">{FINGER_LABEL[orientation.fingers]}</b>
            </span>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-gray-400">
          Arrastra para rotar el modelo 3D
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_340px]">
        {/* Controls */}
        <div className="space-y-4">
          {/* Palm facing */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Dirección de la Palma
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PALM_DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  onClick={() => setOrientation((o) => ({ ...o, palm: dir.value }))}
                  className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition-all ${
                    orientation.palm === dir.value
                      ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span className="text-lg">{dir.icon}</span>
                  <br />
                  {dir.label}
                </button>
              ))}
            </div>
          </div>

          {/* Finger pointing */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Dirección de los Dedos
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {FINGER_DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  onClick={() => setOrientation((o) => ({ ...o, fingers: dir.value }))}
                  className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition-all ${
                    orientation.fingers === dir.value
                      ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span className="text-lg">{dir.icon}</span>
                  <br />
                  {dir.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notation output */}
          <div className="rounded-xl bg-gray-900 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Notación LSM-PN
            </p>
            <p className="font-mono text-sm text-emerald-400">
              OR: palma={orientation.palm.toLowerCase()}, dedos={orientation.fingers.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Desktop: 3D hand panel (sticky right) */}
        <div className="hidden md:block">
          <div className="sticky top-24 space-y-2">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-violet-950/80 to-gray-950">
              <Hand3DViewer
                cm={null}
                orientation={{ palm: orientation.palm, fingers: orientation.fingers }}
                autoRotate={false}
                height="360px"
              />
              {/* Orientation info overlay */}
              <div className="border-t border-violet-800/30 bg-black/40 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-violet-300/80">
                    Palma: <b className="text-violet-200">{PALM_LABEL[orientation.palm]}</b>
                  </span>
                  <span className="text-xs text-violet-300/80">
                    Dedos: <b className="text-violet-200">{FINGER_LABEL[orientation.fingers]}</b>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-400">
              Arrastra para rotar el modelo 3D
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
