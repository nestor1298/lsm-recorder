import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import {
  listParticipantAnnotations,
  putAnnotation,
  ensureParticipant,
} from "@/lib/aws/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anotaciones fonológicas de quien llama.
 *
 * GET  → índice ligero (sin `payload`) para decidir qué sincronizar.
 * POST → crea o actualiza una anotación completa.
 *
 * La API es la frontera de seguridad: todo se limita al userId del token.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const items = await listParticipantAnnotations(user.userId);
  const annotations = items
    .filter((a) => !a.deleted)
    .map((a) => ({
      id: a.annotation_id,
      gloss: a.gloss,
      cmId: a.cm_id,
      status: a.status,
      segmentCount: a.segment_count,
      recordingId: a.recording_id,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

  return Response.json({ annotations });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = (await req.json().catch(() => null)) as {
    annotation?: Record<string, unknown>;
    recordingId?: string;
  } | null;
  const ann = body?.annotation;

  if (
    !ann ||
    typeof ann.id !== "string" ||
    typeof ann.updated_at !== "string" ||
    !Array.isArray(ann.segments)
  ) {
    return Response.json(
      { error: "Falta la anotación o le faltan campos (id, updated_at, segments)" },
      { status: 400 },
    );
  }

  await ensureParticipant(user.userId);

  try {
    await putAnnotation(user.userId, {
      id: ann.id,
      gloss: typeof ann.gloss === "string" ? ann.gloss : "sin nombre",
      cm_id: typeof ann.cm_id === "number" ? ann.cm_id : 0,
      status: typeof ann.status === "string" ? ann.status : "draft",
      created_at:
        typeof ann.created_at === "string"
          ? ann.created_at
          : new Date().toISOString(),
      updated_at: ann.updated_at,
      recording_id: body?.recordingId,
      schema_version: "1.1",
      segment_count: ann.segments.length,
      payload: ann as Record<string, unknown>,
    });
  } catch {
    // La condición falla cuando el id ya existe y es de otra persona.
    return Response.json(
      { error: "Esa anotación pertenece a otra persona" },
      { status: 409 },
    );
  }

  return Response.json({ id: ann.id, updatedAt: ann.updated_at });
}
