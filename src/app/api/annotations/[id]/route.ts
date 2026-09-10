import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { getOwnedAnnotation, softDeleteAnnotation } from "@/lib/aws/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Una anotación propia, completa (con su LSM-PN). */
export async function GET(
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
  const item = await getOwnedAnnotation(user.userId, id);
  if (!item || item.deleted) {
    return Response.json({ error: "No encontrada" }, { status: 404 });
  }
  return Response.json({
    annotation: item.payload,
    updatedAt: item.updated_at,
    recordingId: item.recording_id,
  });
}

/** Borrado suave: la anotación deja de listarse pero queda auditable. */
export async function DELETE(
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
  const ok = await softDeleteAnnotation(user.userId, id);
  if (!ok) {
    return Response.json(
      { error: "No se pudo eliminar (¿es tuya?)" },
      { status: 404 },
    );
  }
  return Response.json({ ok: true });
}
