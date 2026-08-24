import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { getParticipant } from "@/lib/aws/repo";
import {
  presignVideoPut,
  VIDEO_CONTENT_TYPE,
  ALLOWED_VIDEO_TYPES,
} from "@/lib/aws/s3";
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

  // Tipo de video: webm (grabación en navegador) por defecto; mp4/mov para
  // archivos subidos. Cualquier otro tipo se rechaza aquí.
  const requestedType =
    typeof body?.contentType === "string" ? body.contentType : undefined;
  const contentType = requestedType ?? VIDEO_CONTENT_TYPE;
  const ext = ALLOWED_VIDEO_TYPES[contentType];
  if (!ext) {
    return Response.json(
      { error: "Tipo de video no admitido (usa webm, mp4 o mov)" },
      { status: 400 },
    );
  }

  // Key is always prefixed with the caller's userId — the API is the boundary.
  const key = `${user.userId}/${sessionId}/${cmId}.${ext}`;
  const url = await presignVideoPut(awsEnv.recordingsBucket(), key, contentType);

  return Response.json({ url, key, contentType });
}
