import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  ensureParticipant,
  getParticipant,
  listParticipantRecordings,
} from "@/lib/aws/repo";
import { medallaDe, nivelDe } from "@/lib/progresion";

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
  // Perfiles anteriores a los contadores: se cuentan sus grabaciones activas
  // (el contador nace con el primer video confirmado desde entonces).
  const videos =
    typeof participant?.videos_total === "number"
      ? Math.max(0, participant.videos_total)
      : (await listParticipantRecordings(user.userId)).filter((r) => !r.withdrawn).length;
  const nivel = nivelDe(videos);

  return Response.json({
    userId: user.userId,
    consentStatus: participant?.consent_status ?? "none",
    defaultTier: participant?.default_access_tier ?? "restringido",
    hasMetadata: Boolean(participant?.metadata),
    displayName: participant?.display_name,
    // Camino del señante
    apodo: participant?.apodo ?? null,
    agreementVersion: participant?.consent_agreement_version ?? null,
    videos,
    nivel,
    medalla: medallaDe(nivel)?.id ?? null,
  });
}
