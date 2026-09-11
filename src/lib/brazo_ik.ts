/**
 * brazo_ik.ts — cinemática inversa del brazo con límites fisiológicos.
 *
 * Lleva la MUÑECA a un punto de mundo con dos huesos (brazo y antebrazo)
 * respetando cómo se mueve un brazo real:
 *   - el codo es una bisagra de un grado de libertad (3–145° de flexión),
 *     así que el antebrazo solo gira sobre su eje de bisagra;
 *   - el hombro apunta el brazo dentro de su cono de alcance (elevación
 *     hasta 165°, extensión hacia atrás hasta 50°, cruce del cuerpo hasta
 *     45° más allá del plano medio);
 *   - el codo cae hacia abajo y afuera (polo natural) y puede girar
 *     alrededor de la recta hombro–muñeca sin mover la muñeca (swivel):
 *     de entre esos giros se elige el más natural que cumpla el cono.
 * Si el punto no se alcanza, la mano queda lo más cerca posible sin salir
 * de los límites. Todo se calcula en mundo y se devuelve en local por
 * hueso; no depende de la convención de ejes del modelo: los ejes de cada
 * hueso se miden del propio esqueleto (ver `medirBrazo`).
 *
 * Sin React ni r3f: solo three.js, para poder probarlo con vitest.
 */

import * as THREE from "three";

const DEG = Math.PI / 180;

// ── Límites articulares (grados) ───────────────────────────────────

export const ROM_BRAZO = {
  /** flexión del codo (0 = estirado) */
  codo: [3, 145],
  /** elevación del brazo desde colgando (0) hasta arriba (180) */
  elevacion: [0, 165],
  /** azimut del brazo en el plano horizontal medido desde el lado
   *  (0 = lateral, 90 = al frente, 135 = 45° cruzado); negativo = atrás */
  azimut: [-50, 135],
  /** giro del codo alrededor de la recta hombro–muñeca, respecto al polo
   *  natural: se prueba la vuelta completa y se elige por naturalidad */
  swivel: [-180, 180],
} as const satisfies Record<string, readonly [number, number]>;

// ── Tipos ─────────────────────────────────────────────────────────

/** Ejes y longitudes del brazo, medidos una vez del esqueleto en bind. */
export interface MedidasBrazo {
  /** rotación local en bind de cada hueso */
  bind: {
    clavicula: THREE.Quaternion;
    brazo: THREE.Quaternion;
    antebrazo: THREE.Quaternion;
    mano: THREE.Quaternion;
  };
  /** posición local (sin escala) del hijo dentro de cada hueso */
  local: {
    brazo: THREE.Vector3; // upperArm.position (en la clavícula)
    antebrazo: THREE.Vector3; // foreArm.position (en el brazo)
    mano: THREE.Vector3; // hand.position (en el antebrazo)
  };
  /** eje de bisagra del codo en el espacio local del antebrazo (unitario);
   *  girar el antebrazo con ángulo NEGATIVO alrededor de él lo flexiona */
  bisagra: THREE.Vector3;
  /** escala de mundo (uniforme) del esqueleto */
  escala: number;
  /** longitudes en mundo */
  L1: number;
  L2: number;
  izquierdo: boolean;
}

/** Objetivos locales por hueso (se escriben en su lugar). */
export interface ObjetivosBrazo {
  clavicula: THREE.Quaternion;
  brazo: THREE.Quaternion;
  antebrazo: THREE.Quaternion;
}

export interface EntradaBrazo {
  /** posición de mundo de la clavícula (no depende de su propia rotación) */
  claviculaPos: THREE.Vector3;
  /** rotación de mundo del padre de la clavícula */
  padreClaviculaQ: THREE.Quaternion;
  /** rotación de mundo del cuerpo (para el cono del hombro y el polo) */
  cuerpoQ: THREE.Quaternion;
  /** muñeca deseada (mundo) */
  muneca: THREE.Vector3;
}

export interface ResultadoBrazo {
  /** muñeca lograda (mundo) */
  muneca: THREE.Vector3;
  /** hombro (mundo) */
  hombro: THREE.Vector3;
  /** codo (mundo) */
  codo: THREE.Vector3;
  /** flexión del codo lograda (grados) */
  flexionCodo: number;
  /** giro de swivel elegido (grados) */
  swivel: number;
  /** true si la muñeca quedó a menos de 1 mm del objetivo */
  alcanzado: boolean;
}

// ── Utilidades ────────────────────────────────────────────────────

/** Ángulo con signo de a→b alrededor de eje (unitario). */
function anguloConSigno(
  a: THREE.Vector3,
  b: THREE.Vector3,
  eje: THREE.Vector3,
): number {
  _cruz.crossVectors(a, b);
  return Math.atan2(_cruz.dot(eje), a.dot(b));
}

/** Cuaternión que lleva la base ortonormal (u0, v0) a (u1, v1). */
function alinearBases(
  u0: THREE.Vector3,
  v0: THREE.Vector3,
  u1: THREE.Vector3,
  v1: THREE.Vector3,
  out: THREE.Quaternion,
): THREE.Quaternion {
  _w0.crossVectors(u0, v0);
  _w1.crossVectors(u1, v1);
  _m0.makeBasis(u0, v0, _w0);
  _m1.makeBasis(u1, v1, _w1);
  _qa.setFromRotationMatrix(_m0);
  _qb.setFromRotationMatrix(_m1);
  return out.copy(_qb).multiply(_qa.invert());
}

/** Proyecta v perpendicular a eje (unitario) y normaliza; false si degenerado. */
function perpendicular(v: THREE.Vector3, eje: THREE.Vector3, out: THREE.Vector3): boolean {
  out.copy(v).addScaledVector(eje, -v.dot(eje));
  if (out.lengthSq() < 1e-10) return false;
  out.normalize();
  return true;
}

// ── Medición del esqueleto ────────────────────────────────────────

/**
 * Mide ejes, longitudes y bind de la cadena. `bisagraLocal` es el eje de
 * bisagra del codo en el espacio local del antebrazo (en Mixamo, +X: girar
 * en X negativo flexiona, medido en el rig de Lexsi).
 */
export function medirBrazo(
  cadena: {
    clavicle: THREE.Bone;
    upperArm: THREE.Bone;
    foreArm: THREE.Bone;
    hand: THREE.Bone;
  },
  bind: {
    clavicle: THREE.Quaternion;
    upperArm: THREE.Quaternion;
    foreArm: THREE.Quaternion;
    hand: THREE.Quaternion;
  },
  izquierdo: boolean,
  bisagraLocal: THREE.Vector3 = new THREE.Vector3(1, 0, 0),
): MedidasBrazo {
  const escala = cadena.clavicle.getWorldScale(new THREE.Vector3()).x || 1;
  return {
    bind: {
      clavicula: bind.clavicle.clone(),
      brazo: bind.upperArm.clone(),
      antebrazo: bind.foreArm.clone(),
      mano: bind.hand.clone(),
    },
    local: {
      brazo: cadena.upperArm.position.clone(),
      antebrazo: cadena.foreArm.position.clone(),
      mano: cadena.hand.position.clone(),
    },
    bisagra: bisagraLocal.clone().normalize(),
    escala,
    L1: cadena.foreArm.position.length() * escala,
    L2: cadena.hand.position.length() * escala,
    izquierdo,
  };
}

// ── Temporales de módulo (sin reservas por cuadro) ────────────────

const _cruz = new THREE.Vector3();
const _w0 = new THREE.Vector3();
const _w1 = new THREE.Vector3();
const _m0 = new THREE.Matrix4();
const _m1 = new THREE.Matrix4();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _q0 = new THREE.Quaternion();

const _clavW = new THREE.Quaternion();
const _brazoBindW = new THREE.Quaternion();
const _hombro = new THREE.Vector3();
const _v = new THREE.Vector3();
const _vHat = new THREE.Vector3();
const _polo = new THREE.Vector3();
const _n = new THREE.Vector3();
const _n0 = new THREE.Vector3();
const _b = new THREE.Vector3();
const _codo = new THREE.Vector3();
const _u = new THREE.Vector3();
const _u0 = new THREE.Vector3();
const _h0 = new THREE.Vector3();
const _h = new THREE.Vector3();
const _R = new THREE.Quaternion();
const _brazoW = new THREE.Quaternion();
const _giro = new THREE.Quaternion();
const _f0 = new THREE.Vector3();
const _f = new THREE.Vector3();
const _fProj = new THREE.Vector3();
const _ejeH = new THREE.Vector3();
const _munecaLog = new THREE.Vector3();
const _mejorBrazo = new THREE.Quaternion();
const _mejorAntebrazo = new THREE.Quaternion();
const _mejorCodo = new THREE.Vector3();
const _mejorMuneca = new THREE.Vector3();
const _abajo = new THREE.Vector3();
const _lado = new THREE.Vector3();
const _frente = new THREE.Vector3();
const _clavEuler = new THREE.Euler();
const _clavDelta = new THREE.Quaternion();
const _reach = new THREE.Vector3();

// ── Cono del hombro ───────────────────────────────────────────────

/**
 * Cuánto se sale la dirección del brazo (mundo) del cono fisiológico del
 * hombro, en radianes (0 si está dentro). `lado` apunta hacia fuera del
 * cuerpo por el lado de este brazo.
 */
export function violacionCono(
  dirBrazo: THREE.Vector3,
  abajo: THREE.Vector3,
  lado: THREE.Vector3,
  frente: THREE.Vector3,
): number {
  const elev = Math.acos(Math.min(1, Math.max(-1, dirBrazo.dot(abajo)))) / DEG;
  let v = 0;
  if (elev > ROM_BRAZO.elevacion[1]) v += (elev - ROM_BRAZO.elevacion[1]) * DEG;
  // azimut en el plano horizontal: 0 lateral, 90 frente, 180 cruzado
  const x = dirBrazo.dot(lado);
  const z = dirBrazo.dot(frente);
  if (Math.hypot(x, z) > 0.2) {
    const az = Math.atan2(z, x) / DEG;
    if (az > ROM_BRAZO.azimut[1]) v += (az - ROM_BRAZO.azimut[1]) * DEG;
    if (az < ROM_BRAZO.azimut[0]) v += (ROM_BRAZO.azimut[0] - az) * DEG;
  }
  return v;
}

// ── Solver ────────────────────────────────────────────────────────

/**
 * Resuelve clavícula, brazo y antebrazo para llevar la muñeca a
 * `entrada.muneca`. Escribe en `out` (locales) y regresa medidas de
 * mundo. Determinista y sin reservas de memoria por cuadro.
 */
export function resolverBrazo(
  medidas: MedidasBrazo,
  entrada: EntradaBrazo,
  out: ObjetivosBrazo,
  resultado: ResultadoBrazo,
): ResultadoBrazo {
  const { bind, local, L1, L2, escala, izquierdo } = medidas;
  const lado = izquierdo ? 1 : -1;

  // ejes del cuerpo
  _abajo.set(0, -1, 0).applyQuaternion(entrada.cuerpoQ);
  _lado.set(lado, 0, 0).applyQuaternion(entrada.cuerpoQ);
  _frente.set(0, 0, 1).applyQuaternion(entrada.cuerpoQ);

  // 1. Clavícula: encoge y protrae un poco hacia objetivos altos o cruzados
  _reach.copy(entrada.muneca).sub(entrada.claviculaPos).normalize();
  const elevRel = Math.asin(Math.min(1, Math.max(-1, -_reach.dot(_abajo))));
  const cruce = Math.max(0, -_reach.dot(_lado));
  const frenteRel = Math.max(0, _reach.dot(_frente));
  const encoger =
    elevRel > 60 * DEG ? Math.min(1, (elevRel - 60 * DEG) / (110 * DEG)) * 18 : 0;
  const protraer = Math.min(1, frenteRel * 0.8 + cruce * 1.2) * 12;
  _clavEuler.set(0, protraer * DEG * lado, encoger * DEG * lado, "XYZ");
  out.clavicula.copy(bind.clavicula).multiply(_clavDelta.setFromEuler(_clavEuler));
  _clavW.copy(entrada.padreClaviculaQ).multiply(out.clavicula);

  // 2. Hombro (mundo) y vector al objetivo
  _hombro.copy(local.brazo).multiplyScalar(escala).applyQuaternion(_clavW).add(entrada.claviculaPos);
  _v.copy(entrada.muneca).sub(_hombro);
  let d = _v.length();
  if (d < 1e-6) {
    _v.copy(_abajo);
    d = 1e-6;
  }
  _vHat.copy(_v).normalize();

  // alcance según flexión del codo permitida
  const flexMin = ROM_BRAZO.codo[0] * DEG;
  const flexMax = ROM_BRAZO.codo[1] * DEG;
  const dMax = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(Math.PI - flexMin));
  const dMin = Math.sqrt(L1 * L1 + L2 * L2 - 2 * L1 * L2 * Math.cos(Math.PI - flexMax));
  const dUso = Math.min(dMax, Math.max(dMin, d));
  // posición del codo sobre el eje hombro→muñeca y radio del círculo
  const a = (L1 * L1 - L2 * L2 + dUso * dUso) / (2 * dUso);
  const hRad = Math.sqrt(Math.max(0, L1 * L1 - a * a));

  // 3. Polo natural: el codo cae abajo, hacia fuera y un poco atrás
  _polo.copy(_abajo).addScaledVector(_lado, 0.55).addScaledVector(_frente, -0.25);
  if (!perpendicular(_polo, _vHat, _n0)) {
    // objetivo en la dirección del polo: cualquier perpendicular estable
    if (!perpendicular(_lado, _vHat, _n0)) perpendicular(_frente, _vHat, _n0);
  }

  // ejes de bind del brazo en mundo (para alinear bases)
  _brazoBindW.copy(_clavW).multiply(bind.brazo);
  _u0.copy(local.antebrazo).normalize().applyQuaternion(_brazoBindW);
  _h0.copy(medidas.bisagra).applyQuaternion(_q0.copy(_brazoBindW).multiply(bind.antebrazo));
  perpendicular(_h0, _u0, _h0);
  // dirección del antebrazo sin flexión, relativa al brazo
  const antebrazoSinFlex = bind.antebrazo;

  // 4. Buscar el swivel más natural que respete el cono del hombro
  let mejorCosto = Infinity;
  let mejorSwivel = 0;
  let mejorFlex = 0;
  const [sMin, sMax] = ROM_BRAZO.swivel;
  for (let g = 0; g <= sMax; g += 10) {
    for (const s of g === 0 || g === 180 ? [g] : [g, -g]) {
      if (s < sMin || s > sMax) continue;
      _giro.setFromAxisAngle(_vHat, s * DEG);
      _n.copy(_n0).applyQuaternion(_giro);
      _codo.copy(_hombro).addScaledVector(_vHat, a).addScaledVector(_n, hRad);
      _u.copy(_codo).sub(_hombro).normalize();

      // bisagra ⟂ al plano hombro–codo–muñeca, con signo tal que el giro
      // negativo (flexión) lleve la muñeca hacia dentro del codo
      _b.copy(entrada.muneca).sub(_codo);
      if (!perpendicular(_b, _u, _b)) _b.copy(_n).negate();
      _h.crossVectors(_b, _u).normalize();

      // rotación del brazo: alinea (u0, h0) con (u, h)
      alinearBases(_u0, _h0, _u, _h, _R);
      _brazoW.copy(_R).multiply(_brazoBindW);

      // antebrazo: ángulo con signo desde su dirección sin flexión
      _f0.copy(local.mano).normalize().applyQuaternion(_q0.copy(_brazoW).multiply(antebrazoSinFlex));
      _ejeH.copy(medidas.bisagra).applyQuaternion(_q0);
      _f.copy(entrada.muneca).sub(_codo);
      if (!perpendicular(_f, _ejeH, _fProj)) _fProj.copy(_f0);
      perpendicular(_f0, _ejeH, _f0);
      let phi = anguloConSigno(_f0, _fProj, _ejeH);
      // la flexión es negativa; nunca hiperextender ni pasar el máximo
      phi = Math.min(0, Math.max(-flexMax, phi));
      const flex = -phi / DEG;

      // muñeca lograda
      _f.copy(local.mano).normalize().multiplyScalar(L2);
      _giro.setFromAxisAngle(medidas.bisagra, phi);
      _f.applyQuaternion(_giro).applyQuaternion(_q0.copy(_brazoW).multiply(antebrazoSinFlex));
      _munecaLog.copy(_codo).add(_f);

      const error = _munecaLog.distanceTo(entrada.muneca);
      // naturalidad: llegar (lo que más pesa), no salir del cono del hombro,
      // no subir el codo por encima de hombro y muñeca, y quedarse cerca
      // del polo si todo lo demás empata
      const alturaCodo = _codo.dot(_abajo) * -1; // altura a lo largo de "arriba"
      const alturaRef = Math.max(_hombro.dot(_abajo), entrada.muneca.dot(_abajo)) * -1;
      const codoAlto = Math.max(0, alturaCodo - alturaRef);
      const costo =
        error * 8 +
        violacionCono(_u, _abajo, _lado, _frente) * 1.5 +
        codoAlto * 1.0 +
        Math.abs(s) * DEG * 0.05;
      if (costo < mejorCosto) {
        mejorCosto = costo;
        mejorSwivel = s;
        mejorFlex = flex;
        _mejorBrazo.copy(_clavW).invert().multiply(_brazoW);
        _mejorAntebrazo.copy(antebrazoSinFlex).multiply(_giro);
        _mejorCodo.copy(_codo);
        _mejorMuneca.copy(_munecaLog);
      }
    }
  }

  out.brazo.copy(_mejorBrazo);
  out.antebrazo.copy(_mejorAntebrazo);
  resultado.hombro.copy(_hombro);
  resultado.codo.copy(_mejorCodo);
  resultado.muneca.copy(_mejorMuneca);
  resultado.flexionCodo = mejorFlex;
  resultado.swivel = mejorSwivel;
  resultado.alcanzado = _mejorMuneca.distanceTo(entrada.muneca) < 1e-3;
  return resultado;
}

export function crearResultado(): ResultadoBrazo {
  return {
    muneca: new THREE.Vector3(),
    hombro: new THREE.Vector3(),
    codo: new THREE.Vector3(),
    flexionCodo: 0,
    swivel: 0,
    alcanzado: false,
  };
}

export function crearObjetivos(): ObjetivosBrazo {
  return {
    clavicula: new THREE.Quaternion(),
    brazo: new THREE.Quaternion(),
    antebrazo: new THREE.Quaternion(),
  };
}

// ── Palma ─────────────────────────────────────────────────────────

/**
 * Centro de la palma en el espacio local de la mano (sin escala): a ~55 %
 * del camino muñeca→nudillo del medio y medio grosor hacia la palma.
 */
export function centroPalmaLocal(
  nudilloMedio: THREE.Vector3,
  normalPalma: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  const largo = nudilloMedio.length();
  return out
    .copy(nudilloMedio)
    .multiplyScalar(0.55)
    .addScaledVector(normalPalma, largo * 0.12);
}

/**
 * Muñeca (mundo) que pone el centro de la palma en `punto` cuando la mano
 * tiene la rotación de mundo `manoQ`.
 */
export function munecaParaPalma(
  punto: THREE.Vector3,
  manoQ: THREE.Quaternion,
  centroPalma: THREE.Vector3,
  escala: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  _v.copy(centroPalma).multiplyScalar(escala).applyQuaternion(manoQ);
  return out.copy(punto).sub(_v);
}
