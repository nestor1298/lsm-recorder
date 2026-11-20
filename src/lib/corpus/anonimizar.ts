/**
 * anonimizar.ts — quita nombres de personas del texto de los subtítulos.
 *
 * El programa presenta a sus invitadas por nombre («Su nombre es … y esta es
 * su seña»), y el corpus las nombra solo con seudónimo. Cada nombre propio de
 * persona se cambia por «[NOMBRE]». Se prefiere tapar de más que de menos:
 *
 *   - un nombre de pila conocido (lista de abajo), en cualquier lugar;
 *   - cualquier palabra con mayúscula a media oración que no sea un lugar o
 *     institución conocidos y que el corpus no use también en minúscula
 *     (las que sí, como «Recuerdo», son palabras comunes mal unidas);
 *   - lo que sigue a «me llamo», «se llama», «su nombre es»;
 *   - los apellidos que siguen a un nombre tapado (con «de», «del», «de la»).
 */

const NOMBRES = new Set(
  `adela adelina adeli adriana agustín alberto alejandra alejandrina alejandro alfonso alfredo alicia alma ana andrea andrés
  ángel ángela angélica antonio araceli armando arturo beatriz benito bertha blanca brenda bruno camila carla carlos carmen
  carolina cecilia césar chabelo claudia cristian cristina cristóbal daniel daniela david diana diego dolores eduardo elena
  elizabeth emilio enrique ernesto esperanza esteban estela eugenia fabiola fausto federico felipe fernanda fernando flavio
  francisco gabriel gabriela gaby gerardo gloria graciela guadalupe guillermo gustavo hanna héctor hilda hugo ignacio irma
  isabel itzel iván jaime javier jesús jimena joaquín jorge josé josefina juan juana julia julián julio karen karla laura
  leonardo leticia lilia lorena lourdes lucía luis luisa lupita manuel marcela marco margarita maría mariana mario marisol
  marta martha martín mateo mauricio miguel mónica nena nicolás norma óscar oscar pablo paola patricia paty paula pedro pepe
  perla rafael ramón raquel raúl ricardo roberto rocío rodrigo rosa rosario rubén salvador samuel sandra santiago sara
  sebastián sergio silvia sofía susana teresa tomás valentina valeria vanessa vero verónica víctor ximena yolanda
  abraham adrián aldo alonso amanda anahí arely aurora axel catalina cinthia dulce edgar edith efraín elías elisa emiliano
  erick erika esther fátima flor gael gilberto gisela gonzalo griselda hernán homero humberto irene isaac isaías ismael
  israel ivonne jazmín jonathan jordi josué karina kevin leonel liliana lizbeth lucero marcos mariela maricruz mayra
  melissa miriam moisés natalia nancy noemí octavio omar pamela ramiro regina renata rené reyna rigoberto rogelio rolando
  rosalba ruth saúl selene simón socorro tania ulises uriel vanesa wendy yazmín yesenia zaira beto chuy lalo memo pancho
  paco toño nacho lupe chela`.split(/\s+/),
);

/** Apellidos frecuentes (tapan aunque abran la oración: «Sanabria y esta es mi seña») */
const APELLIDOS = new Set(
  `garcía hernández martínez lópez gonzález pérez rodríguez sánchez ramírez cruz flores gómez morales vázquez jiménez reyes
  díaz torres gutiérrez ruiz mendoza aguilar ortiz moreno castillo romero álvarez méndez chávez rivera juárez ramos
  domínguez herrera medina castro vargas guzmán velázquez muñoz rojas salazar contreras luna ortega guerrero estrada
  bautista delgado cortés soto navarro alvarado sandoval campos ríos valdez valdés espinoza vega fuentes núñez cabrera
  carrillo silva rosales acosta pacheco ayala mejía rangel valencia lara ibarra robles escobar ávila sanabria frías frias
  fernández valls velasco carranza villanueva zúñiga orozco padilla montes cervantes nava solís trejo macías`.split(/\s+/),
);

/** Lugares, instituciones y palabras con mayúscula que no son personas */
const NO_PERSONA = new Set(
  `méxico mexicana mexicano mexicanos estados unidos jalisco guadalajara zapopan tlajomulco tonalá tlaquepaque chapala
  chapalita glorieta brasil tokio turquía japón colombia puebla yucatán zacatecas sonora monterrey veracruz morelos
  hidalgo cuernavaca guanajuato pachuca argentina canadá europa dallas texas atotonilco alto lagos ciudad estado
  secretaría secretaria educación pública universidad escuela secundaria primaria normal superior especialidades nacional
  asociación federación gobierno instituto centro artes plásticas recursos humanos juegos panamericanos olímpicos
  sordolímpicos paralímpicos facebook instagram youtube atlas chivas lengua señas sordos sorda sordo sordas dios voces
  méxico lsm usaer cam dif imss sep inclusión discapacidad niños ciegos internet whatsapp`.split(/\s+/),
);

/** Saludos e interjecciones que abren oración con coma y no son nombres */
const SALUDOS = new Set(
  `hola bienvenidos bienvenidas bienvenido bienvenida gracias bueno claro oye mira órale híjole hijole ay uy guau ok sí si
  no exacto perfecto ah oh eh pues saludos amigos amigas señora señor señoras señores finalmente lamentablemente
  afortunadamente efectivamente bien vaya`.split(/\s+/),
);

const ANTES_DE_NOMBRE = /\b(me llamo|se llama|se llaman|mi nombre es|su nombre es|nombre es|llamado|llamada)\s+$/i;
const UNION = new Set(["de", "del", "la", "los"]);

const esMayus = (w: string) => /^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+$/.test(w);
const baja = (w: string) => w.toLocaleLowerCase("es");

/** Palabras que el corpus usa en minúscula (para no tapar «Recuerdo», «Considero»…) */
export function vocabularioComun(textos: string[]): Set<string> {
  const v = new Set<string>();
  for (const t of textos) for (const w of t.match(/[a-záéíóúñü]+/g) ?? []) if (w === baja(w)) v.add(w);
  return v;
}

/** Quita el logo del programa que el OCR pega al subtítulo («VOCESe SEÑAS») */
export function sinLogo(t: string): string {
  return t.replace(/\bVOCES\s*(?:e|en|EN)?\s*SE[ÑN]AS\b/g, "").replace(/\bVOCES(?:e|en)\b/g, "").replace(/\s{2,}/g, " ").trim();
}

const PUNTO_FIN = /[,.;:?!…]["»)]*$/;
const PAL = /^([¿¡"«(]*)([A-Za-zÁÉÍÓÚÑÜáéíóúñü]+)([^\s]*)$/;

/** Qué palabras de la oración (ya partida en palabras) son nombre de persona */
function marcar(ws: string[], comun: Set<string>): boolean[] {
  const pal = ws.map((p) => p.match(PAL));
  const tapar = ws.map(() => false);
  let inicio = true;
  for (let i = 0; i < ws.length; i++) {
    const m = pal[i];
    const w = m?.[2] ?? "";
    const b = baja(w);
    if (m && esMayus(w) && !NO_PERSONA.has(b)) {
      const tras = ANTES_DE_NOMBRE.test(ws.slice(0, i).join(" ") + " ");
      // apellido: mayúscula justo después de un nombre tapado (o tras «de», «de la»)
      let k = i - 1;
      while (k >= 0 && UNION.has(baja(ws[k]))) k--;
      const trasNombre = k >= 0 && tapar[k] && !PUNTO_FIN.test(ws[k]);
      const pegado = [...NOMBRES].some((n) => n.length >= 4 && b.startsWith(n) && b.length <= n.length + 3);
      if (NOMBRES.has(b) || APELLIDOS.has(b) || tras || trasNombre) tapar[i] = true;
      else if (!comun.has(b) && !SALUDOS.has(b)) {
        // a media oración: nombre propio; al inicio, solo si va solo antes de una
        // coma (vocativo: «Omar, quisiera preguntarte») o es un nombre pegado al OCR
        if ((!inicio && !m[1]) || /,$/.test(ws[i]) || pegado) tapar[i] = true;
      }
    }
    inicio = /[.?!…]["»)]*$/.test(ws[i]);
  }
  return tapar;
}

/** Arma el texto con cada racha de nombre (con «de», «de la» en medio) como [NOMBRE] */
function armar(ws: string[], tapar: boolean[]): string {
  const out: string[] = [];
  for (let i = 0; i < ws.length; i++) {
    if (!tapar[i]) {
      out.push(ws[i]);
      continue;
    }
    let fin = i;
    for (let j = i + 1; j < ws.length; j++) {
      if (PUNTO_FIN.test(ws[fin])) break;
      if (tapar[j]) fin = j;
      else if (!UNION.has(baja(ws[j]))) break;
    }
    out.push(`${ws[i].match(/^([¿¡"«(]*)/)?.[1] ?? ""}[NOMBRE]${ws[fin].match(/([,.;:?!…"»)]*)$/)?.[1] ?? ""}`);
    i = fin;
  }
  return out.join(" ");
}

const palabras = (t: string) => t.split(/\s+/).filter(Boolean);

export function anonimizarTexto(texto: string, comun: Set<string>): string {
  const ws = palabras(texto);
  return armar(ws, marcar(ws, comun));
}

/**
 * Las tarjetas de una oración, anonimizadas mirando la oración entera: un
 * nombre partido entre dos tarjetas («… dijo Juan» / «Sanabria y esta es…»)
 * se reconoce igual.
 */
export function anonimizarTarjetas(tarjetas: string[], comun: Set<string>): string[] {
  const porTarjeta = tarjetas.map(palabras);
  const tapar = marcar(porTarjeta.flat(), comun);
  let k = 0;
  return porTarjeta.map((ws) => {
    const t = tapar.slice(k, k + ws.length);
    k += ws.length;
    return armar(ws, t);
  });
}
