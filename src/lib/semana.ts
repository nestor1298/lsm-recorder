/**
 * semana.ts — la semana de la comunidad: semana ISO 8601 en UTC
 * ("2026-W44"). La usan los contadores de la comunidad (manos y señas
 * completas de la semana) y sus páginas.
 */

// ── Semana ISO (UTC) ────────────────────────────────────────────

/** "2026-W44": semana ISO 8601 de la fecha, en UTC. */
export function semanaIso(fecha: Date): string {
  const d = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()),
  );
  // Jueves de la misma semana ISO decide el año
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

export const SEMANA_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

/** Lunes 00:00 UTC de una semana ISO, o null si el id no es válido. */
export function inicioDeSemana(semana: string): Date | null {
  if (!SEMANA_RE.test(semana)) return null;
  const anio = Number(semana.slice(0, 4));
  const n = Number(semana.slice(6));
  // El 4 de enero siempre cae en la semana 1
  const cuatroEnero = new Date(Date.UTC(anio, 0, 4));
  const dia = cuatroEnero.getUTCDay() || 7;
  const lunesSemana1 = new Date(cuatroEnero);
  lunesSemana1.setUTCDate(cuatroEnero.getUTCDate() - dia + 1);
  const lunes = new Date(lunesSemana1);
  lunes.setUTCDate(lunesSemana1.getUTCDate() + (n - 1) * 7);
  // W53 solo existe en algunos años: si el lunes cae en otra semana, no existe.
  return semanaIso(lunes) === semana ? lunes : null;
}

/** Texto corto para la gente: "27 oct – 2 nov". */
export function rangoDeSemana(semana: string, locale = "es-MX"): string {
  const lunes = inicioDeSemana(semana);
  if (!lunes) return semana;
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  const f = (d: Date) =>
    d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(lunes)} – ${f(domingo)}`;
}
