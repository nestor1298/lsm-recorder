import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { getOwnedRecording } from "@/lib/aws/repo";
import { parseRecordingId } from "@/lib/aws/keys";
import { presignGet } from "@/lib/aws/s3";
import { awsEnv } from "@/lib/aws/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Short-lived presigned GET for playback of the caller's own recording. */
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
  const parsed = parseRecordingId(id);
  if (!parsed) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  const recording = await getOwnedRecording(
    user.userId,
    parsed.sessionId,
    parsed.cmId,
  );
  if (!recording) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const url = await presignGet(awsEnv.recordingsBucket(), recording.s3_key);
  return Response.json({ url });
}
