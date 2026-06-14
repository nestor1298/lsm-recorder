import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { ensureParticipant, setParticipantMetadata } from "@/lib/aws/repo";
import type { ParticipantMetadata } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGE_BANDS = ["18-30", "31-45", "46-60", "60+"];
const ACQUISITION = [
  "desde_nacimiento",
  "antes_de_7",
  "entre_7_y_12",
  "adolescencia",
  "adultez",
];
const LEARNED = ["familia", "escuela", "amistades", "asociacion", "otro"];
const DEAF_FAMILY = ["si", "no", "no_se"];
const HEARING = ["sorde", "hipoacusique", "oyente"];
const COMMUNITY = ["frecuente", "ocasional", "poca"];

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly string[],
): T | undefined {
  return typeof value === "string" && allowed.includes(value)
    ? (value as T)
    : undefined;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Save the participant questionnaire. edad + edad_adquisicion are required. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = await req.json().catch(() => null);
  const edad = pickEnum<ParticipantMetadata["edad"]>(body?.edad, AGE_BANDS);
  const edad_adquisicion = pickEnum<ParticipantMetadata["edad_adquisicion"]>(
    body?.edad_adquisicion,
    ACQUISITION,
  );
  if (!edad || !edad_adquisicion) {
    return Response.json(
      { error: "edad y edad_adquisicion son requeridos" },
      { status: 400 },
    );
  }

  // Whitelist only known fields — never store arbitrary client data.
  const anios = Number(body?.anios_en_region);
  const metadata: ParticipantMetadata = {
    edad,
    edad_adquisicion,
    genero: pickString(body?.genero),
    region_vive: pickString(body?.region_vive),
    anios_en_region: Number.isFinite(anios) && anios >= 0 ? anios : undefined,
    lugar_crecio: pickString(body?.lugar_crecio),
    como_aprendio: pickEnum<NonNullable<ParticipantMetadata["como_aprendio"]>>(
      body?.como_aprendio,
      LEARNED,
    ),
    personas_sordas_familia: pickEnum<
      NonNullable<ParticipantMetadata["personas_sordas_familia"]>
    >(body?.personas_sordas_familia, DEAF_FAMILY),
    lengua_casa: pickString(body?.lengua_casa),
    lengua_escuela: pickString(body?.lengua_escuela),
    audicion: pickEnum<NonNullable<ParticipantMetadata["audicion"]>>(
      body?.audicion,
      HEARING,
    ),
    participacion_comunidad: pickEnum<
      NonNullable<ParticipantMetadata["participacion_comunidad"]>
    >(body?.participacion_comunidad, COMMUNITY),
  };

  await ensureParticipant(user.userId);
  await setParticipantMetadata(
    user.userId,
    metadata as unknown as Record<string, unknown>,
  );
  return Response.json({ ok: true });
}
