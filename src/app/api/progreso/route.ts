import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  getParticipant,
  listCobertura,
  listParticipantRecordings,
  listSenante,
} from "@/lib/aws/repo";
import { itemIdDeGrabacion, type CorpusId } from "@/lib/aws/keys";
import { claveItem } from "@/lib/listas";
import { cmDeItemId } from "@/lib/corpus";
import { atlasDe, circuloDe, MANOS_POR_SENA, rutasDe } from "@/lib/nueve_manos";
import { semanaIso } from "@/lib/semana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SenaTuya {
  corpus: CorpusId;
  itemId: string;
  /** tu lugar en su círculo (null en grabaciones anteriores al juego) */
  mano: number | null;
  /** cuántas manos tiene hoy */
  manos: number;
  completa: boolean;
  /** primera vez que la grabaste (ISO) */
  desde: string;
  veces: number;
}

/**
 * Tu parte de las nueve manos: las señas en las que eres una mano (con tu
 * lugar y cómo va su círculo), cuántos círculos ayudaste a cerrar, tu
 * atlas de la mano y tus sellos de ruta. Lee tus grabaciones, tus
 * marcadores y los contadores de cobertura; nunca recorre la tabla.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const [participant, recs, marcas, cobLsm, cobSp] = await Promise.all([
    getParticipant(user.userId),
    listParticipantRecordings(user.userId),
    listSenante(user.userId),
    listCobertura("lsm"),
    listCobertura("signaplay"),
  ]);
  const activas = recs.filter((r) => !r.withdrawn);
  const semana = semanaIso(new Date());
  const manosDe = new Map<string, number>();
  for (const c of [...cobLsm, ...cobSp]) {
    manosDe.set(claveItem(c.corpus, c.item_id), Math.max(0, Number(c.senantes ?? 0)));
  }
  const lugar = new Map<string, number>();
  for (const m of marcas) {
    if (m.activo && typeof m.mano === "number") lugar.set(claveItem(m.corpus, m.item_id), m.mano);
  }

  // El total oficial vive en el perfil (se acumula al confirmar); si el
  // perfil es anterior a los contadores, se cuenta de las grabaciones.
  const videos =
    typeof participant?.videos_total === "number"
      ? Math.max(0, participant.videos_total)
      : activas.length;

  const senas = new Map<string, SenaTuya>();
  let videosSemana = 0;
  for (const r of activas) {
    const corpus: CorpusId = r.corpus ?? "lsm";
    const itemId = itemIdDeGrabacion(r);
    if (semanaIso(new Date(r.recorded_at)) === semana) videosSemana += 1;
    const clave = claveItem(corpus, itemId);
    const previa = senas.get(clave);
    if (previa) {
      previa.veces += 1;
      if (r.recorded_at < previa.desde) previa.desde = r.recorded_at;
      continue;
    }
    const c = circuloDe(manosDe.get(clave) ?? 0);
    senas.set(clave, {
      corpus,
      itemId,
      mano: lugar.get(clave) ?? null,
      manos: c.manos,
      completa: c.completo,
      desde: r.recorded_at,
      veces: 1,
    });
  }

  const lista = [...senas.values()];
  const cms = lista
    .filter((s) => s.corpus === "lsm")
    .map((s) => cmDeItemId(s.itemId)?.cm_id)
    .filter((n): n is number => typeof n === "number");
  const atlas = atlasDe(cms);
  const rutas = rutasDe(lista.filter((s) => s.corpus === "signaplay").map((s) => s.itemId));

  return Response.json({
    apodo: participant?.apodo ?? null,
    videos,
    videosSemana,
    semana,
    senas: lista.length,
    completas: lista.filter((s) => s.completa).length,
    cerraste: lista.filter((s) => s.mano === MANOS_POR_SENA).length,
    atlas: {
      tuyas: atlas.tuyas,
      total: atlas.total,
      grupos: atlas.grupos.map((g) => ({
        id: g.grupo.id,
        tuyas: g.tuyas,
        completo: g.completo,
      })),
    },
    rutas,
    sellos: rutas.filter((r) => r.sellada).length,
    misSenas: lista.sort((a, b) => (a.desde < b.desde ? 1 : -1)),
  });
}
