import type { Metadata } from "next";
import NavegadorLexico from "@/components/lexico/NavegadorLexico";
import { lexiconRows } from "@/lib/lexicon/catalog";

export const metadata: Metadata = {
  title: "Léxico de la LSM · SignaLab",
  description: "Señas del diccionario de Wikisigns con su descripción fonológica, esqueleto y cara.",
};

export default function LexicoPage() {
  return <NavegadorLexico rows={lexiconRows()} />;
}
