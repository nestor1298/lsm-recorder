// UB (Ubicación) Inventario de puntos — Cruz Aldrete (2008)
// 80 puntos de articulación mapeados a regiones corporales

export interface UBLocation {
  code: string;
  region: "HEAD" | "FACE" | "NECK" | "TRUNK" | "ARM" | "FOREARM" | "HAND" | "NEUTRAL_SPACE";
  name: string;
  latin?: string;
  /** Coordenadas SVG en silueta corporal de 200x500 */
  x: number;
  y: number;
  /** Top-20 ubicaciones más frecuentes */
  frequent?: boolean;
}

// Agrupación por zona para zoom
export type BodyZone = "full" | "head" | "trunk" | "arm" | "hand";

export const UB_LOCATIONS: UBLocation[] = [
  // ── Cabeza y cara (35) ───────────────────────────────────────
  // Cráneo
  { code: "Ca",  region: "HEAD", name: "Cabeza",        latin: "caput",     x: 100, y: 28,  frequent: true },
  { code: "Vx",  region: "HEAD", name: "Coronilla",     latin: "vertex",    x: 100, y: 16 },
  { code: "Par", region: "HEAD", name: "Parietal",      latin: "parietalis", x: 116, y: 22 },
  { code: "Te",  region: "HEAD", name: "Sien",          latin: "tempus",    x: 78,  y: 38,  frequent: true },
  { code: "Au",  region: "HEAD", name: "Oreja",         latin: "auris",     x: 72,  y: 48 },
  { code: "LobAu", region: "HEAD", name: "Lóbulo",                         x: 72,  y: 54 },

  // Cara — superior
  { code: "Fa",  region: "FACE", name: "Cara",            latin: "facies",    x: 100, y: 48,  frequent: true },
  { code: "Fr",  region: "FACE", name: "Frente",          latin: "frons",     x: 100, y: 36,  frequent: true },
  { code: "IpsiFr", region: "FACE", name: "Frente-ipsi",                     x: 90,  y: 36 },
  { code: "XFr", region: "FACE", name: "Frente-contra",                      x: 110, y: 36 },
  { code: "Ci",  region: "FACE", name: "Ceja",            latin: "cilium",    x: 90,  y: 42 },
  { code: "Su",  region: "FACE", name: "Ceja",            latin: "cilium",    x: 110, y: 42 },
  { code: "Cin", region: "FACE", name: "Entrecejo",       latin: "cinnus",    x: 100, y: 42 },

  // Cara — ojos
  { code: "Oc",  region: "FACE", name: "Ojo",              latin: "oculus",    x: 91,  y: 46,  frequent: true },
  { code: "RapOc", region: "FACE", name: "Rabillo del ojo", latin: "rapum oculus", x: 84, y: 46 },
  { code: "OrbOc", region: "FACE", name: "Órbita ocular",                     x: 91,  y: 44 },

  // Cara — nariz
  { code: "Na",  region: "FACE", name: "Punta de nariz",  latin: "nasus",     x: 100, y: 54,  frequent: true },
  { code: "Sep", region: "FACE", name: "Puente nasal",    latin: "septum",    x: 100, y: 50 },
  { code: "AlNa", region: "FACE", name: "Alas nasales",                       x: 96,  y: 53 },

  // Cara — mejillas
  { code: "Po",  region: "FACE", name: "Pómulo",    latin: "pomulum",   x: 84,  y: 52 },
  { code: "Ge",  region: "FACE", name: "Mejilla",   latin: "gena",      x: 84,  y: 58,  frequent: true },

  // Cara — boca
  { code: "Os",  region: "FACE", name: "Boca",              latin: "os",        x: 100, y: 60,  frequent: true },
  { code: "IpsiOs", region: "FACE", name: "Boca-ipsi",                          x: 93,  y: 60 },
  { code: "XOs", region: "FACE", name: "Boca-contra",                           x: 107, y: 60 },
  { code: "La",  region: "FACE", name: "Labio inferior",    latin: "labium",    x: 100, y: 62 },
  { code: "Lab", region: "FACE", name: "Labio superior",    latin: "labium",    x: 100, y: 58 },
  { code: "Lin", region: "FACE", name: "Lengua",            latin: "lingua",    x: 100, y: 61 },
  { code: "Den", region: "FACE", name: "Dientes",           latin: "dentia",    x: 100, y: 59 },
  { code: "Col", region: "FACE", name: "Colmillo",                              x: 94,  y: 59 },
  { code: "MedDen", region: "FACE", name: "Incisivos",      latin: "medii dentes", x: 100, y: 59 },

  // Cara — mentón
  { code: "Me",  region: "FACE", name: "Mentón",    latin: "mentum",    x: 100, y: 66,  frequent: true },

  // Cuello
  { code: "Ce",  region: "NECK", name: "Nuca",          latin: "cervix",    x: 120, y: 72 },
  { code: "Gu",  region: "NECK", name: "Garganta",      latin: "guttur",    x: 100, y: 72 },
  { code: "Co",  region: "NECK", name: "Cuello",        latin: "collum",    x: 100, y: 78,  frequent: true },
  { code: "IpsiCo", region: "NECK", name: "Cuello-ipsi",                    x: 90,  y: 78 },

  // ── Tronco y piernas (17) ────────────────────────────────────
  { code: "Cla", region: "TRUNK", name: "Clavícula",      latin: "clavicula", x: 84,  y: 92 },
  { code: "Um",  region: "TRUNK", name: "Hombro",         latin: "umerus",    x: 68,  y: 92,  frequent: true },
  { code: "Pe",  region: "TRUNK", name: "Pecho",          latin: "pectus",    x: 100, y: 110, frequent: true },
  { code: "XPe", region: "TRUNK", name: "Pecho-contra",                       x: 112, y: 110 },
  { code: "IpsiPe", region: "TRUNK", name: "Pecho-ipsi",                      x: 88,  y: 110 },
  { code: "Cor", region: "TRUNK", name: "Corazón",        latin: "cor",       x: 110, y: 108 },
  { code: "Es",  region: "TRUNK", name: "Esternón",                           x: 100, y: 105 },
  { code: "To",  region: "TRUNK", name: "Tórax",                              x: 100, y: 115 },
  { code: "Cos", region: "TRUNK", name: "Costillas",      latin: "costae",    x: 80,  y: 118 },
  { code: "Dor", region: "TRUNK", name: "Espalda",        latin: "dorsum",    x: 130, y: 115 },
  { code: "Ve",  region: "TRUNK", name: "Estómago",       latin: "venter",    x: 100, y: 140, frequent: true },
  { code: "Abd", region: "TRUNK", name: "Abdomen",                            x: 100, y: 155 },
  { code: "Je",  region: "TRUNK", name: "Hígado",         latin: "jecur",     x: 88,  y: 135 },
  { code: "Cit", region: "TRUNK", name: "Cintura",        latin: "cinctura",  x: 80,  y: 165 },
  { code: "Cox", region: "TRUNK", name: "Cadera",         latin: "coxa",      x: 76,  y: 180 },
  { code: "Fe",  region: "TRUNK", name: "Muslo",          latin: "femur",     x: 82,  y: 210 },
  { code: "Gen", region: "TRUNK", name: "Rodilla",        latin: "genu",      x: 82,  y: 240 },

  // ── Brazo y antebrazo (11) ───────────────────────────────────
  { code: "Br",  region: "ARM", name: "Brazo",                  latin: "bracchium", x: 54,  y: 120, frequent: true },
  { code: "IntBr", region: "ARM", name: "Brazo-interior",                            x: 60,  y: 120 },
  { code: "Cut", region: "ARM", name: "Codo",                   latin: "cubitus",    x: 48,  y: 145, frequent: true },
  { code: "Abr", region: "FOREARM", name: "Antebrazo",                               x: 46,  y: 170, frequent: true },
  { code: "IntAbr", region: "FOREARM", name: "Antebrazo-interior",                    x: 50,  y: 170 },
  { code: "InfAbr", region: "FOREARM", name: "Antebrazo-inferior",                    x: 44,  y: 180 },
  { code: "RAAbr", region: "FOREARM", name: "Antebrazo-radial",                       x: 42,  y: 165 },
  { code: "ExtAbr", region: "FOREARM", name: "Antebrazo-exterior",                    x: 40,  y: 170 },
  { code: "Car", region: "HAND", name: "Muñeca",                latin: "carpus",     x: 40,  y: 195, frequent: true },
  { code: "ExtCar", region: "HAND", name: "Muñeca-exterior",                          x: 36,  y: 195 },
  { code: "IntCar", region: "HAND", name: "Muñeca-interior",                          x: 44,  y: 195 },

  // ── Mano y dedos (17) ──────────────────────────────────────
  { code: "Palma", region: "HAND", name: "Palma",                            x: 38, y: 210, frequent: true },
  { code: "ExtMano", region: "HAND", name: "Dorso de mano",                  x: 34, y: 208 },
  { code: "Dorso", region: "HAND", name: "Dorso de mano",                    x: 34, y: 212 },
  { code: "D1",  region: "HAND", name: "Dedo índice",                        x: 30, y: 224 },
  { code: "D2",  region: "HAND", name: "Dedo medio",                         x: 34, y: 228 },
  { code: "D3",  region: "HAND", name: "Dedo anular",                        x: 38, y: 226 },
  { code: "D4",  region: "HAND", name: "Dedo meñique",                       x: 42, y: 222 },
  { code: "PuntDed", region: "HAND", name: "Puntas de dedos",                x: 28, y: 232, frequent: true },
  { code: "Pol", region: "HAND", name: "Pulgar",          latin: "pollex",   x: 48, y: 208 },
  { code: "IntDed", region: "HAND", name: "Dedos-interior",                  x: 34, y: 220 },
  { code: "ExtDed", region: "HAND", name: "Dedos-exterior",                  x: 28, y: 218 },
  { code: "Nod", region: "HAND", name: "Nudillos",        latin: "nodus",    x: 34, y: 216 },
  { code: "Base", region: "HAND", name: "Base de mano",                      x: 40, y: 202 },
  { code: "Cub", region: "HAND", name: "Lado cubital",                       x: 46, y: 210 },
  { code: "RA",  region: "HAND", name: "Lado radial",                        x: 30, y: 210 },
  { code: "Gem", region: "HAND", name: "Yema del dedo",   latin: "gemma",    x: 30, y: 230 },
  { code: "Ung", region: "HAND", name: "Uña",             latin: "unguis",   x: 32, y: 230 },
];

// Top-20 ubicaciones frecuentes para selección rápida
export const FREQUENT_LOCATIONS = UB_LOCATIONS.filter((loc) => loc.frequent);

// Agrupar por región
export const LOCATIONS_BY_REGION = UB_LOCATIONS.reduce(
  (acc, loc) => {
    if (!acc[loc.region]) acc[loc.region] = [];
    acc[loc.region].push(loc);
    return acc;
  },
  {} as Record<string, UBLocation[]>
);

// Colores por región
export const REGION_COLORS: Record<string, string> = {
  HEAD: "#8b5cf6",
  FACE: "#6366f1",
  NECK: "#3b82f6",
  TRUNK: "#10b981",
  ARM: "#f59e0b",
  FOREARM: "#f97316",
  HAND: "#ef4444",
  NEUTRAL_SPACE: "#6b7280",
};

export const REGION_LABELS: Record<string, string> = {
  HEAD: "Cabeza",
  FACE: "Cara",
  NECK: "Cuello",
  TRUNK: "Tronco",
  ARM: "Brazo",
  FOREARM: "Antebrazo",
  HAND: "Mano",
  NEUTRAL_SPACE: "Espacio neutro",
};
