import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  crearObjetivos,
  crearResultado,
  medirBrazo,
  munecaParaPalma,
  centroPalmaLocal,
  resolverBrazo,
  ROM_BRAZO,
  type MedidasBrazo,
} from "./brazo_ik";

const DEG = Math.PI / 180;

/**
 * Esqueleto sintético en pose T como el de Mixamo: la clavícula sale del
 * pecho hacia el lado, el brazo y el antebrazo siguen la misma recta (+X
 * para el izquierdo) y la bisagra del codo es el eje local +Z.
 */
function brazoSintetico(izquierdo = true, escala = 1) {
  const lado = izquierdo ? 1 : -1;
  const raiz = new THREE.Bone();
  raiz.scale.setScalar(escala);
  const clav = new THREE.Bone();
  clav.position.set(lado * 0.05, 1.4, 0);
  const brazo = new THREE.Bone();
  brazo.position.set(lado * 0.14, 0, 0);
  const ante = new THREE.Bone();
  ante.position.set(lado * 0.28, 0, 0);
  const mano = new THREE.Bone();
  mano.position.set(lado * 0.26, 0, 0);
  raiz.add(clav);
  clav.add(brazo);
  brazo.add(ante);
  ante.add(mano);
  raiz.updateMatrixWorld(true);
  const bind = {
    clavicle: clav.quaternion.clone(),
    upperArm: brazo.quaternion.clone(),
    foreArm: ante.quaternion.clone(),
    hand: mano.quaternion.clone(),
  };
  const cadena = { clavicle: clav, upperArm: brazo, foreArm: ante, hand: mano };
  const medidas = medirBrazo(cadena, bind, izquierdo, new THREE.Vector3(0, 0, lado));
  return { raiz, cadena, bind, medidas };
}

function resolver(medidas: MedidasBrazo, cadena: ReturnType<typeof brazoSintetico>["cadena"], muneca: THREE.Vector3) {
  const out = crearObjetivos();
  const res = crearResultado();
  cadena.clavicle.getWorldPosition(new THREE.Vector3());
  resolverBrazo(
    medidas,
    {
      claviculaPos: cadena.clavicle.getWorldPosition(new THREE.Vector3()),
      padreClaviculaQ: cadena.clavicle.parent!.getWorldQuaternion(new THREE.Quaternion()),
      cuerpoQ: new THREE.Quaternion(),
      muneca,
    },
    out,
    res,
  );
  return { out, res };
}

/** Aplica los objetivos al esqueleto y regresa la muñeca real de mundo. */
function munecaReal(cadena: ReturnType<typeof brazoSintetico>["cadena"], out: ReturnType<typeof crearObjetivos>) {
  cadena.clavicle.quaternion.copy(out.clavicula);
  cadena.upperArm.quaternion.copy(out.brazo);
  cadena.foreArm.quaternion.copy(out.antebrazo);
  cadena.clavicle.updateWorldMatrix(true, true);
  return cadena.hand.getWorldPosition(new THREE.Vector3());
}

/** El antebrazo solo gira sobre su bisagra respecto a bind. */
function esBisagraPura(medidas: MedidasBrazo, antebrazo: THREE.Quaternion) {
  const delta = medidas.bind.antebrazo.clone().invert().multiply(antebrazo);
  const eje = new THREE.Vector3(delta.x, delta.y, delta.z);
  if (eje.length() < 1e-9) return true; // sin flexión
  eje.normalize();
  return Math.abs(Math.abs(eje.dot(medidas.bisagra)) - 1) < 1e-6;
}

describe("resolverBrazo", () => {
  const objetivos: [string, [number, number, number]][] = [
    ["frente al pecho", [0.12, 1.25, 0.32]],
    ["barbilla", [0.03, 1.55, 0.22]],
    ["frente (cara)", [0.0, 1.72, 0.2]],
    ["cadera ipsi", [0.25, 0.95, 0.12]],
    ["cruzado al hombro contrario", [-0.18, 1.42, 0.2]],
  ];

  it.each(objetivos)("alcanza %s con el codo dentro de su rango", (_n, p) => {
    const { cadena, medidas } = brazoSintetico();
    const muneca = new THREE.Vector3(...p);
    const { out, res } = resolver(medidas, cadena, muneca);
    expect(res.alcanzado).toBe(true);
    expect(munecaReal(cadena, out).distanceTo(muneca)).toBeLessThan(1e-4);
    expect(res.flexionCodo).toBeGreaterThanOrEqual(ROM_BRAZO.codo[0] - 1e-6);
    expect(res.flexionCodo).toBeLessThanOrEqual(ROM_BRAZO.codo[1] + 1e-6);
    expect(esBisagraPura(medidas, out.antebrazo)).toBe(true);
  });

  it("el codo cae abajo y afuera, no arriba", () => {
    const { cadena, medidas } = brazoSintetico();
    const { res } = resolver(medidas, cadena, new THREE.Vector3(0.12, 1.25, 0.32));
    const medio = res.hombro.clone().add(res.muneca).multiplyScalar(0.5);
    expect(res.codo.y).toBeLessThan(medio.y);
    expect(res.codo.x).toBeGreaterThan(medio.x);
  });

  it("para la nuca sube el codo hacia fuera en vez de rendirse", () => {
    const { cadena, medidas } = brazoSintetico();
    // detrás de la cabeza, un poco arriba del hombro
    const muneca = new THREE.Vector3(0.05, 1.5, -0.2);
    const { res } = resolver(medidas, cadena, muneca);
    expect(res.alcanzado).toBe(true);
    expect(res.flexionCodo).toBeLessThan(ROM_BRAZO.codo[1]);
  });

  it("lo inalcanzable queda en la dirección del objetivo, con el codo casi estirado", () => {
    const { cadena, medidas } = brazoSintetico();
    const muneca = new THREE.Vector3(0.9, 1.3, 0.9);
    const { out, res } = resolver(medidas, cadena, muneca);
    expect(res.alcanzado).toBe(false);
    const real = munecaReal(cadena, out);
    const dir = muneca.clone().sub(res.hombro).normalize();
    const dirReal = real.clone().sub(res.hombro).normalize();
    expect(dir.angleTo(dirReal)).toBeLessThan(6 * DEG);
    expect(res.flexionCodo).toBeLessThan(ROM_BRAZO.codo[0] + 1);
  });

  it("lo demasiado cercano no dobla el codo más de lo posible", () => {
    const { cadena, medidas } = brazoSintetico();
    const { out, res } = resolver(medidas, cadena, new THREE.Vector3(0.2, 1.42, 0.02));
    expect(res.flexionCodo).toBeLessThanOrEqual(ROM_BRAZO.codo[1] + 1e-6);
    expect(esBisagraPura(medidas, out.antebrazo)).toBe(true);
  });

  it("el brazo derecho es el espejo del izquierdo", () => {
    const izq = brazoSintetico(true);
    const der = brazoSintetico(false);
    const rI = resolver(izq.medidas, izq.cadena, new THREE.Vector3(0.12, 1.25, 0.32));
    const rD = resolver(der.medidas, der.cadena, new THREE.Vector3(-0.12, 1.25, 0.32));
    expect(rI.res.alcanzado && rD.res.alcanzado).toBe(true);
    expect(rD.res.codo.x).toBeCloseTo(-rI.res.codo.x, 5);
    expect(rD.res.codo.y).toBeCloseTo(rI.res.codo.y, 5);
    expect(rD.res.flexionCodo).toBeCloseTo(rI.res.flexionCodo, 5);
  });

  it("respeta la escala de mundo del esqueleto", () => {
    const { cadena, medidas } = brazoSintetico(true, 2.2);
    const muneca = cadena.clavicle
      .getWorldPosition(new THREE.Vector3())
      .add(new THREE.Vector3(0.2, -0.3, 0.6));
    const { out, res } = resolver(medidas, cadena, muneca);
    expect(res.alcanzado).toBe(true);
    expect(munecaReal(cadena, out).distanceTo(muneca)).toBeLessThan(1e-4);
  });
});

describe("palma", () => {
  it("munecaParaPalma deja el centro de la palma en el punto", () => {
    const nudillo = new THREE.Vector3(0, 0.09, 0);
    const normal = new THREE.Vector3(0, 0, 1);
    const centro = centroPalmaLocal(nudillo, normal, new THREE.Vector3());
    const manoQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.1, -0.4));
    const punto = new THREE.Vector3(0.1, 1.3, 0.3);
    const muneca = munecaParaPalma(punto, manoQ, centro, 2.5, new THREE.Vector3());
    const palma = centro.clone().multiplyScalar(2.5).applyQuaternion(manoQ).add(muneca);
    expect(palma.distanceTo(punto)).toBeLessThan(1e-9);
  });
});
