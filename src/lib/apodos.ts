/**
 * apodos.ts — el nombre con el que una persona aparece en la comunidad
 * (los círculos de nueve manos de cada seña).
 *
 * Nunca es su nombre real: otras personas solo ven el apodo. Se valida
 * igual en el cliente y en el servidor; `normalizarApodo` da la forma que
 * se usa para que dos apodos "iguales a la vista" no convivan.
 */

export const APODO_MIN = 3;
export const APODO_MAX = 20;

/**
 * Letras latinas (con acentos y ñ), dígitos 0-9, espacio, guion y guion
 * bajo. Solo alfabeto latino: con cirílico o griego dos apodos idénticos a
 * la vista («Colibrí» con una «о» cirílica) podrían convivir en un mismo círculo.
 */
export const APODO_RE = /^[\p{Script=Latin}0-9][\p{Script=Latin}0-9 _-]{2,19}$/u;

/**
 * Forma para comparar apodos: minúsculas, sin acentos, espacios juntos.
 * La ñ se conserva: «Peña 7» y «Pena 7» son apodos distintos.
 * "Colibrí  42" → "colibri 42".
 */
export function normalizarApodo(apodo: string): string {
  return apodo
    .normalize("NFC")
    .toLowerCase()
    .split("ñ")
    .map((parte) => parte.normalize("NFD").replace(/\p{M}/gu, ""))
    .join("ñ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mensaje de error en español, o null si el apodo sirve. */
export function validarApodo(apodo: unknown): string | null {
  if (typeof apodo !== "string") return "Escribe un apodo.";
  // NFC: lo pegado desde macOS puede venir descompuesto (i + acento)
  const limpio = limpiarApodo(apodo);
  if (limpio.length < APODO_MIN) return `El apodo necesita al menos ${APODO_MIN} caracteres.`;
  if (limpio.length > APODO_MAX) return `El apodo puede tener hasta ${APODO_MAX} caracteres.`;
  if (!APODO_RE.test(limpio)) return "Solo letras, números, espacios, guion y guion bajo.";
  return null;
}

/** Apodo limpio para guardar (espacios juntos, sin orillas). */
export function limpiarApodo(apodo: string): string {
  return apodo.normalize("NFC").replace(/\s+/g, " ").trim();
}

// Naturaleza de México, para sugerir apodos cortos y amables.
export const PALABRAS_APODO = [
  "Colibrí",
  "Jaguar",
  "Ajolote",
  "Quetzal",
  "Nopal",
  "Cenzontle",
  "Guacamaya",
  "Tlacuache",
  "Ocelote",
  "Vaquita",
  "Mariposa",
  "Venado",
  "Tortuga",
  "Lechuza",
  "Coyote",
  "Iguana",
  "Pelícano",
  "Flamenco",
  "Maguey",
  "Dalia",
  "Ceiba",
  "Ahuehuete",
  "Tucán",
  "Manatí",
  "Mapache",
  "Zorro",
  "Halcón",
  "Luciérnaga",
  "Caracol",
  "Nutria",
];

/** "Colibrí 42": una palabra y dos dígitos. `aleatorio` se inyecta para probar. */
export function sugerirApodo(aleatorio: () => number = Math.random): string {
  const palabra = PALABRAS_APODO[Math.floor(aleatorio() * PALABRAS_APODO.length)];
  const n = 10 + Math.floor(aleatorio() * 90);
  return `${palabra} ${n}`;
}
