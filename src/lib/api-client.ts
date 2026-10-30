"use client";
import { getAccessToken } from "./auth-client";

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

/** fetch() that attaches the Cognito access token as a Bearer header. */
export async function authedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await authedFetch(url);
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await authedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as T;
}

export interface MeResponse {
  userId: string;
  email?: string;
  consentStatus: "none" | "granted" | "withdrawn";
  defaultTier: "abierto" | "investigacion" | "restringido";
  hasMetadata: boolean;
  displayName?: string;
  // Camino del señante (ausentes en servidores anteriores)
  apodo?: string | null;
  agreementVersion?: string | null;
  videos?: number;
  /** estado donde vive (cuestionario), para el mapa de la comunidad */
  estado?: string | null;
}

export const fetchMe = (): Promise<MeResponse> => getJson<MeResponse>("/api/me");

// ── Camino del señante ──────────────────────────────────────────

export type CorpusCliente = "lsm" | "signaplay";

/** Tu parte de las nueve manos (ver src/lib/nueve_manos.ts). */
export interface ProgresoResponse {
  apodo: string | null;
  videos: number;
  videosSemana: number;
  semana: string;
  /** señas en las que eres una mano */
  senas: number;
  /** de esas, cuántas ya tienen sus nueve manos */
  completas: number;
  /** círculos que tú cerraste (fuiste la novena mano) */
  cerraste: number;
  atlas: {
    tuyas: number;
    total: number;
    grupos: { id: "A" | "B" | "C" | "D" | "E"; tuyas: number[]; completo: boolean }[];
  };
  rutas: { numero: number; nombre: string; total: number; tuyas: number; sellada: boolean }[];
  sellos: number;
  misSenas: {
    corpus: CorpusCliente;
    itemId: string;
    mano: number | null;
    manos: number;
    completa: boolean;
    desde: string;
    veces: number;
  }[];
}

export const fetchProgreso = (): Promise<ProgresoResponse> =>
  getJson<ProgresoResponse>("/api/progreso");

export interface ListasResponse {
  metaSenantes: number;
  listas: {
    id: string;
    senantes: number;
    pct: number;
    tuyas: number;
    masNecesitada: boolean;
  }[];
  comunidad: { pct: number; hechas: number; meta: number };
  /** manos por seña, con la llave "corpus:itemId" (ver claveItem) */
  senantes?: Record<string, number>;
  /** señas en las que ya eres una mano ("corpus:itemId") */
  eres?: string[];
}

export const fetchListas = (): Promise<ListasResponse> =>
  getJson<ListasResponse>("/api/listas");

export interface ComunidadResponse {
  semana: string;
  rango: string;
  total: number;
  completas: number;
  meta: { pct: number; hechas: number; meta: number };
  casi: { corpus: CorpusCliente; itemId: string; manos: number; faltan: number }[];
  deLaSemana: {
    manos: number;
    completas: number;
    circulos: {
      corpus: CorpusCliente;
      itemId: string;
      cerrada: string;
      apodos: string[];
      estuviste: boolean;
    }[];
  };
  estados: { estado: string; manos: number }[];
}

export const fetchComunidad = (semana?: string): Promise<ComunidadResponse> =>
  getJson<ComunidadResponse>(
    semana ? `/api/comunidad?semana=${encodeURIComponent(semana)}` : "/api/comunidad",
  );

/** Lo que devuelve /api/recordings/confirm además de la grabación. */
export type MomentoCliente =
  | { tipo: "primera" }
  | { tipo: "mano"; mano: number | null }
  | { tipo: "circulo" }
  | { tipo: "grupo"; grupo: "A" | "B" | "C" | "D" | "E" }
  | { tipo: "sello"; ruta: number };

export interface ProgresoAlConfirmar {
  videos: number;
  /** tu lugar en el círculo de la seña; null si ya eras una de sus manos */
  mano: number | null;
  momentos: MomentoCliente[];
}
