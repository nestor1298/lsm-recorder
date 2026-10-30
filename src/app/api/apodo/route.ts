import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { ensureParticipant, reclamarApodo } from "@/lib/aws/repo";
import { limpiarApodo, validarApodo } from "@/lib/apodos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reclama el apodo con el que la persona aparece en la comunidad. 409 si ya
 * lo tiene alguien más. Nunca se guarda el nombre real aquí.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const error = validarApodo(body?.apodo);
  if (error) return Response.json({ error }, { status: 400 });
  const apodo = limpiarApodo(body.apodo as string);

  await ensureParticipant(user.userId);
  const resultado = await reclamarApodo(user.userId, apodo);
  if (resultado === "ocupado") {
    return Response.json(
      { error: "Alguien ya tiene ese apodo. Prueba otro." },
      { status: 409 },
    );
  }
  return Response.json({ ok: true, apodo });
}
