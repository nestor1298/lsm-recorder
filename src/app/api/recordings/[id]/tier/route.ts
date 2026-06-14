import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { setRecordingTier } from "@/lib/aws/repo";
import { parseRecordingId } from "@/lib/aws/keys";
import { ACCESS_TIER_VALUES } from "@/lib/tiers";
import type { AccessTier } from "@/lib/aws/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Change the access tier of one of the caller's recordings. */
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

  const body = await req.json().catch(() => null);
  const tier = body?.tier as AccessTier | undefined;
  if (!tier || !ACCESS_TIER_VALUES.includes(tier)) {
    return Response.json({ error: "tier inválido" }, { status: 400 });
  }

  const ok = await setRecordingTier(
    user.userId,
    parsed.sessionId,
    parsed.cmId,
    tier,
  );
  if (!ok) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
