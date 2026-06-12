import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { getParticipant, putSession } from "@/lib/aws/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create (or overwrite) a recording session for the caller. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.sessionId !== "string" ||
    typeof body.name !== "string"
  ) {
    return Response.json(
      { error: "sessionId y name son requeridos" },
      { status: 400 },
    );
  }

  // No recording (or session) without granted consent.
  const participant = await getParticipant(user.userId);
  if (!participant || participant.consent_status !== "granted") {
    return Response.json(
      { error: "Se requiere consentimiento otorgado" },
      { status: 403 },
    );
  }

  const session = await putSession(user.userId, {
    sessionId: body.sessionId,
    name: body.name,
    deviceInfo:
      body.deviceInfo && typeof body.deviceInfo === "object"
        ? body.deviceInfo
        : undefined,
    sessionMetadata:
      body.sessionMetadata && typeof body.sessionMetadata === "object"
        ? body.sessionMetadata
        : undefined,
  });

  return Response.json({ session });
}
