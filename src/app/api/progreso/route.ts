import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { getParticipant, listParticipantRecordings } from "@/lib/aws/repo";
import { itemIdDeGrabacion, type CorpusId } from "@/lib/aws/keys";
import { claveItem, listaDeItem } from "@/lib/listas";
import {
  faltanParaCofre,
  masRara,
  medallaDe,
  nivelDe,
  rarezaDe,
  semanaIso,
  siguienteMedalla,
  type Rareza,
} from "@/lib/progresion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SenaColeccionada {
  corpus: CorpusId;
  itemId: string;
  rareza: Rareza;
  /** primera vez que la grabó (ISO) */
  desde: string;
  veces: number;
}

/**
 * El progreso de quien llama: nivel, medalla, cofre, lo que lleva por lista
 * y su colección de señas (una entrada por seña distinta, con su rareza).
 * Se calcula de sus propias grabaciones (gsi1): nada entre personas aquí.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const [participant, recs] = await Promise.all([
    getParticipant(user.userId),
    listParticipantRecordings(user.userId),
  ]);
  const activas = recs.filter((r) => !r.withdrawn);
  const semana = semanaIso(new Date());

  // El total oficial vive en el perfil (se acumula al confirmar); si el
  // perfil es anterior a los contadores, se cuenta de las grabaciones.
  const videos =
    typeof participant?.videos_total === "number"
      ? Math.max(0, participant.videos_total)
      : activas.length;
  const nivel = nivelDe(videos);

  const coleccion = new Map<string, SenaColeccionada>();
  const porLista: Record<string, number> = {};
  let rarezaMax: Rareza | null = null;
  let videosSemana = 0;
  const cms = new Set<number>();
  for (const r of activas) {
    const corpus: CorpusId = r.corpus ?? "lsm";
    const itemId = itemIdDeGrabacion(r);
    if (semanaIso(new Date(r.recorded_at)) === semana) videosSemana += 1;
    if (typeof r.cm_id === "number") cms.add(r.cm_id);
    const clave = claveItem(corpus, itemId);
    const rareza = rarezaDe(corpus, itemId);
    rarezaMax = rarezaMax ? masRara(rarezaMax, rareza) : rareza;
    const previa = coleccion.get(clave);
    if (previa) {
      previa.veces += 1;
      if (r.recorded_at < previa.desde) previa.desde = r.recorded_at;
    } else {
      coleccion.set(clave, { corpus, itemId, rareza, desde: r.recorded_at, veces: 1 });
      const lista = listaDeItem(corpus, itemId);
      if (lista) porLista[lista.id] = (porLista[lista.id] ?? 0) + 1;
    }
  }

  const medalla = medallaDe(nivel);
  const siguiente = siguienteMedalla(nivel);
  return Response.json({
    apodo: participant?.apodo ?? null,
    videos,
    videosSemana,
    semana,
    nivel,
    medalla: medalla?.id ?? null,
    siguienteMedalla: siguiente ? { id: siguiente.id, nivel: siguiente.nivel } : null,
    faltanParaCofre: faltanParaCofre(videos),
    senasDistintas: coleccion.size,
    cmDistintas: cms.size,
    rarezaMax,
    porLista,
    coleccion: [...coleccion.values()].sort((a, b) => (a.desde < b.desde ? 1 : -1)),
  });
}
