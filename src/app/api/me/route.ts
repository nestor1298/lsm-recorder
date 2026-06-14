import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { ensureParticipant, getParticipant } from "@/lib/aws/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bootstrap endpoint: ensures the participant profile exists, returns status. */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  await ensureParticipant(user.userId);
  const participant = await getParticipant(user.userId);

  return Response.json({
    userId: user.userId,
    consentStatus: participant?.consent_status ?? "none",
    defaultTier: participant?.default_access_tier ?? "restringido",
    hasMetadata: Boolean(participant?.metadata),
    displayName: participant?.display_name,
  });
}
