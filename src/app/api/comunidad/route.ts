import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  getSemanaComunidad,
  listCirculo,
  listCobertura,
  listCompletas,
  listEstados,
  listSenante,
} from "@/lib/aws/repo";
import { claveItem, metaComunidad, TOTAL_SENAS, type SenantesPorItem } from "@/lib/listas";
import { casiCompletas, MANOS_POR_SENA, senasCompletas } from "@/lib/nueve_manos";
import { inicioDeSemana, rangoDeSemana, semanaIso } from "@/lib/semana";
import { esEstadoMx } from "@/lib/mapa_mx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cuántos círculos recién cerrados se muestran con sus apodos. */
const CERRADOS_CON_APODOS = 6;

/**
 * La comunidad de las nueve manos: cuántas señas ya están completas, a
 * cuáles les falta poco (sin las que tú ya grabaste), los círculos que se
 * cerraron en la semana con los apodos de sus manos, las manos que
 * llegaron esa semana y el mapa de manos por estado. Sin posiciones ni
 * comparaciones entre personas. `?semana=2026-W44` para otra semana.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(req.url);
  const pedida = url.searchParams.get("semana");
  const semana = pedida && inicioDeSemana(pedida) ? pedida : semanaIso(new Date());

  const [cobLsm, cobSp, mias, cerradas, delaSemana, estados] = await Promise.all([
    listCobertura("lsm"),
    listCobertura("signaplay"),
    listSenante(user.userId),
    listCompletas(semana),
    getSemanaComunidad(semana),
    listEstados(),
  ]);

  const senantes: SenantesPorItem = {};
  for (const c of [...cobLsm, ...cobSp]) {
    senantes[claveItem(c.corpus, c.item_id)] = Math.max(0, Number(c.senantes ?? 0));
  }
  const tuyas = new Set(mias.filter((m) => m.activo).map((m) => claveItem(m.corpus, m.item_id)));

  const recientes = [...cerradas]
    .sort((a, b) => (a.cerrada < b.cerrada ? 1 : -1))
    .slice(0, CERRADOS_CON_APODOS);
  const circulos = await Promise.all(
    recientes.map(async (c) => {
      const manos = (await listCirculo(c.corpus, c.item_id)).sort((a, b) => a.mano - b.mano);
      return {
        corpus: c.corpus,
        itemId: c.item_id,
        cerrada: c.cerrada,
        // solo apodos, nunca nombres ni ids
        apodos: manos.slice(0, MANOS_POR_SENA).map((m) => m.apodo ?? "Sin apodo"),
        estuviste: manos.some((m) => m.user_id === user.userId),
      };
    }),
  );

  return Response.json({
    semana,
    rango: rangoDeSemana(semana),
    total: TOTAL_SENAS,
    completas: senasCompletas(senantes),
    meta: metaComunidad(senantes),
    casi: casiCompletas(senantes, tuyas),
    deLaSemana: {
      manos: Math.max(0, Number(delaSemana?.manos ?? 0)),
      completas: Math.max(0, Number(delaSemana?.completas ?? 0)),
      circulos,
    },
    estados: estados
      .filter((e) => esEstadoMx(e.estado) && Number(e.manos) > 0)
      .map((e) => ({ estado: e.estado, manos: Number(e.manos) })),
  });
}
