/**
 * mapa_mx.ts — México en mosaico: una casilla por estado, en una rejilla
 * de 10 × 5 que respeta la vecindad aproximada (no la forma ni el tamaño).
 * Lo usa el mapa de manos por estado de /comunidad.
 */

import { ESTADOS_MX } from "./estados_mx";

export type EstadoMx = (typeof ESTADOS_MX)[number];

export interface Casilla {
  estado: EstadoMx;
  abrev: string;
  col: number;
  fila: number;
}

export const MAPA_COLS = 10;
export const MAPA_FILAS = 5;

export const MAPA_MX: Casilla[] = [
  { estado: "Baja California", abrev: "BC", col: 0, fila: 0 },
  { estado: "Sonora", abrev: "SON", col: 1, fila: 0 },
  { estado: "Chihuahua", abrev: "CHIH", col: 2, fila: 0 },
  { estado: "Coahuila", abrev: "COAH", col: 3, fila: 0 },
  { estado: "Nuevo León", abrev: "NL", col: 4, fila: 0 },
  { estado: "Baja California Sur", abrev: "BCS", col: 0, fila: 1 },
  { estado: "Sinaloa", abrev: "SIN", col: 1, fila: 1 },
  { estado: "Durango", abrev: "DGO", col: 2, fila: 1 },
  { estado: "Zacatecas", abrev: "ZAC", col: 3, fila: 1 },
  { estado: "San Luis Potosí", abrev: "SLP", col: 4, fila: 1 },
  { estado: "Tamaulipas", abrev: "TAMS", col: 5, fila: 1 },
  { estado: "Nayarit", abrev: "NAY", col: 1, fila: 2 },
  { estado: "Aguascalientes", abrev: "AGS", col: 2, fila: 2 },
  { estado: "Guanajuato", abrev: "GTO", col: 3, fila: 2 },
  { estado: "Querétaro", abrev: "QRO", col: 4, fila: 2 },
  { estado: "Hidalgo", abrev: "HGO", col: 5, fila: 2 },
  { estado: "Veracruz", abrev: "VER", col: 6, fila: 2 },
  { estado: "Jalisco", abrev: "JAL", col: 1, fila: 3 },
  { estado: "Michoacán", abrev: "MICH", col: 2, fila: 3 },
  { estado: "Estado de México", abrev: "MEX", col: 3, fila: 3 },
  { estado: "Ciudad de México", abrev: "CDMX", col: 4, fila: 3 },
  { estado: "Tlaxcala", abrev: "TLAX", col: 5, fila: 3 },
  { estado: "Puebla", abrev: "PUE", col: 6, fila: 3 },
  { estado: "Tabasco", abrev: "TAB", col: 7, fila: 3 },
  { estado: "Campeche", abrev: "CAMP", col: 8, fila: 3 },
  { estado: "Yucatán", abrev: "YUC", col: 9, fila: 3 },
  { estado: "Colima", abrev: "COL", col: 2, fila: 4 },
  { estado: "Guerrero", abrev: "GRO", col: 3, fila: 4 },
  { estado: "Morelos", abrev: "MOR", col: 4, fila: 4 },
  { estado: "Oaxaca", abrev: "OAX", col: 5, fila: 4 },
  { estado: "Chiapas", abrev: "CHIS", col: 7, fila: 4 },
  { estado: "Quintana Roo", abrev: "QROO", col: 9, fila: 4 },
];

const NOMBRES = new Set<string>(ESTADOS_MX);

export function esEstadoMx(x: unknown): x is EstadoMx {
  return typeof x === "string" && NOMBRES.has(x);
}
