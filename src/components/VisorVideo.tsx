"use client";

/**
 * VisorVideo — reproductor que se adapta a CUALQUIER proporción del
 * video (vertical, horizontal, cuadrado) leyendo su tamaño real, y que
 * la persona puede redimensionar arrastrando la esquina. El overlay de
 * esqueleto se alinea exacto porque el contenedor toma la misma
 * relación de aspecto que el video (sin franjas negras).
 */

import { useCallback, useState } from "react";
import EsqueletoOverlay from "./EsqueletoOverlay";

interface VisorVideoProps {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** espejo horizontal (grabaciones con cámara frontal) */
  mirrored?: boolean;
  /** dibuja el esqueleto detectado encima */
  overlay?: boolean;
}

export default function VisorVideo({
  src,
  videoRef,
  mirrored = false,
  overlay = true,
}: VisorVideoProps) {
  const [ratio, setRatio] = useState<number | null>(null);

  const onMeta = useCallback(() => {
    const v = videoRef.current;
    if (v?.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
  }, [videoRef]);

  const vertical = ratio !== null && ratio < 1;

  return (
    <div className="space-y-1">
      <div
        className="resize-x overflow-auto"
        style={{
          // el ancho arranca acorde a la orientación y la persona lo
          // ajusta arrastrando la esquina inferior derecha
          width: vertical ? "min(62%, 420px)" : "100%",
          minWidth: "38%",
          maxWidth: "100%",
        }}
      >
        <div
          className="relative overflow-hidden rounded-xl border border-gray-200 bg-black"
          style={{ aspectRatio: ratio ?? 16 / 9, maxHeight: "70vh" }}
        >
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            onLoadedMetadata={onMeta}
            className="absolute inset-0 h-full w-full"
            style={mirrored ? { transform: "scaleX(-1)" } : undefined}
          />
          {overlay && (
            <EsqueletoOverlay videoRef={videoRef} mirrored={mirrored} />
          )}
        </div>
      </div>
      <p className="text-[10px] text-gray-400">
        {ratio
          ? `Video ${vertical ? "vertical" : ratio === 1 ? "cuadrado" : "horizontal"} · arrastra la esquina para ajustar el tamaño`
          : "Arrastra la esquina para ajustar el tamaño"}
      </p>
    </div>
  );
}
