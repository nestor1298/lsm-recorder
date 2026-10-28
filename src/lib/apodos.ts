/**
 * apodos.ts — el nombre con el que una persona aparece en el tablero.
 *
 * Nunca es su nombre real: otras personas solo ven el apodo. Se valida
 * igual en el cliente y en el servidor; `normalizarApodo` da la forma que
 * se usa para que dos apodos "iguales a la vista" no convivan.
 */

export const APODO_MIN = 3;
export const APODO_MAX = 20;

/** Letras (con acentos y ñ), dígitos, espacio, guion y guion bajo. */
export const APODO_RE = /^[\p{L}\p{N}][\p{L}\p{N} _-]{2,19}$/u;

/** Quita acentos, junta espacios y pasa a minúsculas: "Colibrí  42" → "colibri 42". */
export function normalizarApodo(apodo: string): string {
  return apodo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Mensaje de error en español, o null si el apodo sirve. */
export function validarApodo(apodo: unknown): string | null {
  if (typeof apodo !== "string") return "Escribe un apodo.";
  const limpio = apodo.replace(/\s+/g, " ").trim();
  if (limpio.length < APODO_MIN) return `El apodo necesita al menos ${APODO_MIN} caracteres.`;
  if (limpio.length > APODO_MAX) return `El apodo puede tener hasta ${APODO_MAX} caracteres.`;
  if (!APODO_RE.test(limpio)) return "Solo letras, números, espacios, guion y guion bajo.";
  return null;
}

/** Apodo limpio para guardar (espacios juntos, sin orillas). */
export function limpiarApodo(apodo: string): string {
  return apodo.replace(/\s+/g, " ").trim();
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
