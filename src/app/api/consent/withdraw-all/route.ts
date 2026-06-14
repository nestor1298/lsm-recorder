import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { withdrawAllConsent } from "@/lib/aws/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Withdraw all consent: blocks further recording until re-granted. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  await withdrawAllConsent(user.userId);
  return Response.json({ ok: true });
}
