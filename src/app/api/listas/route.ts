import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { listCobertura, listParticipantRecordings, listSenante } from "@/lib/aws/repo";
import { itemIdDeGrabacion, type CorpusId } from "@/lib/aws/keys";
import {
  claveItem,
  LISTAS,
  listaDeItem,
  listaMasNecesitada,
  META_SENANTES,
  metaComunidad,
  resumenLista,
  type SenantesPorItem,
} from "@/lib/listas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Las listas con su cobertura (cuántas personas por seña, de las 9 de la
 * meta), cuántas señas de cada una ya grabó quien llama, cuál es la más
 * necesitada, la meta de la comunidad y, por seña, cuántas manos tiene y
 * si quien llama ya es una de ellas. Lee los contadores de cobertura,
 * que se acumulan al confirmar y al retirar; nunca recorre la tabla.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const [cobLsm, cobSp, mias, marcas] = await Promise.all([
    listCobertura("lsm"),
    listCobertura("signaplay"),
    listParticipantRecordings(user.userId),
    listSenante(user.userId),
  ]);
  const senantes: SenantesPorItem = {};
  for (const c of [...cobLsm, ...cobSp]) {
    senantes[claveItem(c.corpus, c.item_id)] = Math.max(0, Number(c.senantes ?? 0));
  }
  // Lo que llevas sale de tus grabaciones activas (señas distintas), igual
  // que en /api/progreso: incluye las anteriores a los contadores.
  const tuyas: Record<string, number> = {};
  const vistas = new Set<string>();
  for (const r of mias) {
    if (r.withdrawn) continue;
    const corpus: CorpusId = r.corpus ?? "lsm";
    const itemId = itemIdDeGrabacion(r);
    const clave = claveItem(corpus, itemId);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const l = listaDeItem(corpus, itemId);
    if (l) tuyas[l.id] = (tuyas[l.id] ?? 0) + 1;
  }

  const resumenes = LISTAS.map((l) => resumenLista(l, senantes));
  const masNecesitada = listaMasNecesitada(resumenes);
  const listas = resumenes.map((r) => ({
    id: r.id,
    senantes: r.senantes,
    pct: r.pct,
    tuyas: tuyas[r.id] ?? 0,
    masNecesitada: r.id === masNecesitada,
  }));

  // Para el estudio: cuántas manos tiene cada seña y en cuáles ya eres una
  // (tus marcadores y, para lo anterior al juego, tus grabaciones).
  const eres = new Set([
    ...vistas,
    ...marcas.filter((m) => m.activo).map((m) => claveItem(m.corpus, m.item_id)),
  ]);
  return Response.json({
    metaSenantes: META_SENANTES,
    listas,
    comunidad: metaComunidad(senantes),
    senantes,
    eres: [...eres],
  });
}
