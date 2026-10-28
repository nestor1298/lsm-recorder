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
  nivel?: number;
  medalla?: MedallaId | null;
}

export type MedallaId = "bronce" | "plata" | "oro" | "diamante";
export type RarezaId = "comun" | "rara" | "epica" | "legendaria";

export const fetchMe = (): Promise<MeResponse> => getJson<MeResponse>("/api/me");

// ── Camino del señante ──────────────────────────────────────────

export interface ProgresoResponse {
  apodo: string | null;
  videos: number;
  videosSemana: number;
  semana: string;
  nivel: number;
  medalla: MedallaId | null;
  siguienteMedalla: { id: MedallaId; nivel: number } | null;
  faltanParaCofre: number;
  senasDistintas: number;
  cmDistintas: number;
  rarezaMax: RarezaId | null;
  porLista: Record<string, number>;
  coleccion: {
    corpus: "lsm" | "signaplay";
    itemId: string;
    rareza: RarezaId;
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
}

export const fetchListas = (): Promise<ListasResponse> =>
  getJson<ListasResponse>("/api/listas");

export interface TableroResponse {
  semana: string;
  rango: string;
  filas: {
    puesto: number;
    apodo: string;
    videos: number;
    nivel: number;
    medalla: MedallaId | null;
    eresTu: boolean;
  }[];
  total: number;
  tu: { puesto: number; videos: number; nivel: number } | null;
}

export const fetchTablero = (semana?: string): Promise<TableroResponse> =>
  getJson<TableroResponse>(
    semana ? `/api/tablero?semana=${encodeURIComponent(semana)}` : "/api/tablero",
  );

/** Lo que devuelve /api/recordings/confirm además de la grabación. */
export interface ProgresoAlConfirmar {
  videos: number;
  nivel: number;
  cofre: boolean;
  medalla: MedallaId | null;
  rareza: RarezaId;
}
