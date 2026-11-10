"use client";

/**
 * NavegadorLexico — buscar y filtrar las señas del léxico de Wikisigns.
 * Las filas llegan ya ligeras desde el servidor (catalog.ts); aquí solo
 * se filtran y se pintan, de a 60 para no cargar 2,000 tarjetas de golpe.
 */

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { CM_INVENTORY } from "@/lib/data";
import { MiniHand } from "@/components/learn/MiniHand";
import { ubName } from "@/lib/anotar_labels";
import {
  filtra,
  FILTROS_INICIALES,
  type BrowseFilters,
  type Lengua,
  type Lugar,
  type Manos,
} from "@/lib/lexicon/browse";
import type { LexiconRow } from "@/lib/lexicon/catalog";

const PAGINA = 60;

const LENGUAS: { id: Lengua; label: string }[] = [
  { id: "lsm", label: "LSM" },
  { id: "otras", label: "Otras lenguas" },
  { id: "todas", label: "Todas" },
];
const MANOS: { id: Manos; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "una", label: "Una mano" },
  { id: "dos", label: "Dos manos" },
];
const LUGARES: { id: Lugar; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "cara", label: "Cara y cabeza" },
  { id: "cuerpo", label: "Cuello y tronco" },
  { id: "brazo", label: "Brazo y mano" },
  { id: "neutro", label: "Espacio neutro" },
];

function Chips<T extends string>({
  titulo,
  opciones,
  valor,
  onChange,
}: {
  titulo: string;
  opciones: { id: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={titulo}>
      <p className="mb-1.5 text-xs font-medium overline-label text-gray-500">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={valor === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              valor === o.id ? "bg-ink text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const cmPorId = new Map(CM_INVENTORY.map((c) => [c.cm_id, c]));
const lugarNombre = (code: string | null) =>
  !code ? null : code === "EN" ? "Espacio neutro" : (ubName(code) ?? code);

function Tarjeta({ r }: { r: LexiconRow }) {
  const cm = r.cm !== null ? cmPorId.get(r.cm) : undefined;
  return (
    <Link
      href={`/lexico/sena?id=${r.id}`}
      className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-paper p-3 transition-all hover:border-gray-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center">
        {cm ? (
          <MiniHand cm={cm} size={44} />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400" aria-hidden>
            —
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-bold leading-tight text-ink group-hover:text-accent-deep">
          {r.gloss}
        </p>
        <p className="truncate text-sm text-gray-600">
          {r.spanish}
          {r.synonyms.length > 0 && <span className="text-gray-400"> · {r.synonyms.join(", ")}</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {!r.has_phonology && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">sin video</span>
          )}
          {r.ub && (
            <span className="rounded bg-accent-tint px-1.5 py-0.5 text-xs text-accent-deep">{lugarNombre(r.ub)}</span>
          )}
          {r.two_handed && (
            <span className="rounded bg-gold-tint px-1.5 py-0.5 text-xs text-gold-deep">dos manos</span>
          )}
          {!r.is_lsm && (
            <span className="rounded bg-magenta-tint px-1.5 py-0.5 text-xs text-magenta-deep">{r.language}</span>
          )}
          {r.is_lsm && r.region && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{r.region}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function NavegadorLexico({ rows }: { rows: LexiconRow[] }) {
  const [f, setF] = useState<BrowseFilters>(FILTROS_INICIALES);
  const [visibles, setVisibles] = useState(PAGINA);
  const fDiferido = useDeferredValue(f);
  const resultado = useMemo(() => filtra(rows, fDiferido), [rows, fDiferido]);
  const cambia = (p: Partial<BrowseFilters>) => {
    setF((prev) => ({ ...prev, ...p }));
    setVisibles(PAGINA);
  };
  const conVideo = rows.filter((r) => r.has_phonology).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Léxico de la LSM</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          {rows.length.toLocaleString("es-MX")} señas del diccionario de{" "}
          <a href="https://www.wikisigns.org/list/es/lsm" className="underline hover:text-accent-deep" target="_blank" rel="noreferrer">
            Wikisigns
          </a>
          . {conVideo.toLocaleString("es-MX")} tienen video y su descripción fonológica: forma, lugar, orientación,
          movimiento, cara y esqueleto. La descripción la propuso la visión por computadora y falta que la revise una
          persona Sorda.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-paper p-4">
        <label className="block">
          <span className="sr-only">Buscar una seña</span>
          <input
            type="search"
            value={f.q}
            onChange={(e) => cambia({ q: e.target.value })}
            placeholder="Buscar en español: agua, casa, gracias…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-accent"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Chips titulo="Lengua" opciones={LENGUAS} valor={f.lengua} onChange={(lengua) => cambia({ lengua })} />
          <Chips titulo="Manos" opciones={MANOS} valor={f.manos} onChange={(manos) => cambia({ manos })} />
          <div className="lg:col-span-2">
            <Chips titulo="Lugar" opciones={LUGARES} valor={f.lugar} onChange={(lugar) => cambia({ lugar })} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={f.soloConVideo}
              onChange={(e) => cambia({ soloConVideo: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 accent-[var(--color-accent)]"
            />
            Solo señas con video
          </label>
          <p className="text-sm text-gray-500" aria-live="polite">
            {resultado.length.toLocaleString("es-MX")} {resultado.length === 1 ? "seña" : "señas"}
          </p>
        </div>
      </div>

      {resultado.length === 0 ? (
        <div className="py-12 text-center text-gray-500">Ninguna seña coincide. Prueba con otra palabra o quita filtros.</div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resultado.slice(0, visibles).map((r) => (
              <li key={r.id}>
                <Tarjeta r={r} />
              </li>
            ))}
          </ul>
          {visibles < resultado.length && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setVisibles((v) => v + PAGINA * 2)}
                className="rounded-full bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Ver más ({(resultado.length - visibles).toLocaleString("es-MX")} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
