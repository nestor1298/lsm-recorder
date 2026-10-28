import { requireUser, authErrorResponse } from "@/lib/aws/auth";
import { listTablero } from "@/lib/aws/repo";
import { medallaDe, rangoDeSemana, SEMANA_RE, semanaIso } from "@/lib/progresion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOPE = 20;

/**
 * El tablero de la semana: quién grabó más videos, por apodo. Solo salen
 * apodos (nunca nombres ni ids). `?semana=2026-W44` para otra semana.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(req.url);
  const pedida = url.searchParams.get("semana");
  const semana = pedida && SEMANA_RE.test(pedida) ? pedida : semanaIso(new Date());

  const filas = (await listTablero(semana))
    .filter((f) => Number(f.videos) > 0)
    .sort((a, b) => b.videos - a.videos || a.actualizado.localeCompare(b.actualizado));

  const miPuesto = filas.findIndex((f) => f.user_id === user.userId);
  const mia = miPuesto >= 0 ? filas[miPuesto] : null;

  return Response.json({
    semana,
    rango: rangoDeSemana(semana),
    filas: filas.slice(0, TOPE).map((f, i) => ({
      puesto: i + 1,
      apodo: f.apodo ?? "Sin apodo",
      videos: f.videos,
      nivel: f.nivel,
      medalla: medallaDe(f.nivel)?.id ?? null,
      eresTu: f.user_id === user.userId,
    })),
    total: filas.length,
    tu: mia
      ? { puesto: miPuesto + 1, videos: mia.videos, nivel: mia.nivel }
      : null,
  });
}
