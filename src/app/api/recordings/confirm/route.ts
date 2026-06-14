import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  getParticipant,
  getOwnedRecording,
  putRecording,
} from "@/lib/aws/repo";
import { recordingId } from "@/lib/aws/keys";

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
  const cmId = body?.cmId;
  const s3Key = body?.s3Key;
  const durationMs = body?.durationMs;
  if (
    typeof sessionId !== "string" ||
    !Number.isInteger(cmId) ||
    typeof s3Key !== "string" ||
    !Number.isFinite(durationMs)
  ) {
    return Response.json(
      { error: "sessionId, cmId, s3Key y durationMs son requeridos" },
      { status: 400 },
    );
  }

  // The key must belong to the caller and match the expected layout.
  const expectedKey = `${user.userId}/${sessionId}/${cmId}.webm`;
  if (s3Key !== expectedKey) {
    return Response.json({ error: "s3Key inválida" }, { status: 400 });
  }

  const participant = await getParticipant(user.userId);
  if (!participant || participant.consent_status !== "granted") {
    return Response.json(
      { error: "Se requiere consentimiento otorgado" },
      { status: 403 },
    );
  }

  // If this sign was previously withdrawn, re-recording must not resurrect it.
  const existing = await getOwnedRecording(user.userId, sessionId, cmId);

  const recording = await putRecording(user.userId, {
    sessionId,
    cmId,
    s3Key,
    durationMs,
    status: "approved",
    accessTier: participant.default_access_tier,
    withdrawn: existing?.withdrawn ?? false,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  return Response.json({
    recording,
    id: recordingId(sessionId, cmId),
  });
}
