import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  getParticipant,
  getOwnedRecording,
  putRecording,
} from "@/lib/aws/repo";
import { recordingId } from "@/lib/aws/keys";
import { ALLOWED_VIDEO_TYPES } from "@/lib/aws/s3";
import { leerCorpus, leerItemId } from "@/lib/aws/item";

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
  const sessionId = body?.sessionId;
  const itemId = leerItemId(body);
  const s3Key = body?.s3Key;
  const durationMs = body?.durationMs;
  if (
    typeof sessionId !== "string" ||
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

  const corpus = leerCorpus(body);
  const cmId =
    corpus === "lsm" && Number.isInteger(Number(itemId))
      ? Number(itemId)
      : undefined;
  const gloss =
    typeof body.gloss === "string" && body.gloss.length <= 80
      ? body.gloss
      : undefined;

  const participant = await getParticipant(user.userId);
  if (!participant || participant.consent_status !== "granted") {
    return Response.json(
      { error: "Se requiere consentimiento otorgado" },
      { status: 403 },
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
