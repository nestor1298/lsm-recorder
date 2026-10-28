import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { listCobertura, listSenante } from "@/lib/aws/repo";
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
 * necesitada y la meta de la comunidad. Lee los contadores de cobertura,
 * que se acumulan al confirmar y al retirar; nunca recorre la tabla.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const [cobLsm, cobSp, mias] = await Promise.all([
    listCobertura("lsm"),
    listCobertura("signaplay"),
    listSenante(user.userId),
  ]);
  const senantes: SenantesPorItem = {};
  for (const c of [...cobLsm, ...cobSp]) {
    senantes[claveItem(c.corpus, c.item_id)] = Math.max(0, Number(c.senantes ?? 0));
  }
  const tuyas: Record<string, number> = {};
  for (const s of mias) {
    if (!s.activo) continue;
    const l = listaDeItem(s.corpus, s.item_id);
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

  return Response.json({
    metaSenantes: META_SENANTES,
    listas,
    comunidad: metaComunidad(senantes),
  });
}
