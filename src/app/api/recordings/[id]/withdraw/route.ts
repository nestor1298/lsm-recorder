import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  descontarVideo,
  getOwnedRecording,
  withdrawRecording,
} from "@/lib/aws/repo";
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

  // Se lee antes para saber si ya estaba retirada: retirar dos veces no
  // debe descontar dos veces del nivel ni de la cobertura.
  const antes = await getOwnedRecording(user.userId, parsed.sessionId, parsed.itemId);
  if (!antes) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  const ok = await withdrawRecording(user.userId, parsed.sessionId, parsed.itemId);
  if (!ok) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!antes.withdrawn) {
    await descontarVideo(user.userId, { ...antes, withdrawn: true });
  }
  return Response.json({ ok: true });
}
