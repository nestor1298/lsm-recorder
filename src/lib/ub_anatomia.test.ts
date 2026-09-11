import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { UB_LOCATIONS } from "./ub_inventory";
import {
  calcularAnclasUB,
  CODIGO_ESPACIO_NEUTRO,
  extremoEnCilindro,
  LectorUB,
  verticesDeMundo,
} from "./ub_anatomia";

/**
 * Cuerpo sintético: cabeza esférica con ojos, cuello, tronco y brazos en
 * pose T como el rig de Mixamo (huesos con nombres reales y sin rotación,
 * así que la posición local es la de mundo).
 */
function cuerpoSintetico() {
  const raiz = new THREE.Group();
  const R = 0.25; // radio de la cabeza
  const C = new THREE.Vector3(0, 1.75, 0); // centro de la cabeza

  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32));
  cabeza.position.copy(C);
  raiz.add(cabeza);
  const ojos = new THREE.Group();
  for (const sx of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8));
    ojo.position.set(sx * 0.09, C.y + 0.03, C.z + R * 0.9);
    ojos.add(ojo);
  }
  // los dos ojos como una sola malla pequeña
  const geoOjos = new THREE.BufferGeometry();
  const pts: number[] = [];
  ojos.updateMatrixWorld(true);
  for (const o of ojos.children as THREE.Mesh[]) {
    const p = o.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      pts.push(v.x, v.y, v.z);
    }
  }
  geoOjos.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  raiz.add(new THREE.Mesh(geoOjos));

  const tronco = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.28, 8, 12, 4));
  tronco.position.set(0, 1.0, 0);
  raiz.add(tronco);
  const cuelloM = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16, 2));
  cuelloM.position.set(0, 1.5, -0.02);
  raiz.add(cuelloM);
  // brazos en T (cilindros a lo largo de X)
  for (const sx of [-1, 1]) {
    const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 16, 12));
    brazo.rotation.z = Math.PI / 2;
    brazo.position.set(sx * 0.75, 1.35, 0);
    raiz.add(brazo);
  }

  const boneMap = new Map<string, THREE.Bone>();
  const hueso = (nombre: string, x: number, y: number, z: number) => {
    const b = new THREE.Bone();
    b.name = nombre;
    b.position.set(x, y, z);
    raiz.add(b);
    boneMap.set(nombre, b);
    return b;
  };
  hueso("Hips", 0, 0.6, 0);
  hueso("Spine", 0, 0.8, 0);
  hueso("Spine1", 0, 1.0, 0);
  hueso("Spine2", 0, 1.25, 0);
  hueso("Neck", 0, 1.45, -0.02);
  hueso("Head", 0, 1.55, 0);
  hueso("HeadTop_End", 0, C.y + R, 0);
  for (const [pre, sx] of [["Left", 1], ["Right", -1]] as const) {
    hueso(`${pre}Shoulder`, sx * 0.1, 1.4, 0);
    hueso(`${pre}Arm`, sx * 0.25, 1.35, 0);
    hueso(`${pre}ForeArm`, sx * 0.6, 1.35, 0);
    hueso(`${pre}Hand`, sx * 1.0, 1.35, 0);
    hueso(`${pre}HandMiddle1`, sx * 1.12, 1.35, 0);
    hueso(`${pre}HandMiddle2`, sx * 1.17, 1.35, 0);
    hueso(`${pre}HandMiddle3`, sx * 1.2, 1.35, 0);
    hueso(`${pre}HandMiddle4`, sx * 1.23, 1.35, 0);
    hueso(`${pre}HandIndex1`, sx * 1.12, 1.35, 0.03);
    hueso(`${pre}HandIndex2`, sx * 1.17, 1.35, 0.03);
    hueso(`${pre}HandIndex4`, sx * 1.22, 1.35, 0.03);
    hueso(`${pre}HandRing2`, sx * 1.17, 1.35, -0.02);
    hueso(`${pre}HandPinky1`, sx * 1.12, 1.35, -0.04);
    hueso(`${pre}HandPinky2`, sx * 1.16, 1.35, -0.04);
    hueso(`${pre}HandThumb3`, sx * 1.08, 1.35, 0.07);
    hueso(`${pre}UpLeg`, sx * 0.1, 0.55, 0);
    hueso(`${pre}Leg`, sx * 0.1, 0.1, 0);
  }
  raiz.updateMatrixWorld(true);
  return { raiz, boneMap, C, R };
}

describe("extremoEnCilindro", () => {
  it("encuentra el vértice más saliente en la dirección dada", () => {
    const verts = new Float32Array([0, 0, 0, 0, 0, 1, 0, 0, 2, 5, 0, 3]);
    const out = new THREE.Vector3();
    const hit = extremoEnCilindro(verts, new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 0.5, out);
    expect(hit?.toArray()).toEqual([0, 0, 2]);
    expect(
      extremoEnCilindro(verts, new THREE.Vector3(9, 9, 9), new THREE.Vector3(0, 0, 1), 0.1, out),
    ).toBeNull();
  });
});

describe("calcularAnclasUB", () => {
  const { raiz, boneMap, C, R } = cuerpoSintetico();
  const anclas = calcularAnclasUB(raiz, boneMap);
  const lector = new LectorUB(anclas, boneMap);
  const pos = (code: string, espejo = false) => lector.posicion(code, espejo, new THREE.Vector3())!;

  it("da ancla a los 80 lugares, en las dos manos", () => {
    for (const l of UB_LOCATIONS) {
      expect(anclas.dominante.has(l.code), l.code).toBe(true);
      expect(anclas.espejo.has(l.code), l.code).toBe(true);
    }
  });

  it("los puntos de la cara quedan sobre la piel, al frente", () => {
    for (const code of ["Fr", "Ci", "Oc", "Na", "Os", "Me", "Ge", "Po", "IpsiFr", "XOs"]) {
      const p = pos(code);
      expect(Math.abs(p.distanceTo(C) - R), code).toBeLessThan(0.03);
      // la barbilla de una esfera queda abajo, con menos saliente
      expect(p.z, code).toBeGreaterThan(C.z + R * (code === "Me" ? 0.35 : 0.5));
    }
  });

  it("la cara se reparte de arriba abajo en orden anatómico", () => {
    const y = (c: string) => pos(c).y;
    expect(y("Fr")).toBeGreaterThan(y("Ci"));
    expect(y("Ci")).toBeGreaterThan(y("Oc"));
    expect(y("Oc")).toBeGreaterThan(y("Na"));
    expect(y("Na")).toBeGreaterThan(y("Os"));
    expect(y("Lab")).toBeGreaterThan(y("Os"));
    expect(y("Os")).toBeGreaterThan(y("La"));
    expect(y("Os")).toBeGreaterThan(y("Me"));
    expect(y("Vx")).toBeGreaterThan(y("Fr"));
  });

  it("los ojos se leen de la malla: Oc cae sobre el ojo", () => {
    const p = pos("Oc");
    expect(Math.abs(p.x - 0.09)).toBeLessThan(0.04);
    expect(Math.abs(p.y - (C.y + 0.03))).toBeLessThan(0.04);
  });

  it("ipsi y contra caen en lados opuestos, y el espejo invierte", () => {
    expect(pos("IpsiFr").x).toBeGreaterThan(0.05);
    expect(pos("XFr").x).toBeLessThan(-0.05);
    expect(pos("Ci").x).toBeGreaterThan(0.03);
    expect(pos("Su").x).toBeLessThan(-0.03);
    expect(pos("Je").x).toBeGreaterThan(0.05); // hígado del lado ipsi (espejo)
    expect(pos("Cor").x).toBeLessThan(-0.05); // corazón del lado contra
    expect(pos("IpsiOs").x).toBeGreaterThan(0);
    expect(pos("XOs").x).toBeLessThan(0);
    expect(pos("IpsiFr", true).x).toBeLessThan(-0.05);
    expect(pos("Te").x).toBeGreaterThan(R * 0.8);
    expect(pos("Te", true).x).toBeLessThan(-R * 0.8);
  });

  it("brazo, antebrazo, mano y hombro son los del lado contrario a la mano que toca", () => {
    for (const code of ["Br", "Abr", "Palma", "D1", "PuntDed", "Um", "Cla"]) {
      expect(anclas.dominante.get(code)!.hueso.startsWith("Right"), code).toBe(true);
      expect(anclas.espejo.get(code)!.hueso.startsWith("Left"), code).toBe(true);
      expect(pos(code).x, code).toBeLessThan(0);
      expect(pos(code, true).x, code).toBeGreaterThan(0);
    }
  });

  it("dorso arriba, palma abajo, radial al frente y cubital atrás (pose T)", () => {
    expect(pos("Dorso").y).toBeGreaterThan(pos("Palma").y);
    expect(pos("Abr").y).toBeGreaterThan(pos("IntAbr").y);
    expect(pos("RA").z).toBeGreaterThan(pos("Cub").z);
    expect(pos("Ung").y).toBeGreaterThan(pos("Gem").y);
  });

  it("las normales son las de la piel y apuntan hacia fuera", () => {
    const n = lector.normal("Fr", false, new THREE.Vector3())!;
    expect(n.z).toBeGreaterThan(0.7);
    // en el pómulo (lateral) la normal ya no es la dirección de proyección
    const np = lector.normal("Po", false, new THREE.Vector3())!;
    expect(np.x).toBeGreaterThan(0.3);
    expect(np.z).toBeGreaterThan(0.3);
    // el punto está sobre la esfera, no flotando delante
    expect(Math.abs(pos("Po").distanceTo(C) - R)).toBeLessThan(0.01);
    const nd = lector.normal("Dor", false, new THREE.Vector3())!;
    expect(nd.z).toBeLessThan(-0.9);
    const nt = lector.normal("Te", false, new THREE.Vector3())!;
    expect(nt.x).toBeGreaterThan(0.7);
  });

  it("los puntos de la cara siguen a la cabeza cuando gira", () => {
    const antes = pos("Fr");
    const head = boneMap.get("Head")!;
    head.rotation.y = Math.PI / 2;
    head.updateMatrixWorld(true);
    const despues = pos("Fr");
    expect(despues.distanceTo(antes)).toBeGreaterThan(0.2);
    // la distancia al hueso se conserva
    const hp = head.getWorldPosition(new THREE.Vector3());
    expect(Math.abs(despues.distanceTo(hp) - antes.distanceTo(hp))).toBeLessThan(1e-6);
    head.rotation.y = 0;
    head.updateMatrixWorld(true);
  });

  it("el espacio neutro queda en el aire, frente al pecho", () => {
    const p = pos(CODIGO_ESPACIO_NEUTRO);
    expect(p.z).toBeGreaterThan(0.25); // el tronco llega a z = 0.14
    expect(p.x).toBeGreaterThan(0); // del lado dominante
    expect(pos(CODIGO_ESPACIO_NEUTRO, true).x).toBeLessThan(0);
    expect(p.y).toBeLessThan(1.45);
    expect(p.y).toBeGreaterThan(1.2);
    expect(lector.normal(CODIGO_ESPACIO_NEUTRO, false, new THREE.Vector3())).toBeNull();
  });

  it("verticesDeMundo devuelve las mallas por separado", () => {
    const v = verticesDeMundo(raiz);
    expect(v.porMalla.length).toBe(6);
    expect(v.todos.length).toBe(v.porMalla.reduce((s, a) => s + a.length, 0));
  });
});
