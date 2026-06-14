import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { getParticipant } from "@/lib/aws/repo";
import { presignVideoPut, VIDEO_CONTENT_TYPE } from "@/lib/aws/s3";
import { awsEnv } from "@/lib/aws/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Issue a short-lived presigned PUT for a sign recording, scoped to the caller. */
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
  if (typeof sessionId !== "string" || !Number.isInteger(cmId)) {
    return Response.json(
      { error: "sessionId (string) y cmId (entero) son requeridos" },
      { status: 400 },
    );
  }

  const participant = await getParticipant(user.userId);
  if (!participant || participant.consent_status !== "granted") {
    return Response.json(
      { error: "Se requiere consentimiento otorgado" },
      { status: 403 },
    );
  }

  // Key is always prefixed with the caller's userId — the API is the boundary.
  const key = `${user.userId}/${sessionId}/${cmId}.webm`;
  const url = await presignVideoPut(awsEnv.recordingsBucket(), key);

  return Response.json({ url, key, contentType: VIDEO_CONTENT_TYPE });
}
