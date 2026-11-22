"use client";

/**
 * ExplorarCorpus — las personas (por seudónimo) y los enunciados del
 * corpus VOCES EN SEÑAS. Las filas llegan ligeras desde el servidor
 * (catalog.ts); el detalle de cada enunciado —sus señas con la
 * fonología— se trae al abrirlo, una vez por episodio.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CM_INVENTORY } from "@/lib/data";
import { MiniHand } from "@/components/learn/MiniHand";
import { PictoMV, PictoUB } from "@/components/lexico/ficha/Pictogramas";
import { CONTACT_ES, CONTOUR_ES, FINGER_ES, PALM_ES, RELATION_ES, ubName } from "@/lib/anotar_labels";
import {
  DIRECCION_ES,
  FILTROS_CORPUS,
  filtraEnunciados,
  idDeGlosa,
  minSeg,
  type EpisodioFila,
  type FilaEnunciado,
  type FiltrosCorpus,
  type PersonaFila,
  type SenaCorpus,
} from "@/lib/corpus/explorar";
import type { ContourMovement, FingerPointing, NonDominantRelation, PalmFacing } from "@/lib/types";

const PAGINA = 40;
const cmPorId = new Map(CM_INVENTORY.map((c) => [c.cm_id, c]));
const mil = (n: number) => n.toLocaleString("es-MX");
const pct = (x: number) => `${Math.round(x * 100)} %`;
const lugar = (code: string | null) => (!code ? "—" : code === "EN" ? "Espacio neutro" : (ubName(code) ?? code));
const contorno = (k: string | null) => (!k || k === "QUIETA" ? "Quieta" : (CONTOUR_ES[k as ContourMovement] ?? k));
const CONDICION: Record<string, string> = { sorda: "Sorda", sordo: "Sordo", oyente: "Oyente", "intérprete": "Intérprete" };

// ── Detalle por episodio: se trae una vez y se guarda ──────────

type Detalle = Record<string, SenaCorpus[]>;
const detalles = new Map<string, Promise<Detalle>>();
function detalleDe(ep: string): Promise<Detalle> {
  let p = detalles.get(ep);
  if (!p) {
    p = fetch(`/corpus/e/${ep}.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    p.catch(() => detalles.delete(ep));
    detalles.set(ep, p);
  }
  return p;
}

// ── Personas ───────────────────────────────────────────────────

function Persona({ p, activa, onClick }: { p: PersonaFila; activa: boolean; onClick: () => void }) {
  const c = p.c;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex h-full w-full flex-col rounded-xl border bg-paper p-4 text-left transition-all hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent ${
        activa ? "border-ink ring-1 ring-ink" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg font-bold leading-tight text-ink">{p.seudonimo}</p>
        <span className="font-mono text-xs text-gray-400">{p.id}</span>
      </div>
      <p className="mt-0.5 min-h-[1.25rem] text-xs font-medium uppercase tracking-wide text-gray-500">{p.rol ?? "Rol sin rótulo"}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {p.condicion && (
          <span className="rounded bg-magenta-tint px-1.5 py-0.5 text-xs text-magenta-deep">{CONDICION[p.condicion] ?? p.condicion}</span>
        )}
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
          {p.episodios} {p.episodios === 1 ? "episodio" : "episodios"}
        </span>
        {c?.mano_dominante && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">mano {c.mano_dominante}</span>
        )}
      </div>
      {c ? (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Enunciados", mil(c.enunciados)],
              ["Señas", mil(c.senas)],
              ["Minutos", c.minutos_senando.toFixed(0)],
            ].map(([k, v]) => (
              <div key={k}>
                <dd className="font-display text-xl font-bold tabular-nums text-ink">{v}</dd>
                <dt className="text-[11px] text-gray-500">{k}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-3 space-y-1.5 text-xs text-gray-600">
            <div className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2">
              <span>Dos manos</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span className="block h-full rounded-full bg-gold" style={{ width: pct(c.dos_manos) }} />
              </span>
              <span className="text-right tabular-nums">{pct(c.dos_manos)}</span>
            </div>
            <div className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2">
              <span>Primer plano</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <span className="block h-full rounded-full bg-ink" style={{ width: pct(c.en_primer_plano) }} />
              </span>
              <span className="text-right tabular-nums">{pct(c.en_primer_plano)}</span>
            </div>
            <p>
              <span className="text-gray-400">Ritmo</span> {c.senas_por_segundo.toFixed(2)} señas/s
            </p>
            <p className="truncate" title={c.lugares.map((l) => lugar(l.clave)).join(", ")}>
              <span className="text-gray-400">Lugares</span> {c.lugares.map((l) => lugar(l.clave).toLowerCase()).join(", ")}
            </p>
          </div>
          <div className="mt-auto flex items-center gap-1 pt-3" aria-label="Formas de mano que más usa">
            {c.formas.map((f) => {
              const cm = cmPorId.get(Number(f.clave));
              return cm ? (
                <span key={f.clave} title={`CM ${f.clave}: ${mil(f.n)} señas`} className="flex flex-col items-center">
                  <MiniHand cm={cm} size={34} />
                  <span className="font-mono text-[10px] text-gray-400">{f.clave}</span>
                </span>
              ) : null;
            })}
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-gray-500">Sale en pantalla, pero no se le asignó ningún enunciado.</p>
      )}
    </button>
  );
}

// ── Una seña del enunciado ─────────────────────────────────────

function Sena({ s }: { s: SenaCorpus }) {
  const f = s.fonologia;
  const cm = f.cm[0] ? cmPorId.get(f.cm[0].id) : undefined;
  const otras = f.cm.slice(1).filter((c) => c.puntaje >= (f.cm[0]?.puntaje ?? 1) - 0.05);
  const lexId = idDeGlosa(s);
  return (
    <li className="w-56 shrink-0 snap-start rounded-xl border border-gray-200 bg-paper p-3">
      <div className="flex items-baseline justify-between text-xs text-gray-400">
        <span className="font-mono">seña {s.i}</span>
        <span className="tabular-nums">
          {minSeg(s.t0)} · {(s.t1 - s.t0).toFixed(1)} s
        </span>
      </div>
      <div className="mt-1 min-h-[1.75rem]">
        {s.glosa ? (
          lexId ? (
            <Link href={`/lexico/sena?id=${lexId}`} className="font-display text-base font-bold text-accent-deep underline-offset-4 hover:underline">
              {s.glosa}
            </Link>
          ) : (
            <span className="font-display text-base font-bold text-ink">{s.glosa}</span>
          )
        ) : (
          <span className="font-mono text-xs text-gray-500">{s.token}</span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <figure className="flex flex-col items-center rounded-lg bg-gray-50 p-1">
          {cm ? <MiniHand cm={cm} size={40} /> : <span className="h-10 text-gray-300">—</span>}
          <figcaption className="font-mono text-[10px] text-gray-500">
            CM {f.cm[0]?.id ?? "—"}
            {otras.length > 0 && <span className="text-gray-400"> / {otras.map((c) => c.id).join(", ")}</span>}
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center rounded-lg bg-gray-50 p-1">
          <div className="h-10 w-10">
            <PictoUB code={f.ub} toca={f.contacto === "TOUCHING"} />
          </div>
          <figcaption className="font-mono text-[10px] text-gray-500">UB {f.ub ?? "—"}</figcaption>
        </figure>
        <figure className="flex flex-col items-center rounded-lg bg-gray-50 p-1">
          <div className="h-10 w-14">
            <PictoMV
              contorno={(f.contorno as ContourMovement | null) ?? null}
              direccion={f.direccion}
              repeticiones={f.repeticion?.count ?? null}
            />
          </div>
          <figcaption className="font-mono text-[10px] text-gray-500">MV</figcaption>
        </figure>
      </div>
      <dl className="mt-2 space-y-0.5 text-xs">
        <div className="flex gap-1.5">
          <dt className="w-12 shrink-0 text-gray-400">Lugar</dt>
          <dd className="text-gray-700">
            {lugar(f.ub)}
            {f.contacto && <span className="text-gray-400"> · {(CONTACT_ES[f.contacto as keyof typeof CONTACT_ES] ?? f.contacto).toLowerCase()}</span>}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="w-12 shrink-0 text-gray-400">OR</dt>
          <dd className="text-gray-700">
            {[f.palma && PALM_ES[f.palma as PalmFacing], f.dedos && FINGER_ES[f.dedos as FingerPointing]?.toLowerCase()]
              .filter(Boolean)
              .join(", ") || "—"}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="w-12 shrink-0 text-gray-400">MV</dt>
          <dd className="text-gray-700">
            {contorno(f.contorno)}
            {f.repeticion && f.repeticion.count > 1 && <span className="text-gray-400"> ×{f.repeticion.count}</span>}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="w-12 shrink-0 text-gray-400">Manos</dt>
          <dd className="text-gray-700">
            {f.dos_manos ? (RELATION_ES[f.relacion as NonDominantRelation] ?? "Dos manos") : "Una mano"}
          </dd>
        </div>
      </dl>
      {s.candidatos.length > 0 && (
        <p className="mt-2 border-t border-gray-100 pt-1.5 text-[11px] leading-snug text-gray-500">
          <span className="text-gray-400">Se parece a </span>
          {s.candidatos.map((c, k) => (
            <span key={c.id}>
              {k > 0 && ", "}
              <Link href={`/lexico/sena?id=${c.id}`} className="hover:text-accent-deep hover:underline">
                {c.glosa}
              </Link>
              <span className="tabular-nums text-gray-400"> {c.puntaje.toFixed(2)}</span>
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

function Senas({ fila }: { fila: FilaEnunciado }) {
  const [estado, setEstado] = useState<{ senas: SenaCorpus[] | null; error: boolean }>({ senas: null, error: false });
  useEffect(() => {
    let vivo = true;
    detalleDe(fila.e)
      .then((d) => vivo && setEstado({ senas: d[fila.id] ?? [], error: false }))
      .catch(() => vivo && setEstado({ senas: null, error: true }));
    return () => {
      vivo = false;
    };
  }, [fila.e, fila.id]);

  if (estado.error) return <p className="py-3 text-sm text-gray-500">No se pudo traer el detalle. Intenta de nuevo.</p>;
  if (!estado.senas)
    return (
      <div className="flex py-6" aria-label="Cargando las señas">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  if (estado.senas.length === 0) return <p className="py-3 text-sm text-gray-500">En este tramo no se cortó ninguna seña.</p>;
  return (
    <ol className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" aria-label="Señas del enunciado">
      {estado.senas.map((s) => (
        <Sena key={s.i} s={s} />
      ))}
    </ol>
  );
}

// ── Un enunciado ───────────────────────────────────────────────

function Enunciado({ r, persona }: { r: FilaEnunciado; persona: PersonaFila | undefined }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <li className="rounded-xl border border-gray-200 bg-paper p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        <span className="font-mono text-gray-400">
          Ep. {r.n} · {minSeg(r.t0)}
        </span>
        {persona ? (
          <span className="font-medium text-ink">
            {persona.seudonimo}
            {persona.rol && <span className="font-normal uppercase tracking-wide text-gray-500"> · {persona.rol}</span>}
          </span>
        ) : (
          <span className="text-gray-400">Sin señante</span>
        )}
        {r.d === "interpretada" && <span className="rounded bg-gold-tint px-1.5 py-0.5 text-gold-deep">interpretación</span>}
        {r.pp !== null && r.pp < 0.5 && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">toma abierta</span>}
      </div>
      <p className="mt-1.5 text-[17px] leading-snug text-ink">{r.texto}</p>
      <p className="mt-1.5 break-words font-mono text-[13px] leading-relaxed text-accent-deep">{r.tr || "—"}</p>
      {r.senas > 0 && (
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className="mt-2 text-sm font-medium text-gray-600 hover:text-accent-deep"
        >
          {abierto ? (r.senas === 1 ? "Ocultar la seña" : "Ocultar las señas") : r.senas === 1 ? "Ver la seña" : `Ver las ${r.senas} señas`}
          {r.glosas > 0 && <span className="text-gray-400"> · {r.glosas} con glosa</span>}
        </button>
      )}
      {abierto && (
        <div className="mt-3">
          <Senas fila={r} />
        </div>
      )}
    </li>
  );
}

// ── La página ──────────────────────────────────────────────────

export default function ExplorarCorpus({
  filas,
  personas,
  episodios,
}: {
  filas: FilaEnunciado[];
  personas: PersonaFila[];
  episodios: EpisodioFila[];
}) {
  const [f, setF] = useState<FiltrosCorpus>(FILTROS_CORPUS);
  const [visibles, setVisibles] = useState(PAGINA);
  const lista = useRef<HTMLElement>(null);
  const fDiferido = useDeferredValue(f);
  const resultado = useMemo(() => filtraEnunciados(filas, fDiferido), [filas, fDiferido]);
  const porId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas]);
  const conEnunciados = personas.filter((p) => p.c);
  const cuenta = useMemo(() => {
    const c = { propia: 0, interpretada: 0 };
    for (const r of filas) if (r.d) c[r.d]++;
    return c;
  }, [filas]);
  const cambia = (p: Partial<FiltrosCorpus>) => {
    setF((prev) => ({ ...prev, ...p }));
    setVisibles(PAGINA);
  };
  const eligePersona = (id: string) => {
    cambia({ persona: f.persona === id ? "" : id });
    lista.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-12">
      <section id="personas" aria-labelledby="t-personas" className="scroll-mt-24 border-t border-gray-200 pt-8">
        <div className="mb-5 grid gap-2 lg:grid-cols-[16rem_1fr] lg:gap-10">
          <h2 id="t-personas" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            Quién seña
          </h2>
          <p className="max-w-2xl text-[15px] leading-relaxed text-gray-600">
            Cada persona lleva un seudónimo; su nombre no se guarda. El rol sale del rótulo del programa y la condición auditiva
            solo aparece cuando el rótulo la dice. La caracterización es lingüística: cuánto seña, con qué mano, con qué formas y
            en qué lugares. Toca una persona para ver solo sus enunciados.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {conEnunciados.map((p) => (
            <li key={p.id}>
              <Persona p={p} activa={f.persona === p.id} onClick={() => eligePersona(p.id)} />
            </li>
          ))}
        </ul>
        {personas.length > conEnunciados.length && (
          <p className="mt-3 text-sm text-gray-500">
            {personas.length - conEnunciados.length === 1
              ? "Otra persona sale en pantalla sin que se le asigne ningún enunciado."
              : `Otras ${personas.length - conEnunciados.length} personas salen en pantalla sin que se les asigne ningún enunciado.`}
          </p>
        )}
      </section>

      <section id="enunciados" ref={lista} aria-labelledby="t-enunciados" className="scroll-mt-24 space-y-5 border-t border-gray-200 pt-8">
        <div className="grid gap-2 lg:grid-cols-[16rem_1fr] lg:gap-10">
          <h2 id="t-enunciados" className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            Enunciados
          </h2>
          <p className="max-w-2xl text-[15px] leading-relaxed text-gray-600">
            Cada enunciado es la oración del subtítulo (en español), quién la seña y la transliteración: las glosas en mayúsculas
            son señas del léxico que se parecen y cuya palabra está en la oración; entre corchetes va la descripción{" "}
            <span className="font-mono text-[13px]">[CM·lugar·movimiento·2M]</span> cuando no hubo glosa. Los marcados como{" "}
            <span className="rounded bg-gold-tint px-1 text-gold-deep">interpretación</span> los seña alguien cuyo rótulo dice
            intérprete: casi siempre la seña traduce lo que dijo otra persona, así que no es LSM espontánea y el subtítulo puede
            ser el original. La marca sale del rol, no de cada momento: a veces el intérprete habla por sí mismo.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-200 bg-paper p-4">
          <label className="block">
            <span className="sr-only">Buscar en las oraciones y glosas</span>
            <input
              type="search"
              value={f.q}
              onChange={(e) => cambia({ q: e.target.value })}
              placeholder="Buscar en las oraciones o glosas: escuela, familia, intérprete…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-accent"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-center">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium overline-label text-gray-500">Persona</span>
              <select
                value={f.persona}
                onChange={(e) => cambia({ persona: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-paper px-2 py-1.5 text-sm"
              >
                <option value="">Todas</option>
                {conEnunciados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.seudonimo} ({p.id}){p.rol ? ` · ${p.rol.toLowerCase()}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium overline-label text-gray-500">Episodio</span>
              <select
                value={f.episodio}
                onChange={(e) => cambia({ episodio: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 bg-paper px-2 py-1.5 text-sm"
              >
                <option value={0}>Todos</option>
                {episodios.map((e) => (
                  <option key={e.id} value={e.n}>
                    Episodio {e.n} · {e.fecha}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium overline-label text-gray-500">Cómo se seña</span>
              <select
                value={f.direccion}
                onChange={(e) => cambia({ direccion: e.target.value as FiltrosCorpus["direccion"] })}
                className="w-full rounded-lg border border-gray-300 bg-paper px-2 py-1.5 text-sm"
              >
                <option value="">Todo</option>
                <option value="propia">{DIRECCION_ES.propia} ({mil(cuenta.propia)})</option>
                <option value="interpretada">{DIRECCION_ES.interpretada} ({mil(cuenta.interpretada)})</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 lg:mt-5">
              <input
                type="checkbox"
                checked={f.soloConGlosa}
                onChange={(e) => cambia({ soloConGlosa: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-[var(--color-accent)]"
              />
              Solo con glosa
            </label>
            <p className="text-sm text-gray-500 lg:mt-5 lg:text-right" aria-live="polite">
              {mil(resultado.length)} {resultado.length === 1 ? "enunciado" : "enunciados"}
            </p>
          </div>
        </div>

        {resultado.length === 0 ? (
          <div className="py-12 text-center text-gray-500">Ningún enunciado coincide. Prueba con otra palabra o quita filtros.</div>
        ) : (
          <>
            <ul className="space-y-3">
              {resultado.slice(0, visibles).map((r) => (
                <Enunciado key={r.id} r={r} persona={r.p ? porId.get(r.p) : undefined} />
              ))}
            </ul>
            {visibles < resultado.length && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibles((v) => v + PAGINA * 2)}
                  className="rounded-full bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Ver más ({mil(resultado.length - visibles)} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
