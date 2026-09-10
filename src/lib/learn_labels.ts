/**
 * learn_labels.ts — textos es-MX de "Aprender".
 *
 * Los cinco parámetros de Cruz Aldrete con una descripción en lenguaje
 * llano: la sección enseña, así que cada campo explica qué es antes de
 * pedir que se use.
 */

export type ParametroId = "cm" | "ub" | "or" | "mv" | "rnm";

export interface ParametroInfo {
  id: ParametroId;
  sigla: string;
  nombre: string;
  descripcion: string;
  /** qué observar en el avatar mientras se explora */
  observa: string;
}

export const PARAMETROS: ParametroInfo[] = [
  {
    id: "cm",
    sigla: "CM",
    nombre: "Configuración manual",
    descripcion:
      "La forma que toma la mano: qué dedos se extienden, cuáles se doblan y dónde queda el pulgar. La LSM usa 101 configuraciones.",
    observa: "Mira los dedos de la mano derecha del avatar.",
  },
  {
    id: "ub",
    sigla: "UB",
    nombre: "Ubicación",
    descripcion:
      "El lugar del cuerpo o del espacio donde se hace la seña: la frente, la barbilla, el pecho o el espacio frente al cuerpo.",
    observa: "Toca un punto del cuerpo del avatar para llevar la mano ahí.",
  },
  {
    id: "or",
    sigla: "OR",
    nombre: "Orientación",
    descripcion:
      "Hacia dónde mira la palma y hacia dónde apuntan los dedos. La misma forma de mano cambia de significado si se gira.",
    observa: "Observa cómo gira la mano sin cambiar de forma.",
  },
  {
    id: "mv",
    sigla: "MV",
    nombre: "Movimiento",
    descripcion:
      "La trayectoria que dibuja la mano entre dos detenciones —recta, en arco, en círculo— y los movimientos pequeños de dedos o muñeca.",
    observa: "El avatar repite la trayectoria para que la compares.",
  },
  {
    id: "rnm",
    sigla: "RNM",
    nombre: "Rasgos no manuales",
    descripcion:
      "Cejas, boca y cabeza. En LSM son gramaticales: marcan preguntas, intensidad y hasta distinguen señas completas.",
    observa: "Mira el rostro y la cabeza del avatar.",
  },
];

export const APRENDER_ES = {
  titulo: "Representación fonológica LSM",
  subtitulo:
    "Cada seña se describe con cinco parámetros. Explóralos uno por uno o construye una seña completa.",
  modoExplorar: "Explorar",
  modoConstruir: "Construir",
  matriz: "Matriz segmental",
  matrizAyuda:
    "Una seña es una secuencia de detenciones (D) y movimientos (M). Todo movimiento necesita una detención inicial y una final.",
  filaCuerpo: "Cuerpo",
  filaCara: "Cara",
  agregarMovimiento: "Agregar movimiento",
  quitarMovimiento: "Quitar este movimiento",
  reproducir: "Reproducir",
  pausar: "Pausar",
  repetir: "Repetir",
  lento: "Lento",
  movBloqueado: "Completa primero la detención inicial y la final",
  incompleta: "Faltan campos por llenar en las detenciones",
  editando: "Editando",
  cerrar: "Cerrar",
  detencion: "Detención",
  movimiento: "Movimiento",
} as const;

/** Nombre corto de cada campo de la matriz. */
export const CAMPO_ES: Record<string, string> = {
  cm: "Forma",
  ub: "Lugar",
  or: "Orientación",
  contorno: "Trayectoria",
  plano: "Plano",
  local: "Local",
  cejas: "Cejas",
  boca: "Boca",
  cabeza: "Cabeza",
};
