import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { ensureParticipant } from "@/lib/aws/repo";
import { presignVideoPut, VIDEO_CONTENT_TYPE } from "@/lib/aws/s3";
import { awsEnv } from "@/lib/aws/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Presigned PUT for the participant's consent video (consent bucket). */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  await ensureParticipant(user.userId, user.email);
  const key = `${user.userId}/consent.webm`;
  const url = await presignVideoPut(awsEnv.consentBucket(), key);
  return Response.json({ url, key, contentType: VIDEO_CONTENT_TYPE });
}
