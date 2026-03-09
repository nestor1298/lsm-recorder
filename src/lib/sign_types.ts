/**
 * Cruz Aldrete (2008) — Segmental Matrix Types for LSM Phonological Notation
 *
 * A sign is represented as a temporal sequence of segments:
 *   D₁ → M₁ → D₂ → M₂ → D₃ ...
 *
 * Three matrices define each sign:
 *   1. Matriz de Detención (D) — Hold: CM + UB + OR
 *   2. Matriz de Movimiento (M) — Movement: contour + plane + local
 *   3. Matriz de Rasgos No Manuales (RNM) — suprasegmental
 */

import type { CMEntry } from "./types";
import type { UBLocation } from "./ub_inventory";

// ── Segment Types ──────────────────────────────────────────────

/** Hold segment — the hand is held in a fixed position */
export interface HoldSegment {
  type: "D";
  id: string;
  cm: CMEntry | null;
  ub: UBLocation | null;
  orientation: { palm: string; fingers: string };
  /** Hand mode: dominant only or both hands symmetric */
  handMode: "dominant" | "both_symmetric";
}

/** Movement segment — the hand moves through space */
export interface MovementSegment {
  type: "M";
  id: string;
  contour: string;
  local: string | null;
  plane: string;
}

export type Segment = HoldSegment | MovementSegment;

/** Non-manual features — applied suprasegmentally across the sign */
export interface RNMState {
  eyebrows: string;
  mouth: string;
  head: string;
}

/** Complete sign construction */
export interface SignConstruction {
  name: string;
  segments: Segment[];
  rnm: RNMState;
}

// ── Factory Functions ──────────────────────────────────────────

let _counter = 0;

function uid(prefix: string): string {
  _counter++;
  return `${prefix}-${_counter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createHoldSegment(): HoldSegment {
  return {
    type: "D",
    id: uid("d"),
    cm: null,
    ub: null,
    orientation: { palm: "FORWARD", fingers: "UP" },
    handMode: "dominant",
  };
}

export function createMovementSegment(): MovementSegment {
  return {
    type: "M",
    id: uid("m"),
    contour: "STRAIGHT",
    local: null,
    plane: "VERTICAL",
  };
}

export function createDefaultSign(): SignConstruction {
  return {
    name: "",
    segments: [createHoldSegment(), createMovementSegment(), createHoldSegment()],
    rnm: { eyebrows: "NEUTRAL", mouth: "NEUTRAL", head: "NONE" },
  };
}

// ── Notation Builder ───────────────────────────────────────────

const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function subscript(n: number): string {
  if (n < 10) return SUBSCRIPTS[n];
  return String(n)
    .split("")
    .map((d) => SUBSCRIPTS[parseInt(d)])
    .join("");
}

/** Build a human-readable LSM-PN segmental notation string */
export function buildNotation(sign: SignConstruction): string {
  let dCount = 0;
  let mCount = 0;
  const parts: string[] = [];

  for (const seg of sign.segments) {
    if (seg.type === "D") {
      dCount++;
      const fields: string[] = [];
      if (seg.cm) fields.push(`CM=${seg.cm.cm_id}`);
      if (seg.ub) fields.push(`UB=${seg.ub.code}`);
      fields.push(
        `OR=(${seg.orientation.palm.toLowerCase()},${seg.orientation.fingers.toLowerCase()})`,
      );
      if (seg.handMode === "both_symmetric") fields.push("2M");
      parts.push(`D${subscript(dCount)}[${fields.join(", ")}]`);
    } else {
      mCount++;
      const fields: string[] = [];
      fields.push(`cont=${seg.contour.toLowerCase()}`);
      fields.push(`plano=${seg.plane.toLowerCase()}`);
      if (seg.local) fields.push(`local=${seg.local.toLowerCase()}`);
      parts.push(`M${subscript(mCount)}[${fields.join(", ")}]`);
    }
  }

  // RNM (suprasegmental)
  const rnmParts: string[] = [];
  if (sign.rnm.eyebrows !== "NEUTRAL")
    rnmParts.push(`cejas=${sign.rnm.eyebrows.toLowerCase()}`);
  if (sign.rnm.mouth !== "NEUTRAL")
    rnmParts.push(`boca=${sign.rnm.mouth.toLowerCase()}`);
  if (sign.rnm.head !== "NONE")
    rnmParts.push(`cabeza=${sign.rnm.head.toLowerCase()}`);

  let notation = parts.join(" → ");
  if (rnmParts.length > 0) {
    notation += `\nRNM[${rnmParts.join(", ")}]`;
  }

  return notation || "—";
}

/** Build a compact summary for a segment (used in timeline chips) */
export function segmentSummary(seg: Segment): string {
  if (seg.type === "D") {
    const parts: string[] = [];
    if (seg.cm) parts.push(`#${seg.cm.cm_id}`);
    if (seg.ub) parts.push(seg.ub.code);
    return parts.join(" ") || "vacío";
  }
  const parts: string[] = [seg.contour.slice(0, 5).toLowerCase()];
  if (seg.local) parts.push(seg.local.slice(0, 4).toLowerCase());
  return parts.join("+");
}
