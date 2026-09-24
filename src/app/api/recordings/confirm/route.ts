import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  getParticipant,
  getOwnedRecording,
  putRecording,
} from "@/lib/aws/repo";
import { recordingId } from "@/lib/aws/keys";
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

  const recording = await putRecording(user.userId, {
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

  return Response.json({
    recording,
    id: recordingId(sessionId, itemId),
  });
}
