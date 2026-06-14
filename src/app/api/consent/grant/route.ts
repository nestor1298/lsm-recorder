import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { ensureParticipant, setConsent } from "@/lib/aws/repo";
import { ACCESS_TIER_VALUES } from "@/lib/tiers";
import type { AccessTier, ConsentMode } from "@/lib/aws/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: ConsentMode[] = ["video", "text"];

/** Grant consent (video or text-only) and set the default access tier. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const mode = body?.mode as ConsentMode | undefined;
  const defaultTier = body?.defaultTier as AccessTier | undefined;
  const videoKey = body?.videoKey as string | undefined;

  if (!mode || !MODES.includes(mode)) {
    return Response.json({ error: "mode inválido" }, { status: 400 });
  }
  if (!defaultTier || !ACCESS_TIER_VALUES.includes(defaultTier)) {
    return Response.json({ error: "defaultTier inválido" }, { status: 400 });
  }
  // The "continuar solo con texto" skip path is mode=text (recorded below).
  if (mode === "video" && videoKey !== `${user.userId}/consent.webm`) {
    return Response.json({ error: "videoKey inválida" }, { status: 400 });
  }

  await ensureParticipant(user.userId);
  await setConsent(user.userId, {
    mode,
    videoKey: mode === "video" ? videoKey : undefined,
    defaultTier,
  });

  return Response.json({ ok: true });
}
