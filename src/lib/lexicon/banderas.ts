/** Banderas de calidad del léxico (qa.flags), en palabras */
export const BANDERAS_ES: Record<string, string> = {
  sin_video: "El video ya no está en YouTube (privado o borrado)",
  sin_mano: "No se detectó la mano en el video",
  cm_dudosa: "Forma de mano dudosa",
  cm_empate: "La forma empata con otras parecidas",
  cm_2d: "La forma sale de manos vistas solo en 2D",
  pocos_cuadros: "Pocos cuadros con la mano visible",
  sin_ub: "No se pudo ubicar la mano",
  otra_lengua: "Seña de otra lengua de señas",
  dactilologia: "Deletreo manual",
};
