# Brazo del avatar: cinemática inversa y lugares (UB)

Cómo llega la mano de Lexsi a un lugar del cuerpo y dónde están los 80
lugares de la LSM-PN sobre su malla. Vale para `/learn` (Explorar y
Construir) y para cualquier consumidor de `Hand3DViewer`.

## Lugares sobre la malla (`src/lib/ub_anatomia.ts`)

Los 80 lugares ya no son offsets a mano: cada uno se define por anatomía
respecto a marcas medidas en la propia malla al cargar (coronilla, barbilla,
ojos, nariz, ancho de la cabeza, huesos) y una dirección de proyección
(frente, atrás, arriba, abajo, lado). El punto se proyecta a la superficie
tomando el vértice más saliente en esa dirección dentro de un cilindro
(`extremoEnCilindro`), conservando las coordenadas pedidas y tomando solo
la profundidad de la malla. Se guarda en el espacio local del hueso más
cercano, así que:

- los puntos de la cara siguen a la cabeza (cejas, asentir, inclinar);
- brazo, antebrazo y mano son los del brazo **base** (el que no seña) y
  siguen a ese brazo, incluidos los dedos;
- hombro y clavícula son los contralaterales (los que sí alcanza la mano).

`LectorUB` da posición y normal de mundo en tiempo de animación, para la
mano dominante (`espejo=false`) y para la otra (`espejo=true`). El código
`EN` es el espacio neutro: un punto en el aire frente al hombro dominante,
sin superficie, donde Explorar muestra formas y orientaciones.

Si no se reconoce la malla de los ojos, se estiman por proporción (a 60 %
de la altura de la cabeza). Solo si faltan los huesos de referencia
(cabeza, cuello, brazos) cada lugar cae al offset histórico de
`UB_BONE_MAP`.

## Colocar el brazo (`src/lib/brazo_ik.ts` + `AvatarModel.colocarBrazo`)

Objetivo: el **centro de la palma** (no la muñeca) sobre el punto, con la
orientación pedida, respetando el cuerpo:

| Articulación | Rango |
| --- | --- |
| Codo (bisagra pura, eje X local del antebrazo) | 3° – 145° |
| Hombro: elevación desde colgando | 0° – 165° |
| Hombro: azimut desde el lado (90° = al frente) | −50° (atrás) – 135° (cruzado) |
| Codo alrededor de hombro–muñeca (swivel) | vuelta completa, con costo |
| Antebrazo (pronación / supinación desde la pose T, que es neutra) | 80° / 85° |
| Muñeca: flexión / extensión | 75° / 70° |
| Muñeca: desviación radial / cubital | 20° / 30° |

Pasos por cuadro y por brazo:

1. **Orientación deseada.** La pedida (OR) o, si no hay, palma hacia el
   cuerpo (contra la normal) con los dedos hacia arriba salvo que así la
   muñeca quede fuera de alcance o pegada al hombro; entonces se prueban
   atrás, lejos del hombro, hacia el hombro, al frente y abajo.
2. **Punto de contacto.** El centro de la palma; si con la palma la muñeca
   no alcanza, el contacto se corre hacia las yemas (así se toca la
   coronilla con los dedos, como una persona).
3. **Muñeca objetivo** = punto − R·contacto (`munecaParaPalma`).
4. **IK de dos huesos** (`resolverBrazo`): clavícula (encoge/protrae un
   poco hacia objetivos altos o cruzados), ley de cosenos para el codo,
   bisagra alineada al plano hombro–codo–muñeca, y búsqueda del swivel más
   natural: llegar pesa más, luego no salir del cono del hombro, no subir
   el codo por encima de hombro y muñeca, y quedarse cerca del polo
   (abajo, afuera, un poco atrás). Los ejes se miden del esqueleto, no se
   asumen.
5. **Orientación de la mano** (`resolverOrientacion`): gira el codo
   alrededor de hombro–muñeca (la muñeca no se mueve), reparte el giro
   entre pronosupinación y muñeca dentro de sus rangos, y castiga el codo
   alto y salir del cono.
6. **Cuatro pasadas**: la muñeca de cada pasada se calcula con la
   orientación que de verdad se logró en la anterior. Las dos primeras
   piden la orientación deseada; las dos últimas piden la que se logró en
   la segunda (punto fijo). Se conserva la mejor por suma de error de
   palma y de orientación: con superficie manda la palma; en el espacio
   neutro manda la orientación. Si la palma lograda mira hacia fuera de
   la superficie, lo que toca es el dorso de la mano (la mano nunca queda
   dentro del cuerpo); voltear la palma respecto a lo pedido se castiga.

Si el lugar está sobre el brazo base, ese brazo se **presenta al frente**
(antebrazo cruzado frente al vientre, palma arriba si el lugar es del lado
de la palma) para que la otra mano lo alcance.

## Lo que Lexsi no puede hacer

Lexsi tiene cabeza grande y brazos cortos (alcance hombro→muñeca 0.57 u
con 2.5 u de alto). Por eso:

- coronilla, codo y cara interior del brazo base se tocan con las yemas;
- muslo y rodilla quedan lejos (haría falta inclinar el tronco);
- el lado del cuello del mismo lado queda a ~10 cm (codo al máximo);
- en el espacio neutro, "dedos arriba" con la palma hacia uno mismo o
  hacia dentro sale inclinado ~20–50°, y "dedos hacia mí" o "hacia fuera"
  frente al pecho no son alcanzables: la mano queda lo más cerca posible.

## Medición

Con el visor en `/learn` → UB se midió, para los 80 lugares, la distancia
del centro de la palma (o del punto de contacto en los dedos) al punto:
75 quedan a ≤ 2.5 cm de escena (la mayoría ≤ 0.5 cm), con el codo entre
3° y 146° y la elevación del brazo ≤ 160°.
