import { describe, it, expect } from "vitest";
import { anonimizarTarjetas, anonimizarTexto, sinLogo, vocabularioComun } from "./anonimizar";

const comun = vocabularioComun(["recuerdo que considero que la lengua es bonita", "su nombre es y esta es su seña"]);

describe("anonimizarTexto", () => {
  it("tapa nombre y apellidos", () => {
    expect(anonimizarTexto("Su nombre es Ramón Ramírez y esta es su seña.", comun)).toBe("Su nombre es [NOMBRE] y esta es su seña.");
    expect(anonimizarTexto("Hola, soy Ana María de la Rosa, conductora.", comun)).toBe("Hola, soy [NOMBRE], conductora.");
  });
  it("tapa un nombre de pila al inicio y desconocidos a media oración", () => {
    expect(anonimizarTexto("Alejandrina, ¿cómo estás?", comun)).toBe("[NOMBRE], ¿cómo estás?");
    expect(anonimizarTexto("Ayer vi a Xochiquetzal en la escuela.", comun)).toBe("Ayer vi a [NOMBRE] en la escuela.");
  });
  it("deja lugares, instituciones y palabras comunes", () => {
    expect(anonimizarTexto("Vivo en Guadalajara, Jalisco, y estudié en la Universidad.", comun)).toBe(
      "Vivo en Guadalajara, Jalisco, y estudié en la Universidad.",
    );
    expect(anonimizarTexto("Bien. Recuerdo que la Lengua de Señas Mexicana es bonita.", comun)).toBe(
      "Bien. Recuerdo que la Lengua de Señas Mexicana es bonita.",
    );
  });
});

describe("anonimizarTarjetas", () => {
  it("reconoce un nombre partido entre tarjetas", () => {
    expect(anonimizarTarjetas(["Mi invitada es Lucía", "Sanabria y esta es su seña."], comun)).toEqual([
      "Mi invitada es [NOMBRE]",
      "[NOMBRE] y esta es su seña.",
    ]);
  });
  it("tapa un vocativo al inicio", () => {
    expect(anonimizarTarjetas(["Xoch, quisiera preguntarte"], comun)).toEqual(["[NOMBRE], quisiera preguntarte"]);
  });
});

describe("sinLogo", () => {
  it("quita el logo pegado", () => {
    expect(sinLogo("¿En el tema de la Lengua VOCESe SEÑAS a futuro?")).toBe("¿En el tema de la Lengua a futuro?");
    expect(sinLogo("Bienvenidos a Voces en Señas.")).toBe("Bienvenidos a Voces en Señas.");
  });
});
