import type { Metadata } from "next";
import PanoramaLexico from "@/components/lexico/PanoramaLexico";
import { allEntries, paginasFuente } from "@/lib/lexicon/catalog";
import { panorama } from "@/lib/lexicon/panorama";

export const metadata: Metadata = {
  title: "Panorama del léxico · Léxico de la LSM",
  description: "Las características del léxico de la LSM en conjunto: tamaño, forma de la mano, lugar, orientación, movimiento, manos, cara y calidad.",
};

/** Estática: se calcula al construir; el navegador recibe solo HTML */
export default function PanoramaPage() {
  return <PanoramaLexico p={panorama(allEntries(), paginasFuente())} />;
}
