/**
 * ub_anatomia.ts — dónde está cada lugar (UB) sobre el cuerpo del avatar.
 *
 * En vez de offsets a mano, los 80 lugares se colocan por anatomía: cada
 * uno se define como un punto de partida respecto a marcas del propio
 * modelo (ojos, nariz, barbilla, coronilla, huesos) y una dirección de
 * proyección; se proyecta sobre la superficie de la malla en pose de bind
 * tomando el vértice más saliente en esa dirección. El resultado se guarda
 * en el espacio local del hueso más cercano, así que los puntos de la cara
 * siguen a la cabeza (cejas, asentir…) y los del brazo base siguen al
 * brazo base.
 *
 * Convenciones (escena): +X = lado de la mano dominante (izquierda del
 * avatar), +Y arriba, +Z hacia quien mira. Los lugares del brazo, el
 * antebrazo y la mano son los del brazo NO dominante (la mano dominante
 * toca a la otra), y el hombro y la clavícula son los contralaterales.
 *
 * Solo three.js: probable con vitest sin r3f.
 */

import * as THREE from "three";
import { UB_BONE_MAP } from "./ub_bone_map";

// ── Tipos ─────────────────────────────────────────────────────────

/** Ancla de un lugar: hueso + punto y normal en el espacio local del hueso. */
export interface AnclaUB {
  hueso: string;
  local: THREE.Vector3;
  /** normal de superficie aproximada (hacia fuera), local al hueso;
   *  ausente en puntos en el aire (espacio neutro: no hay nada que tocar) */
  normal?: THREE.Vector3;
}

export interface AnclasUB {
  /** para la mano dominante (lado +X toca al lado −X en brazo/mano) */
  dominante: Map<string, AnclaUB>;
  /** para la otra mano (todo en espejo) */
  espejo: Map<string, AnclaUB>;
}

/** Marcas del cuerpo medidas en la malla (coordenadas de escena). */
export interface MarcasCuerpo {
  cabeza: THREE.Vector3;
  coronillaY: number;
  cuello: THREE.Vector3;
  barbillaY: number;
  ojoY: number;
  /** distancia del centro al ojo (positiva) */
  ojoX: number;
  ojoZ: number;
  /** ancho de la cabeza a la altura de los ojos */
  anchoCabeza: number;
  /** centro z de la cabeza a la altura de los ojos */
  cabezaZ: number;
  narizY: number;
  narizZ: number;
  bocaY: number;
  /** alto de la cabeza (barbilla → coronilla) */
  H: number;
  /** media distancia entre los hombros */
  medioPecho: number;
}

type Desde = "frente" | "atras" | "arriba" | "abajo" | "ipsi" | "contra";

interface Espec {
  /** nombre del hueso; "BASE"/"DOM" se sustituyen por el lado que toque */
  hueso: string;
  /** punto de partida en mundo; `L` es +1 (dominante) o −1 (espejo) */
  punto: (m: MarcasCuerpo, L: number, pos: (n: string) => THREE.Vector3) => THREE.Vector3;
  desde: Desde;
  /** radio del cilindro de búsqueda como fracción del ancho de la cabeza */
  radio?: number;
  /** cuánto puede alejarse la superficie del punto de partida (fracción
   *  del ancho de la cabeza); corto en brazos y manos para no saltar al
   *  tronco o a la cabeza */
  alcance?: number;
  /** punto en el aire: no se proyecta a la malla (espacio neutro) */
  sinProyectar?: boolean;
}

// ── Vértices de la malla ──────────────────────────────────────────

/** Posiciones de mundo de todos los vértices de las mallas con piel. */
export function verticesDeMundo(raiz: THREE.Object3D): {
  todos: Float32Array;
  porMalla: Float32Array[];
} {
  raiz.updateMatrixWorld(true);
  const porMalla: Float32Array[] = [];
  const v = new THREE.Vector3();
  raiz.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!(m as THREE.Mesh).isMesh) return;
    const pos = m.geometry.getAttribute("position");
    if (!pos) return;
    if (m.isSkinnedMesh) m.skeleton.update();
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
    porMalla.push(out);
  });
  const total = porMalla.reduce((s, a) => s + a.length, 0);
  const todos = new Float32Array(total);
  let k = 0;
  for (const a of porMalla) {
    todos.set(a, k);
    k += a.length;
  }
  return { todos, porMalla };
}

const _d = new THREE.Vector3();

/**
 * Vértice más saliente en la dirección `dir` (unitaria) dentro de un
 * cilindro de radio `radio` alrededor de la recta que pasa por `centro`,
 * sin alejarse de `centro` más de `alcance` a lo largo de la recta (para
 * no saltar a otra parte del cuerpo). Regresa el punto de la recta a la
 * profundidad de ese vértice, o null si no hay vértices.
 */
export function extremoEnCilindro(
  verts: Float32Array,
  centro: THREE.Vector3,
  dir: THREE.Vector3,
  radio: number,
  out: THREE.Vector3,
  alcance = Infinity,
): THREE.Vector3 | null {
  const r2 = radio * radio;
  let mejor = -Infinity;
  let idx = -1;
  for (let i = 0; i < verts.length; i += 3) {
    const dx = verts[i] - centro.x;
    const dy = verts[i + 1] - centro.y;
    const dz = verts[i + 2] - centro.z;
    const t = dx * dir.x + dy * dir.y + dz * dir.z;
    if (Math.abs(t) > alcance) continue;
    const perp2 = dx * dx + dy * dy + dz * dz - t * t;
    if (perp2 <= r2 && t > mejor) {
      mejor = t;
      idx = i;
    }
  }
  if (idx < 0) return null;
  // se conserva el punto pedido y solo se toma la profundidad de la malla:
  // así dos lugares vecinos no se pegan al mismo vértice
  return out.copy(centro).addScaledVector(dir, mejor);
}

const DIRECCION: Record<Desde, (L: number) => THREE.Vector3> = {
  frente: () => new THREE.Vector3(0, 0, 1),
  atras: () => new THREE.Vector3(0, 0, -1),
  arriba: () => new THREE.Vector3(0, 1, 0),
  abajo: () => new THREE.Vector3(0, -1, 0),
  ipsi: (L) => new THREE.Vector3(L, 0, 0),
  contra: (L) => new THREE.Vector3(-L, 0, 0),
};

// ── Marcas del cuerpo ─────────────────────────────────────────────

function caja(verts: Float32Array): THREE.Box3 {
  const b = new THREE.Box3();
  for (let i = 0; i < verts.length; i += 3) {
    b.expandByPoint(_d.set(verts[i], verts[i + 1], verts[i + 2]));
  }
  return b;
}

/**
 * Mide barbilla, ojos, nariz, ancho de cabeza… en la malla. La malla de
 * los ojos se reconoce como la pieza más pequeña dentro de la parte alta
 * de la cara; si no la hay, los ojos se estiman por proporción (a 60 % de
 * la altura de la cabeza).
 */
export function medirCuerpo(
  mallas: { todos: Float32Array; porMalla: Float32Array[] },
  pos: (n: string) => THREE.Vector3 | null,
): MarcasCuerpo | null {
  const cabeza = pos("Head");
  const cuello = pos("Neck");
  const brazoI = pos("LeftArm");
  const brazoD = pos("RightArm");
  if (!cabeza || !cuello || !brazoI || !brazoD) return null;
  const { todos, porMalla } = mallas;

  const cima = pos("HeadTop_End");
  let coronillaY = cima ? cima.y : -Infinity;
  if (!cima) for (let i = 1; i < todos.length; i += 3) coronillaY = Math.max(coronillaY, todos[i]);
  const alturaProv = coronillaY - cuello.y;
  if (!(alturaProv > 0)) return null;

  // Barbilla: perfil frontal z(y) por franjas; la cara sobresale del
  // cuello y la barbilla es donde ese saliente termina hacia abajo.
  const paso = alturaProv * 0.02;
  const yIni = cuello.y - 0.25 * alturaProv;
  const yFin = coronillaY - 0.1 * alturaProv;
  const nBins = Math.max(1, Math.ceil((yFin - yIni) / paso));
  const crudo = new Float64Array(nBins).fill(-Infinity);
  for (let i = 0; i < todos.length; i += 3) {
    const x = todos[i], y = todos[i + 1], z = todos[i + 2];
    if (Math.abs(x - cabeza.x) > alturaProv * 0.1) continue;
    const k = Math.floor((y - yIni) / paso);
    if (k < 0 || k >= nBins) continue;
    if (z > crudo[k]) crudo[k] = z;
  }
  // suavizado por máximo local: una franja sin vértices de la cara (malla
  // gruesa) no debe leerse como hueco
  const perfil = new Float64Array(nBins);
  for (let k = 0; k < nBins; k++) {
    let m = -Infinity;
    for (let j = Math.max(0, k - 2); j <= Math.min(nBins - 1, k + 2); j++) m = Math.max(m, crudo[j]);
    perfil[k] = m;
  }
  const bin = (y: number) => Math.min(nBins - 1, Math.max(0, Math.floor((y - yIni) / paso)));
  let cuelloZ = Infinity;
  for (let k = bin(cuello.y - 0.1 * alturaProv); k <= bin(cuello.y + 0.05 * alturaProv); k++) {
    if (isFinite(perfil[k])) cuelloZ = Math.min(cuelloZ, perfil[k]);
  }
  let caraZ = -Infinity;
  for (let k = bin(cuello.y); k < nBins; k++) caraZ = Math.max(caraZ, perfil[k]);
  let barbillaY = NaN;
  if (isFinite(cuelloZ) && isFinite(caraZ) && caraZ > cuelloZ) {
    const umbral = cuelloZ + 0.35 * (caraZ - cuelloZ);
    for (let k = nBins - 1; k >= 0; k--) {
      if (isFinite(perfil[k]) && perfil[k] < umbral) {
        barbillaY = yIni + (k + 1) * paso;
        break;
      }
    }
  }
  if (!isFinite(barbillaY)) barbillaY = cuello.y + 0.1 * alturaProv;
  const H = coronillaY - barbillaY;

  // Ancho a una altura dada (y centro z de la sección)
  const seccion = (y: number) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < todos.length; i += 3) {
      if (Math.abs(todos[i + 1] - y) < H * 0.04) {
        minX = Math.min(minX, todos[i]);
        maxX = Math.max(maxX, todos[i]);
        minZ = Math.min(minZ, todos[i + 2]);
        maxZ = Math.max(maxZ, todos[i + 2]);
      }
    }
    return isFinite(minX) ? { ancho: maxX - minX, cz: (minZ + maxZ) / 2 } : null;
  };
  const prov = seccion(barbillaY + 0.6 * H);
  if (!prov) return null;

  // Ojos: la pieza más pequeña que cabe dentro de la parte alta de la cara
  let ojos: Float32Array | null = null;
  for (const m of porMalla) {
    if (m.length < 3 * 60) continue;
    const bb = caja(m);
    const dentro =
      bb.min.y > barbillaY + 0.3 * H &&
      bb.max.y < barbillaY + 0.9 * H &&
      bb.max.y - bb.min.y < 0.3 * H &&
      bb.max.x - bb.min.x < 0.7 * prov.ancho;
    if (dentro && (!ojos || m.length < ojos.length)) ojos = m;
  }
  let ojoY: number, ojoX: number, ojoZ: number;
  if (ojos) {
    let sy = 0, sz = 0, sxa = 0, n = 0;
    for (let i = 0; i < ojos.length; i += 3) {
      sy += ojos[i + 1];
      sz += ojos[i + 2];
      sxa += Math.abs(ojos[i] - cabeza.x);
      n++;
    }
    ojoY = sy / n;
    ojoZ = sz / n;
    ojoX = sxa / n;
  } else {
    ojoY = barbillaY + 0.6 * H;
    ojoX = prov.ancho * 0.2;
    ojoZ = prov.cz + prov.ancho * 0.4;
  }
  const sec = seccion(ojoY) ?? prov;
  const anchoCabeza = sec.ancho;
  // centro de la sección (la media la sesgarían los ojos, que están al frente)
  const cabezaZ = sec.cz;

  // Nariz: lo más saliente del frente entre la boca y los ojos
  let narizY = barbillaY + 0.4 * H;
  let narizZ = -Infinity;
  for (let i = 0; i < todos.length; i += 3) {
    const x = todos[i], y = todos[i + 1], z = todos[i + 2];
    if (
      y > barbillaY + 0.22 * H &&
      y < ojoY - 0.02 * H &&
      Math.abs(x - cabeza.x) < anchoCabeza * 0.12 &&
      z > narizZ
    ) {
      narizZ = z;
      narizY = y;
    }
  }
  if (!isFinite(narizZ)) narizZ = cabezaZ + anchoCabeza * 0.5;

  const baseNariz = narizY - 0.05 * H;
  const bocaY = barbillaY + 0.45 * (baseNariz - barbillaY);

  return {
    cabeza: cabeza.clone(),
    coronillaY,
    cuello: cuello.clone(),
    barbillaY,
    ojoY,
    ojoX,
    ojoZ,
    anchoCabeza,
    cabezaZ,
    narizY,
    narizZ,
    bocaY,
    H,
    medioPecho: Math.abs(brazoI.x - brazoD.x) / 2,
  };
}

// ── Especificación anatómica de los 80 lugares ────────────────────

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** hueso del brazo base (el contrario al dominante) */
const base = (L: number) => (L > 0 ? "Right" : "Left");
/** hueso del lado dominante */
const dom = (L: number) => (L > 0 ? "Left" : "Right");
const lerp = (a: THREE.Vector3, b: THREE.Vector3, t: number) =>
  a.clone().lerp(b, t);

/** Puntos de la cara: (x en anchos de cabeza, y absoluta), proyectados de frente. */
function cara(fx: (m: MarcasCuerpo) => number, fy: (m: MarcasCuerpo) => number): Espec {
  return {
    hueso: "Head",
    punto: (m, L) => v3(m.cabeza.x + L * fx(m) * m.anchoCabeza, fy(m), m.cabezaZ),
    desde: "frente",
  };
}

const frenteY = (m: MarcasCuerpo) => {
  const ceja = m.ojoY + 0.12 * m.H;
  const pelo = m.coronillaY - 0.14 * m.H;
  return (ceja + pelo) / 2;
};

/** Espacio neutro: no es un lugar del cuerpo, es donde se muestran manos y
 *  orientaciones sin tocar nada (frente al pecho, a poco más de un palmo). */
export const CODIGO_ESPACIO_NEUTRO = "EN";

export const ESPECIFICACION_UB: Record<string, Espec> = {
  // ── Espacio neutro (frente al pecho, sin contacto) ──
  // frente al hombro dominante, a la altura de la clavícula y a un palmo
  // del pecho: con los brazos cortos de Lexsi (cabeza grande), más abajo o
  // más al centro la mano vertical ya no se alcanza
  [CODIGO_ESPACIO_NEUTRO]: {
    hueso: "Spine2",
    punto: (m, L, pos) =>
      v3(
        m.cabeza.x + L * 0.8 * m.medioPecho,
        pos("Spine2").y + 0.5 * (m.cuello.y - pos("Spine2").y),
        pos("Spine2").z + 0.65 * m.anchoCabeza,
      ),
    desde: "frente",
    sinProyectar: true,
  },

  // ── Cabeza ──
  Ca: { hueso: "Head", punto: (m) => v3(m.cabeza.x, m.coronillaY, m.cabezaZ + 0.15 * m.anchoCabeza), desde: "arriba" },
  Vx: { hueso: "Head", punto: (m) => v3(m.cabeza.x, m.coronillaY, m.cabezaZ), desde: "arriba" },
  Par: { hueso: "Head", punto: (m) => v3(m.cabeza.x, m.coronillaY - 0.22 * m.H, m.cabezaZ), desde: "ipsi" },
  Te: { hueso: "Head", punto: (m) => v3(m.cabeza.x, m.ojoY + 0.08 * m.H, m.cabezaZ + 0.2 * m.anchoCabeza), desde: "ipsi" },
  Au: { hueso: "Head", punto: (m) => v3(m.cabeza.x, m.ojoY - 0.03 * m.H, m.cabezaZ - 0.05 * m.anchoCabeza), desde: "ipsi" },
  LobAu: { hueso: "Head", punto: (m) => v3(m.cabeza.x, m.ojoY - 0.17 * m.H, m.cabezaZ - 0.05 * m.anchoCabeza), desde: "ipsi" },

  // ── Cara ──
  Fa: cara(() => 0.16, (m) => (m.ojoY + m.bocaY) / 2),
  Fr: cara(() => 0, frenteY),
  IpsiFr: cara(() => 0.28, frenteY),
  XFr: cara(() => -0.28, frenteY),
  Ci: cara((m) => m.ojoX / m.anchoCabeza, (m) => m.ojoY + 0.11 * m.H),
  Su: cara((m) => m.ojoX / m.anchoCabeza + 0.1, (m) => m.ojoY + 0.12 * m.H),
  Cin: cara(() => 0, (m) => m.ojoY + 0.1 * m.H),
  Oc: cara((m) => m.ojoX / m.anchoCabeza, (m) => m.ojoY),
  RapOc: cara((m) => m.ojoX / m.anchoCabeza + 0.12, (m) => m.ojoY),
  OrbOc: cara((m) => m.ojoX / m.anchoCabeza, (m) => m.ojoY + 0.055 * m.H),
  Na: cara(() => 0, (m) => m.narizY),
  Sep: cara(() => 0, (m) => m.ojoY - 0.03 * m.H),
  AlNa: cara(() => 0.09, (m) => m.narizY - 0.01 * m.H),
  Po: cara(() => 0.34, (m) => m.ojoY - 0.13 * m.H),
  Ge: cara(() => 0.3, (m) => m.bocaY + 0.06 * m.H),
  Os: cara(() => 0, (m) => m.bocaY),
  IpsiOs: cara(() => 0.13, (m) => m.bocaY),
  XOs: cara(() => -0.13, (m) => m.bocaY),
  La: cara(() => 0, (m) => m.bocaY - 0.035 * m.H),
  Lab: cara(() => 0, (m) => m.bocaY + 0.035 * m.H),
  Lin: cara(() => 0, (m) => m.bocaY - 0.008 * m.H),
  Den: cara(() => 0, (m) => m.bocaY + 0.008 * m.H),
  Col: cara(() => 0.07, (m) => m.bocaY + 0.01 * m.H),
  MedDen: cara(() => 0, (m) => m.bocaY + 0.012 * m.H),
  Me: cara(() => 0, (m) => m.barbillaY + 0.08 * m.H),

  // ── Cuello ──
  Ce: { hueso: "Neck", punto: (m) => v3(m.cabeza.x, m.cuello.y + 0.5 * (m.cabeza.y - m.cuello.y), m.cuello.z), desde: "atras" },
  Gu: { hueso: "Neck", punto: (m) => v3(m.cabeza.x, m.cuello.y + 0.35 * (m.barbillaY - m.cuello.y), m.cuello.z), desde: "frente" },
  Co: { hueso: "Neck", punto: (m, L) => v3(m.cabeza.x + L * 0.25 * m.anchoCabeza, m.cuello.y + 0.35 * (m.barbillaY - m.cuello.y), m.cuello.z), desde: "frente" },
  // alcance corto: el cilindro hacia el lado no debe saltar al hombro
  IpsiCo: { hueso: "Neck", punto: (m) => v3(m.cabeza.x, m.cuello.y + 0.4 * (m.barbillaY - m.cuello.y), m.cuello.z), desde: "ipsi", alcance: 0.35 },

  // ── Tronco (hombro y clavícula: los del lado base, que la mano sí alcanza) ──
  // clavícula y hombro: cerca del cuello, donde sí llega la otra mano
  Cla: {
    hueso: "BASEShoulder",
    punto: (_m, L, pos) => {
      const sh = pos(`${base(L)}Shoulder`), a = pos(`${base(L)}Arm`);
      return v3(sh.x + 0.4 * (a.x - sh.x), sh.y + 0.4 * (sh.y - a.y), sh.z);
    },
    desde: "frente",
  },
  Um: {
    hueso: "BASEShoulder",
    punto: (_m, L, pos) => {
      const sh = pos(`${base(L)}Shoulder`), a = pos(`${base(L)}Arm`);
      return v3(sh.x + 0.6 * (a.x - sh.x), a.y, a.z);
    },
    desde: "arriba",
    radio: 0.16,
    alcance: 0.35,
  },
  Pe: { hueso: "Spine2", punto: (m, _L, pos) => v3(m.cabeza.x, pos("Spine2").y, pos("Spine2").z), desde: "frente" },
  XPe: { hueso: "Spine2", punto: (m, L, pos) => v3(m.cabeza.x - L * 0.45 * m.medioPecho, pos("Spine2").y, pos("Spine2").z), desde: "frente" },
  IpsiPe: { hueso: "Spine2", punto: (m, L, pos) => v3(m.cabeza.x + L * 0.45 * m.medioPecho, pos("Spine2").y, pos("Spine2").z), desde: "frente" },
  // el corazón está a la izquierda anatómica del avatar (+X en escena)
  Cor: { hueso: "Spine2", punto: (m, _L, pos) => v3(m.cabeza.x + 0.3 * m.medioPecho, pos("Spine2").y - 0.25 * (pos("Spine2").y - pos("Spine1").y), pos("Spine2").z), desde: "frente" },
  Es: { hueso: "Spine2", punto: (m, _L, pos) => v3(m.cabeza.x, pos("Spine2").y - 0.3 * (pos("Spine2").y - pos("Spine1").y), pos("Spine2").z), desde: "frente" },
  To: { hueso: "Spine1", punto: (m, _L, pos) => v3(m.cabeza.x, lerp(pos("Spine1"), pos("Spine2"), 0.5).y, pos("Spine1").z), desde: "frente" },
  Cos: { hueso: "Spine1", punto: (m, L, pos) => v3(m.cabeza.x + L * 0.6 * m.medioPecho, pos("Spine1").y, pos("Spine1").z), desde: "frente" },
  Dor: { hueso: "Spine2", punto: (m, _L, pos) => v3(m.cabeza.x, pos("Spine2").y, pos("Spine2").z), desde: "atras" },
  Ve: { hueso: "Spine", punto: (m, _L, pos) => v3(m.cabeza.x, lerp(pos("Spine"), pos("Spine1"), 0.4).y, pos("Spine").z), desde: "frente" },
  Abd: { hueso: "Spine", punto: (m, _L, pos) => v3(m.cabeza.x, lerp(pos("Spine"), pos("Hips"), 0.3).y, pos("Spine").z), desde: "frente" },
  // el hígado está a la derecha anatómica (−X en escena)
  Je: { hueso: "Spine", punto: (m, _L, pos) => v3(m.cabeza.x - 0.5 * m.medioPecho, pos("Spine").y, pos("Spine").z), desde: "frente" },
  Cit: { hueso: "Spine", punto: (m, _L, pos) => v3(m.cabeza.x, lerp(pos("Spine"), pos("Hips"), 0.3).y, pos("Hips").z), desde: "ipsi" },
  Cox: { hueso: "Hips", punto: (m, _L, pos) => v3(m.cabeza.x, pos("Hips").y, pos("Hips").z), desde: "ipsi" },
  Fe: { hueso: "DOMUpLeg", punto: (_m, L, pos) => lerp(pos(`${dom(L)}UpLeg`), pos(`${dom(L)}Leg`), 0.4), desde: "frente", radio: 0.25, alcance: 0.5 },
  Gen: { hueso: "DOMLeg", punto: (_m, L, pos) => pos(`${dom(L)}Leg`), desde: "frente", radio: 0.25, alcance: 0.5 },

  // ── Brazo base ──
  Br: { hueso: "BASEArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}Arm`), pos(`${base(L)}ForeArm`), 0.5), desde: "arriba", radio: 0.2, alcance: 0.3 },
  IntBr: { hueso: "BASEArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}Arm`), pos(`${base(L)}ForeArm`), 0.5), desde: "abajo", radio: 0.2, alcance: 0.3 },
  Cut: { hueso: "BASEForeArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}ForeArm`), pos(`${base(L)}Arm`), 0.05), desde: "atras", radio: 0.2, alcance: 0.3 },

  // ── Antebrazo base (pose T, palma abajo: dorso arriba, palmar abajo, radial al frente) ──
  Abr: { hueso: "BASEForeArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}ForeArm`), pos(`${base(L)}Hand`), 0.5), desde: "arriba", radio: 0.16, alcance: 0.25 },
  IntAbr: { hueso: "BASEForeArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}ForeArm`), pos(`${base(L)}Hand`), 0.5), desde: "abajo", radio: 0.16, alcance: 0.25 },
  InfAbr: { hueso: "BASEForeArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}ForeArm`), pos(`${base(L)}Hand`), 0.8), desde: "arriba", radio: 0.16, alcance: 0.25 },
  RAAbr: { hueso: "BASEForeArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}ForeArm`), pos(`${base(L)}Hand`), 0.5), desde: "frente", radio: 0.16, alcance: 0.25 },
  ExtAbr: { hueso: "BASEForeArm", punto: (_m, L, pos) => lerp(pos(`${base(L)}ForeArm`), pos(`${base(L)}Hand`), 0.5), desde: "atras", radio: 0.16, alcance: 0.25 },

  // ── Mano base ──
  Car: { hueso: "BASEHand", punto: (_m, L, pos) => lerp(pos(`${base(L)}Hand`), pos(`${base(L)}HandMiddle1`), 0.05), desde: "arriba", radio: 0.12, alcance: 0.2 },
  ExtCar: { hueso: "BASEHand", punto: (_m, L, pos) => pos(`${base(L)}Hand`), desde: "arriba", radio: 0.12, alcance: 0.2 },
  IntCar: { hueso: "BASEHand", punto: (_m, L, pos) => pos(`${base(L)}Hand`), desde: "abajo", radio: 0.12, alcance: 0.2 },
  Palma: { hueso: "BASEHand", punto: (_m, L, pos) => lerp(pos(`${base(L)}Hand`), pos(`${base(L)}HandMiddle1`), 0.55), desde: "abajo", radio: 0.12, alcance: 0.2 },
  ExtMano: { hueso: "BASEHand", punto: (_m, L, pos) => lerp(pos(`${base(L)}Hand`), pos(`${base(L)}HandMiddle1`), 0.55), desde: "arriba", radio: 0.12, alcance: 0.2 },
  Dorso: { hueso: "BASEHand", punto: (_m, L, pos) => lerp(pos(`${base(L)}Hand`), pos(`${base(L)}HandMiddle1`), 0.6), desde: "arriba", radio: 0.12, alcance: 0.2 },
  D1: { hueso: "BASEHandIndex2", punto: (_m, L, pos) => pos(`${base(L)}HandIndex2`), desde: "arriba", radio: 0.06, alcance: 0.12 },
  D2: { hueso: "BASEHandMiddle2", punto: (_m, L, pos) => pos(`${base(L)}HandMiddle2`), desde: "arriba", radio: 0.06, alcance: 0.12 },
  D3: { hueso: "BASEHandRing2", punto: (_m, L, pos) => pos(`${base(L)}HandRing2`), desde: "arriba", radio: 0.06, alcance: 0.12 },
  D4: { hueso: "BASEHandPinky2", punto: (_m, L, pos) => pos(`${base(L)}HandPinky2`), desde: "arriba", radio: 0.06, alcance: 0.12 },
  PuntDed: { hueso: "BASEHandMiddle4", punto: (_m, L, pos) => pos(`${base(L)}HandMiddle4`), desde: "arriba", radio: 0.06, alcance: 0.12 },
  Pol: { hueso: "BASEHandThumb3", punto: (_m, L, pos) => pos(`${base(L)}HandThumb3`), desde: "arriba", radio: 0.06, alcance: 0.12 },
  IntDed: { hueso: "BASEHandMiddle2", punto: (_m, L, pos) => pos(`${base(L)}HandMiddle2`), desde: "abajo", radio: 0.06, alcance: 0.12 },
  ExtDed: { hueso: "BASEHandMiddle2", punto: (_m, L, pos) => lerp(pos(`${base(L)}HandMiddle2`), pos(`${base(L)}HandMiddle3`), 0.5), desde: "arriba", radio: 0.06, alcance: 0.12 },
  Nod: { hueso: "BASEHandMiddle1", punto: (_m, L, pos) => pos(`${base(L)}HandMiddle1`), desde: "arriba", radio: 0.08, alcance: 0.15 },
  Base: { hueso: "BASEHand", punto: (_m, L, pos) => lerp(pos(`${base(L)}Hand`), pos(`${base(L)}HandMiddle1`), 0.2), desde: "abajo", radio: 0.12, alcance: 0.2 },
  Cub: { hueso: "BASEHandPinky1", punto: (_m, L, pos) => pos(`${base(L)}HandPinky1`), desde: "atras", radio: 0.08, alcance: 0.15 },
  RA: { hueso: "BASEHandIndex1", punto: (_m, L, pos) => pos(`${base(L)}HandIndex1`), desde: "frente", radio: 0.08, alcance: 0.15 },
  Gem: { hueso: "BASEHandIndex4", punto: (_m, L, pos) => pos(`${base(L)}HandIndex4`), desde: "abajo", radio: 0.05, alcance: 0.1 },
  Ung: { hueso: "BASEHandIndex4", punto: (_m, L, pos) => pos(`${base(L)}HandIndex4`), desde: "arriba", radio: 0.05, alcance: 0.1 },
};

// ── Cálculo de anclas ─────────────────────────────────────────────

const _inv = new THREE.Matrix4();
const _hit = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _escalaTmp = new THREE.Vector3();

function anclaDesde(
  bone: THREE.Bone,
  punto: THREE.Vector3,
  normalMundo: THREE.Vector3 | null,
): AnclaUB {
  bone.updateWorldMatrix(true, false);
  _inv.copy(bone.matrixWorld).invert();
  return {
    hueso: bone.name,
    local: punto.clone().applyMatrix4(_inv),
    normal: normalMundo
      ? normalMundo.clone().transformDirection(_inv).normalize()
      : undefined,
  };
}

/** Ancla de respaldo: el offset a mano de UB_BONE_MAP (ejes de mundo), en local. */
function anclaRespaldo(
  code: string,
  L: number,
  boneMap: Map<string, THREE.Bone>,
): AnclaUB | null {
  const a = UB_BONE_MAP[code];
  if (!a) return null;
  const nombre =
    L > 0 ? a.boneName : a.boneName.replace(/^Left/, "Right");
  const bone = boneMap.get(nombre) ?? boneMap.get(a.boneName);
  if (!bone) return null;
  bone.updateWorldMatrix(true, false);
  const s = bone.getWorldScale(new THREE.Vector3()).x || 1;
  const p = bone
    .getWorldPosition(new THREE.Vector3())
    .add(new THREE.Vector3(L * a.offset[0] * s, a.offset[1] * s, a.offset[2] * s));
  const n = new THREE.Vector3(L * a.offset[0], a.offset[1] * 0.3, a.offset[2]);
  if (n.lengthSq() < 1e-9) n.set(0, 1, 0);
  return anclaDesde(bone, p, n.normalize());
}

/**
 * Calcula las anclas de los 80 lugares para la mano dominante y su espejo.
 * Debe llamarse con el esqueleto en pose de bind (al cargar).
 */
export function calcularAnclasUB(
  raiz: THREE.Object3D,
  boneMap: Map<string, THREE.Bone>,
): AnclasUB {
  const mallas = verticesDeMundo(raiz);
  const pos = (n: string) => {
    const b = boneMap.get(n);
    if (!b) return null;
    b.updateWorldMatrix(true, false);
    return b.getWorldPosition(new THREE.Vector3());
  };
  const marcas = medirCuerpo(mallas, pos);

  const calcular = (L: number): Map<string, AnclaUB> => {
    const out = new Map<string, AnclaUB>();
    const nombreHueso = (patron: string) =>
      patron.replace("BASE", base(L)).replace("DOM", dom(L));
    const codigos = new Set([...Object.keys(UB_BONE_MAP), ...Object.keys(ESPECIFICACION_UB)]);
    for (const code of codigos) {
      const spec = ESPECIFICACION_UB[code];
      let ancla: AnclaUB | null = null;
      if (spec && marcas) {
        try {
          const hueso = boneMap.get(nombreHueso(spec.hueso));
          const posSeguro = (n: string) => {
            const p = pos(n);
            if (!p) throw new Error(`sin hueso ${n}`);
            return p;
          };
          const centro = spec.punto(marcas, L, posSeguro);
          if (hueso) {
            _dir.copy(DIRECCION[spec.desde](L));
            const radioBase = (spec.radio ?? 0.08) * marcas.anchoCabeza;
            const alcance = (spec.alcance ?? 0.7) * marcas.anchoCabeza;
            let hit = spec.sinProyectar
              ? _hit.copy(centro)
              : (extremoEnCilindro(mallas.todos, centro, _dir, radioBase, _hit, alcance) ??
                extremoEnCilindro(mallas.todos, centro, _dir, radioBase * 2, _hit, alcance));
            if (!hit) hit = _hit.copy(centro);
            // lo más saliente en `dir` es la superficie: la normal va hacia allá
            ancla = anclaDesde(hueso, hit, spec.sinProyectar ? null : _dir);
          }
        } catch {
          ancla = null;
        }
      }
      ancla ??= anclaRespaldo(code, L, boneMap);
      if (ancla) out.set(code, ancla);
    }
    return out;
  };

  return { dominante: calcular(1), espejo: calcular(-1) };
}

// ── Lectura en tiempo de animación ────────────────────────────────

/** Da posiciones y normales de mundo de los lugares, siguiendo a sus huesos. */
export class LectorUB {
  constructor(
    private anclas: AnclasUB,
    private boneMap: Map<string, THREE.Bone>,
  ) {}

  private ancla(code: string, espejo: boolean): { a: AnclaUB; b: THREE.Bone } | null {
    const a = (espejo ? this.anclas.espejo : this.anclas.dominante).get(code);
    if (!a) return null;
    const b = this.boneMap.get(a.hueso);
    if (!b) return null;
    return { a, b };
  }

  tiene(code: string): boolean {
    return this.anclas.dominante.has(code);
  }

  /**
   * true si el lugar está sobre el brazo o la mano base (la otra mano):
   * ese brazo debe presentarse al frente para que se pueda tocar.
   */
  esBrazoBase(code: string, espejo: boolean): boolean {
    const a = (espejo ? this.anclas.espejo : this.anclas.dominante).get(code);
    if (!a) return false;
    return /^(Left|Right)(Arm|ForeArm|Hand)/.test(a.hueso) && !/Shoulder/.test(a.hueso);
  }

  /** Escala de mundo del esqueleto (uniforme), medida en la cabeza. */
  escala(): number {
    const b = this.boneMap.get("Head") ?? this.boneMap.values().next().value;
    if (!b) return 1;
    b.updateWorldMatrix(true, false);
    return b.getWorldScale(_escalaTmp).x || 1;
  }

  posicion(code: string, espejo: boolean, out: THREE.Vector3): THREE.Vector3 | null {
    const r = this.ancla(code, espejo);
    if (!r) return null;
    r.b.updateWorldMatrix(true, false);
    return out.copy(r.a.local).applyMatrix4(r.b.matrixWorld);
  }

  /** null si el lugar no tiene superficie (espacio neutro) */
  normal(code: string, espejo: boolean, out: THREE.Vector3): THREE.Vector3 | null {
    const r = this.ancla(code, espejo);
    if (!r || !r.a.normal) return null;
    r.b.updateWorldMatrix(true, false);
    return out.copy(r.a.normal).transformDirection(r.b.matrixWorld);
  }
}
