import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { ensureParticipant, setConsent } from "@/lib/aws/repo";
import { ACCESS_TIER_VALUES } from "@/lib/tiers";
import { ACUERDO_VERSION } from "@/lib/acuerdo";
import type { AccessTier, ConsentMode } from "@/lib/aws/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: ConsentMode[] = ["video", "text"];
const NOMBRE_MAX = 80;

/**
 * Grant consent and set the default access tier.
 *
 * Camino del señante: la firma en texto es la palomita más el nombre
 * escrito (`signedName`, obligatorio en modo texto); en modo video la
 * firma es el video en LSM y el nombre es opcional. Se guarda la versión
 * del acuerdo que se firmó.
 */
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
  const signedName =
    typeof body?.signedName === "string"
      ? body.signedName.replace(/\s+/g, " ").trim().slice(0, NOMBRE_MAX)
      : "";
  const agreementVersion =
    typeof body?.agreementVersion === "string" && body.agreementVersion.length <= 16
      ? body.agreementVersion
      : undefined;

  if (!mode || !MODES.includes(mode)) {
    return Response.json({ error: "mode inválido" }, { status: 400 });
  }
  if (!defaultTier || !ACCESS_TIER_VALUES.includes(defaultTier)) {
    return Response.json({ error: "defaultTier inválido" }, { status: 400 });
  }
  if (mode === "video" && videoKey !== `${user.userId}/consent.webm`) {
    return Response.json({ error: "videoKey inválida" }, { status: 400 });
  }
  // La firma escrita solo se exige cuando el acuerdo se firma por escrito
  // (los clientes anteriores al acuerdo no mandan versión).
  if (mode === "text" && agreementVersion && signedName.length < 2) {
    return Response.json(
      { error: "Escribe tu nombre para firmar el acuerdo" },
      { status: 400 },
    );
  }
  if (agreementVersion && agreementVersion !== ACUERDO_VERSION) {
    return Response.json(
      { error: `El acuerdo cambió (versión ${ACUERDO_VERSION}); recarga y vuelve a leerlo` },
      { status: 409 },
    );
  }

  await ensureParticipant(user.userId);
  await setConsent(user.userId, {
    mode,
    videoKey: mode === "video" ? videoKey : undefined,
    defaultTier,
    signedName: signedName || undefined,
    agreementVersion,
  });

  return Response.json({ ok: true });
}
