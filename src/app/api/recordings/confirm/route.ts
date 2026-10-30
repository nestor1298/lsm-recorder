import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  contarVideoNuevo,
  esCondicionFallida,
  getParticipant,
  getOwnedRecording,
  listParticipantRecordings,
  listSenante,
  putRecording,
} from "@/lib/aws/repo";
import { momentosAlGuardar, type Momento } from "@/lib/nueve_manos";
import { claveItem } from "@/lib/listas";
import { itemIdDeGrabacion, recordingId } from "@/lib/aws/keys";
import { ALLOWED_VIDEO_TYPES, existeObjeto } from "@/lib/aws/s3";
import { awsEnv } from "@/lib/aws/env";
import { leerCorpus, leerItemId, leerSessionId } from "@/lib/aws/item";
import { cmDeItemId, senaSignaPlay } from "@/lib/corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Persist a Recording item after the client has PUT the blob to S3. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const sessionId = leerSessionId(body);
  const itemId = leerItemId(body);
  const s3Key = body?.s3Key;
  const durationMs = body?.durationMs;
  if (
    !sessionId ||
    !itemId ||
    typeof s3Key !== "string" ||
    !Number.isFinite(durationMs)
  ) {
    return Response.json(
      { error: "sessionId, itemId, s3Key y durationMs son requeridos" },
      { status: 400 },
    );
  }

  // The key must belong to the caller and match the layout of the presign,
  // with any of the extensions the presign can issue (webm, mp4, mov).
  const base = `${user.userId}/${sessionId}/${itemId}.`;
  const extValida = Object.values(ALLOWED_VIDEO_TYPES).some(
    (ext) => s3Key === base + ext,
  );
  if (!extValida) {
    return Response.json({ error: "s3Key inválida" }, { status: 400 });
  }

  // El ítem tiene que existir en el corpus indicado; la glosa y la CM se
  // derivan aquí, no se confía en lo que mande el cliente.
  const corpus = leerCorpus(body);
  const cm = corpus === "lsm" ? cmDeItemId(itemId) : undefined;
  const sena = corpus === "signaplay" ? senaSignaPlay(itemId) : undefined;
  if (!cm && !sena) {
    return Response.json(
      { error: `El ítem ${itemId} no existe en el corpus ${corpus}` },
      { status: 400 },
    );
  }
  const cmId = cm?.cm_id;
  const gloss = sena?.glosa;

  const participant = await getParticipant(user.userId);
  if (!participant || participant.consent_status !== "granted") {
    return Response.json(
      { error: "Se requiere consentimiento otorgado" },
      { status: 403 },
    );
  }

  // La llave tiene que existir en S3: la confirmación registra un video
  // que ya se subió, no una promesa. Si S3 no responde, no se bloquea.
  const existe = await existeObjeto(awsEnv.recordingsBucket(), s3Key);
  if (existe === false) {
    return Response.json(
      { error: "El video no está en S3; vuelve a subirlo antes de confirmar" },
      { status: 400 },
    );
  }

  // If this sign was previously withdrawn, re-recording must not resurrect it.
  const existing = await getOwnedRecording(user.userId, sessionId, itemId);

  let recording;
  try {
      recording = await putRecording(user.userId, {
      sessionId,
      itemId,
      corpus,
      cmId,
      gloss,
      s3Key,
      durationMs,
      status: "approved",
      accessTier: participant.default_access_tier,
      withdrawn: existing?.withdrawn ?? false,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
  } catch (err) {
    if (esCondicionFallida(err)) {
      return Response.json(
        { error: "Esa sesión pertenece a otra persona; empieza una sesión nueva" },
        { status: 409 },
      );
    }
    throw err;
  }

  // Nueve manos: un video nuevo (no la repetición de una seña ya guardada
  // en esta sesión) suma al total y, si la persona todavía no era una de
  // las manos de la seña, entra a su círculo. Un video retirado y vuelto a
  // grabar sigue retirado y no cuenta.
  let progreso: {
    videos: number;
    /** su lugar en el círculo; null si ya era una de sus manos */
    mano: number | null;
    momentos: Momento[];
  } | null = null;
  if (!existing) {
    // Perfil anterior a los contadores: el contador arranca con lo que ya
    // había grabado (sin contar este video, que ya está puesto).
    let baseSiFalta: number | undefined;
    if (typeof participant.videos_total !== "number") {
      const previas = await listParticipantRecordings(user.userId);
      baseSiFalta = previas.filter(
        (r) =>
          !r.withdrawn &&
          !(r.session_id === sessionId && itemIdDeGrabacion(r) === itemId),
      ).length;
    }
    const { videosTotal, mano } = await contarVideoNuevo(user.userId, {
      corpus,
      itemId,
      recordedAt: recording.recorded_at,
      baseSiFalta,
    });
    // Las señas en las que ya era una mano, sin esta (para atlas y sellos)
    const clave = claveItem(corpus, itemId);
    const antes =
      mano === null
        ? []
        : (await listSenante(user.userId))
            .filter((m) => m.activo)
            .map((m) => claveItem(m.corpus, m.item_id))
            .filter((k) => k !== clave);
    progreso = {
      videos: videosTotal,
      mano,
      momentos: momentosAlGuardar({ corpus, itemId, mano, videos: videosTotal, antes }),
    };
  }

  return Response.json({
    recording,
    id: recordingId(sessionId, itemId),
    progreso,
  });
}
