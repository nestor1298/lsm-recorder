import { ITEM_ID_RE, type CorpusId } from "./keys";

/**
 * Ítem de grabación pedido por el cliente. Acepta `itemId` (string) y, por
 * compatibilidad con clientes anteriores a los dos corpus, `cmId` (entero).
 */
export function leerItemId(body: unknown): string | null {
  const b = body as { itemId?: unknown; cmId?: unknown } | null;
  if (!b) return null;
  if (typeof b.itemId === "string" && ITEM_ID_RE.test(b.itemId)) return b.itemId;
  if (Number.isInteger(b.cmId)) return String(b.cmId);
  return null;
}

export function leerCorpus(body: unknown): CorpusId {
  const c = (body as { corpus?: unknown } | null)?.corpus;
  return c === "signaplay" ? "signaplay" : "lsm";
}
