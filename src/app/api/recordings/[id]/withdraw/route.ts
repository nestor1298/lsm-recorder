import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  descontarVideo,
  getOwnedRecording,
  retirarSiActiva,
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

  const antes = await getOwnedRecording(user.userId, parsed.sessionId, parsed.itemId);
  if (!antes) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  // Solo la llamada que la pasa de activa a retirada descuenta: retirar dos
  // veces (o con doble clic) no resta dos veces del nivel ni del tablero.
  const cambio = await retirarSiActiva(user.userId, parsed.sessionId, parsed.itemId);
  if (cambio) {
    await descontarVideo(user.userId, { ...antes, withdrawn: true });
  }
  return Response.json({ ok: true });
}
