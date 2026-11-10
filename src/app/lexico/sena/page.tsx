import type { Metadata } from "next";
import { Suspense } from "react";
import CargaFicha from "@/components/lexico/CargaFicha";

export const metadata: Metadata = {
  title: "Seña · Léxico de la LSM",
};

/**
 * /lexico/sena?id=wsl-448 — una sola página estática; la ficha llega del
 * archivo public/lexico/e/<id>.json (ver publish-tracks.mjs).
 */
export default function SenaPage() {
  return (
    <Suspense fallback={null}>
      <CargaFicha />
    </Suspense>
  );
}
