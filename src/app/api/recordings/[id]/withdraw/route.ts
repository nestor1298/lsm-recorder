import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { withdrawRecording } from "@/lib/aws/repo";
import { parseRecordingId } from "@/lib/aws/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Soft-delete (withdraw) one of the caller's recordings. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const { id } = await ctx.params;
  const parsed = parseRecordingId(id);
  if (!parsed) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  const ok = await withdrawRecording(user.userId, parsed.sessionId, parsed.cmId);
  if (!ok) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
