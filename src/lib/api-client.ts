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
}

export const fetchMe = (): Promise<MeResponse> => getJson<MeResponse>("/api/me");
