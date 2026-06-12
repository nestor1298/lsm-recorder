import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { listParticipantRecordings } from "@/lib/aws/repo";
import { recordingId } from "@/lib/aws/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List all of the caller's recordings across sessions (via gsi1). */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const items = await listParticipantRecordings(user.userId);
  const recordings = items.map((r) => ({
    id: recordingId(r.session_id, r.cm_id),
    sessionId: r.session_id,
    cmId: r.cm_id,
    recordedAt: r.recorded_at,
    durationMs: r.duration_ms,
    status: r.status,
    accessTier: r.access_tier,
    withdrawn: r.withdrawn,
  }));

  return Response.json({ recordings });
}
