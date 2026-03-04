// UB (Ubicación) Location Inventory — Cruz Aldrete (2008)
// 80 articulation points mapped to body regions with SVG coordinates

export interface UBLocation {
  code: string;
  region: "HEAD" | "FACE" | "NECK" | "TRUNK" | "ARM" | "FOREARM" | "HAND" | "NEUTRAL_SPACE";
  name: string;
  latin?: string;
  /** SVG coordinates on a 200x500 body silhouette */
  x: number;
  y: number;
  /** Top-20 most frequent locations */
  frequent?: boolean;
}

// Group for region-based zoom
export type BodyZone = "full" | "head" | "trunk" | "arm" | "hand";

export const UB_LOCATIONS: UBLocation[] = [
  // ── Head & Face (35) ─────────────────────────────────────────
  // Cranium
  { code: "Ca",  region: "HEAD", name: "Head",      latin: "caput",     x: 100, y: 28,  frequent: true },
  { code: "Vx",  region: "HEAD", name: "Crown",     latin: "vertex",    x: 100, y: 16 },
  { code: "Par", region: "HEAD", name: "Parietal",   latin: "parietalis", x: 116, y: 22 },
  { code: "Te",  region: "HEAD", name: "Temple",    latin: "tempus",    x: 78,  y: 38,  frequent: true },
  { code: "Au",  region: "HEAD", name: "Ear",       latin: "auris",     x: 72,  y: 48 },
  { code: "LobAu", region: "HEAD", name: "Earlobe",                     x: 72,  y: 54 },

  // Face — upper
  { code: "Fa",  region: "FACE", name: "Face",      latin: "facies",    x: 100, y: 48,  frequent: true },
  { code: "Fr",  region: "FACE", name: "Forehead",  latin: "frons",     x: 100, y: 36,  frequent: true },
  { code: "IpsiFr", region: "FACE", name: "Forehead-ipsi",              x: 90,  y: 36 },
  { code: "XFr", region: "FACE", name: "Forehead-contra",               x: 110, y: 36 },
  { code: "Ci",  region: "FACE", name: "Eyebrow",   latin: "cilium",    x: 90,  y: 42 },
  { code: "Su",  region: "FACE", name: "Eyebrow",   latin: "cilium",    x: 110, y: 42 },
  { code: "Cin", region: "FACE", name: "Brow-ridge", latin: "cinnus",   x: 100, y: 42 },

  // Face — eyes
  { code: "Oc",  region: "FACE", name: "Eye",       latin: "oculus",    x: 91,  y: 46,  frequent: true },
  { code: "RapOc", region: "FACE", name: "Eye-corner", latin: "rapum oculus", x: 84, y: 46 },
  { code: "OrbOc", region: "FACE", name: "Eye-orbit",                   x: 91,  y: 44 },

  // Face — nose
  { code: "Na",  region: "FACE", name: "Nose-tip",  latin: "nasus",     x: 100, y: 54,  frequent: true },
  { code: "Sep", region: "FACE", name: "Nose-bridge", latin: "septum",  x: 100, y: 50 },
  { code: "AlNa", region: "FACE", name: "Nasal-wings",                  x: 96,  y: 53 },

  // Face — cheeks
  { code: "Po",  region: "FACE", name: "Cheekbone", latin: "pomulum",   x: 84,  y: 52 },
  { code: "Ge",  region: "FACE", name: "Cheek",     latin: "gena",      x: 84,  y: 58,  frequent: true },

  // Face — mouth
  { code: "Os",  region: "FACE", name: "Mouth",     latin: "os",        x: 100, y: 60,  frequent: true },
  { code: "IpsiOs", region: "FACE", name: "Mouth-ipsi",                 x: 93,  y: 60 },
  { code: "XOs", region: "FACE", name: "Mouth-contra",                  x: 107, y: 60 },
  { code: "La",  region: "FACE", name: "Lips",      latin: "labium",    x: 100, y: 62 },
  { code: "Lab", region: "FACE", name: "Lips",      latin: "labium",    x: 100, y: 58 },
  { code: "Lin", region: "FACE", name: "Tongue",    latin: "lingua",    x: 100, y: 61 },
  { code: "Den", region: "FACE", name: "Teeth",     latin: "dentia",    x: 100, y: 59 },
  { code: "Col", region: "FACE", name: "Canine",                        x: 94,  y: 59 },
  { code: "MedDen", region: "FACE", name: "Incisors", latin: "medii dentes", x: 100, y: 59 },

  // Face — chin
  { code: "Me",  region: "FACE", name: "Chin",      latin: "mentum",    x: 100, y: 66,  frequent: true },

  // Neck
  { code: "Ce",  region: "NECK", name: "Nape",      latin: "cervix",    x: 120, y: 72 },
  { code: "Gu",  region: "NECK", name: "Below-chin", latin: "guttur",   x: 100, y: 72 },
  { code: "Co",  region: "NECK", name: "Neck",      latin: "collum",    x: 100, y: 78,  frequent: true },
  { code: "IpsiCo", region: "NECK", name: "Neck-ipsi",                  x: 90,  y: 78 },

  // ── Trunk & Legs (17) ────────────────────────────────────────
  { code: "Cla", region: "TRUNK", name: "Clavicle",  latin: "clavicula", x: 84,  y: 92 },
  { code: "Um",  region: "TRUNK", name: "Shoulder",  latin: "umerus",    x: 68,  y: 92,  frequent: true },
  { code: "Pe",  region: "TRUNK", name: "Chest",     latin: "pectus",    x: 100, y: 110, frequent: true },
  { code: "XPe", region: "TRUNK", name: "Chest-contra",                  x: 112, y: 110 },
  { code: "IpsiPe", region: "TRUNK", name: "Chest-ipsi",                 x: 88,  y: 110 },
  { code: "Cor", region: "TRUNK", name: "Heart",     latin: "cor",       x: 110, y: 108 },
  { code: "Es",  region: "TRUNK", name: "Sternum",                       x: 100, y: 105 },
  { code: "To",  region: "TRUNK", name: "Thorax",                        x: 100, y: 115 },
  { code: "Cos", region: "TRUNK", name: "Ribs",      latin: "costae",    x: 80,  y: 118 },
  { code: "Dor", region: "TRUNK", name: "Back",      latin: "dorsum",    x: 130, y: 115 },
  { code: "Ve",  region: "TRUNK", name: "Stomach",   latin: "venter",    x: 100, y: 140, frequent: true },
  { code: "Abd", region: "TRUNK", name: "Abdomen",                       x: 100, y: 155 },
  { code: "Je",  region: "TRUNK", name: "Liver",     latin: "jecur",     x: 88,  y: 135 },
  { code: "Cit", region: "TRUNK", name: "Waist",     latin: "cinctura",  x: 80,  y: 165 },
  { code: "Cox", region: "TRUNK", name: "Hip",       latin: "coxa",      x: 76,  y: 180 },
  { code: "Fe",  region: "TRUNK", name: "Thigh",     latin: "femur",     x: 82,  y: 210 },
  { code: "Gen", region: "TRUNK", name: "Knee",      latin: "genu",      x: 82,  y: 240 },

  // ── Arm & Forearm (11) ───────────────────────────────────────
  { code: "Br",  region: "ARM", name: "Upper-arm",    latin: "bracchium", x: 54,  y: 120, frequent: true },
  { code: "IntBr", region: "ARM", name: "Arm-interior",                   x: 60,  y: 120 },
  { code: "Cut", region: "ARM", name: "Elbow",        latin: "cubitus",   x: 48,  y: 145, frequent: true },
  { code: "Abr", region: "FOREARM", name: "Forearm",                      x: 46,  y: 170, frequent: true },
  { code: "IntAbr", region: "FOREARM", name: "Forearm-interior",           x: 50,  y: 170 },
  { code: "InfAbr", region: "FOREARM", name: "Forearm-lower",             x: 44,  y: 180 },
  { code: "RAAbr", region: "FOREARM", name: "Forearm-radial",             x: 42,  y: 165 },
  { code: "ExtAbr", region: "FOREARM", name: "Forearm-exterior",          x: 40,  y: 170 },
  { code: "Car", region: "HAND", name: "Wrist",       latin: "carpus",    x: 40,  y: 195, frequent: true },
  { code: "ExtCar", region: "HAND", name: "Wrist-exterior",               x: 36,  y: 195 },
  { code: "IntCar", region: "HAND", name: "Wrist-interior",               x: 44,  y: 195 },

  // ── Hand & Fingers (17) ──────────────────────────────────────
  { code: "Palma", region: "HAND", name: "Palm",                          x: 38, y: 210, frequent: true },
  { code: "ExtMano", region: "HAND", name: "Back-of-hand",                x: 34, y: 208 },
  { code: "Dorso", region: "HAND", name: "Back-of-hand",                  x: 34, y: 212 },
  { code: "D1",  region: "HAND", name: "Index-finger",                    x: 30, y: 224 },
  { code: "D2",  region: "HAND", name: "Middle-finger",                   x: 34, y: 228 },
  { code: "D3",  region: "HAND", name: "Ring-finger",                     x: 38, y: 226 },
  { code: "D4",  region: "HAND", name: "Pinky-finger",                    x: 42, y: 222 },
  { code: "PuntDed", region: "HAND", name: "Fingertips",                  x: 28, y: 232, frequent: true },
  { code: "Pol", region: "HAND", name: "Thumb",       latin: "pollex",    x: 48, y: 208 },
  { code: "IntDed", region: "HAND", name: "Fingers-interior",             x: 34, y: 220 },
  { code: "ExtDed", region: "HAND", name: "Fingers-exterior",             x: 28, y: 218 },
  { code: "Nod", region: "HAND", name: "Knuckles",    latin: "nodus",     x: 34, y: 216 },
  { code: "Base", region: "HAND", name: "Hand-base",                      x: 40, y: 202 },
  { code: "Cub", region: "HAND", name: "Ulnar-side",                      x: 46, y: 210 },
  { code: "RA",  region: "HAND", name: "Radial-side",                     x: 30, y: 210 },
  { code: "Gem", region: "HAND", name: "Fingertip-pad", latin: "gemma",   x: 30, y: 230 },
  { code: "Ung", region: "HAND", name: "Nail",        latin: "unguis",    x: 32, y: 230 },
];

// Top-20 frequent locations for quick-select
export const FREQUENT_LOCATIONS = UB_LOCATIONS.filter((loc) => loc.frequent);

// Group by region
export const LOCATIONS_BY_REGION = UB_LOCATIONS.reduce(
  (acc, loc) => {
    if (!acc[loc.region]) acc[loc.region] = [];
    acc[loc.region].push(loc);
    return acc;
  },
  {} as Record<string, UBLocation[]>
);

// Region colors
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
