/**
 * LSM-Lex 1.0 — entrada del léxico de Wikisigns sobre LSM-PN 1.1.
 *
 * Cada entrada es UN video de Wikisigns (una variante de una seña). La
 * fonología es la `SignAnnotation` de LSM-PN 1.1 (matrices de Cruz
 * Aldrete) con procedencia "auto": la propuso la visión, no una persona
 * Sorda. Encima van tres capas derivadas:
 *
 *  - `skeleton.canonical`: lo que el avatar Lexsi haría con las matrices
 *    (ángulos por hueso del rig Mixamo, ancla UB → hueso).
 *  - `skeleton.observed`: ángulos articulares medidos en el video
 *    (dedos desde los landmarks 3D de mano, brazo desde la pose).
 *  - `face`: blendshapes ARKit 52 medidos, facemarks clave y RNM.
 *
 * Las pistas cuadro a cuadro viven aparte (tracks/<id>.json.gz).
 */

import type {
  ContactType,
  EyebrowPosition,
  HeadMovement,
  Laterality,
  MouthShape,
  NonDominantRelation,
  SignAnnotation,
} from "@/lib/types";

export const LEXICON_SCHEMA = "lsm-lex/1.0";

export type EntryKind = "lexical" | "phrase" | "fingerspelling" | "number";

export interface Variety {
  /** Lengua de la seña: "LSM" salvo que Wikisigns diga otra cosa */
  language: string;
  /** Variedad regional ("Culiacán") o país de la otra lengua */
  region: string | null;
  /** false para señas de otra lengua (ASL, DGS, Señas Internacionales…) */
  is_lsm: boolean;
}

export interface WikisignsSource {
  site: "wikisigns.org";
  page_url: string;
  youtube_id: string;
  video_url: string;
  file_id: number | null;
  node_id: number | null;
  video_title: string | null;
  wikisigns_number: number | null;
  rating_avg: number | null;
  rating_votes: number | null;
  fetched_at: string;
  license: "CC BY-SA 4.0";
  attribution: string;
}

export interface VideoInfo {
  duration_ms: number;
  width: number;
  height: number;
  fps: number;
  sampled_frames: number;
  frames_with_hand: number;
  /** Ventana de la seña (sin reposo inicial/final), ms del video */
  window_ms: [number, number] | null;
  /** Manos recuperadas con el recorte guiado por la pose, interpoladas en
   *  huecos cortos y descartadas por quedar lejos de las muñecas */
  /** Manos recuperadas: recorte guiado por la pose, huecos rellenados,
   *  descartadas, y las que puso RTMW (con forma 3D / solo 2D) */
  hand_recovery?: { crop: number; interpolated: number; dropped: number; rtmw3d?: number; rtmw2d?: number };
}

/** Rotación de un hueso sobre su pose de enlace, como la aplica AvatarModel */
export interface BoneRotation {
  bone: string;
  /** Articulación anatómica que mueve */
  joint: string;
  /** Euler XYZ en grados (delta sobre la pose de enlace del rig) */
  euler_xyz_deg: [number, number, number];
}

export interface HandCanonical {
  cm_id: number;
  side: "dominant" | "nondominant";
  bones: BoneRotation[];
}

export interface UBAnchorRef {
  code: string;
  name: string | null;
  region: string | null;
  /** Hueso del rig Lexsi y offset (m) de ub_bone_map.ts */
  bone: string | null;
  offset_m: [number, number, number] | null;
}

/** Flexión medida por articulación (grados, 0 = recto) */
export interface FingerJointsObserved {
  mcp: number;
  pip: number;
  dip: number;
}

export interface HandObserved {
  index: FingerJointsObserved;
  middle: FingerJointsObserved;
  ring: FingerJointsObserved;
  pinky: FingerJointsObserved;
  thumb: { cmc: number; mcp: number; ip: number };
  /** Separación entre dedos vecinos (grados) */
  abduction: { index_middle: number; middle_ring: number; ring_pinky: number };
  frames: number;
}

/** Ángulos anatómicos del brazo (grados), medidos desde la pose 3D */
export interface ArmObserved {
  /** Flexión del hombro: elevación al frente (plano sagital) */
  shoulderFlex: number;
  /** Abducción del hombro: elevación lateral (plano frontal) */
  shoulderAbd: number;
  /** Flexión del codo (0 = brazo recto), mismo sentido que arm_fk.elbowFlex */
  elbowFlex: number;
  /** Desviación de la mano respecto al antebrazo (sin signo) */
  wristBend: number;
  frames: number;
}

export interface FaceSummary {
  rnm: {
    eyebrows: EyebrowPosition;
    mouth: MouthShape;
    head: HeadMovement;
  };
  /** Pesos ARKit que el avatar usaría para la RNM categórica */
  canonical_blendshapes: Record<string, number>;
  /** Blendshapes medidos en la ventana: media y pico */
  observed_blendshapes: { mean: Record<string, number>; peak: Record<string, number> } | null;
  /** Cabeza (grados) relativa al reposo: rango en la ventana */
  head_range_deg: { pitch: number; yaw: number; roll: number } | null;
  /**
   * Facemarks del cuadro central de la seña, centrados en el puente nasal
   * y escalados por la distancia entre ojos. Orden = facemark_index.
   */
  facemarks_core: number[][] | null;
}

export interface Phonology {
  /** Esquema de segmentos: "M", "DM", "DMD"… */
  structure: string;
  cm: {
    id: number;
    notation: string;
    alpha_code: string | null;
    example_sign: string;
    score: number;
    candidates: { cm_id: number; score: number }[];
  } | null;
  ub: { code: string; name: string | null; region: string | null; contact?: ContactType; laterality?: Laterality } | null;
  or: { palm?: string; fingers?: string };
  mov: {
    contour?: string;
    plane?: string;
    direction?: { x: number; y: number; z: number };
    repetition?: { count: number; type: string };
  } | null;
  bimanual: {
    two_handed: boolean;
    relation: NonDominantRelation | null;
    nondominant_cm: { id: number; score: number } | null;
  };
}

export interface LexiconEntry {
  schema: typeof LEXICON_SCHEMA;
  id: string;
  gloss: string;
  spanish: string;
  /** Otras palabras que Wikisigns da para la misma seña («Abandonar, Dejar») */
  synonyms: string[];
  label: string;
  /** «A», «B»… de Wikisigns, o «1», «2»… si la misma glosa tiene varios videos */
  variant: string | null;
  variety: Variety;
  qualifiers: string[];
  kind: EntryKind;
  source: WikisignsSource;
  video: VideoInfo;
  /** LSM-PN 1.1, procedencia "auto" campo por campo */
  annotation: SignAnnotation;
  /** Notación segmental legible (estilo buildNotation) */
  notation: string;
  phonology: Phonology | null;
  skeleton: {
    rig: string;
    convention: string;
    dominant_hand: "RIGHT" | "LEFT";
    canonical: {
      hands: HandCanonical[];
      locations: UBAnchorRef[];
    };
    observed: {
      dominant: HandObserved | null;
      nondominant: HandObserved | null;
      arm_dominant: ArmObserved | null;
      arm_nondominant: ArmObserved | null;
    };
  };
  face: FaceSummary;
  tracks: string | null;
  qa: {
    confidence: number;
    flags: string[];
    status: "auto";
  };
}
