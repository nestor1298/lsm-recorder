# El camino del señante

Desde octubre de 2026 SignaLab recibe a quien graba como lo hace
[Huddle](https://huddle.playwithasl.com) (Play With ASL / CLERC) con sus
*signers*: una portada de una pantalla, una intro de 40 segundos, unirse
en tres pasos con un acuerdo de una página, elegir una lista, y un
estudio que es un juego. Lo que se replica es el **camino**; lo que se
conserva es la **esencia** de SignaLab. La historia de la intro y el
juego son **propios** (ver «Nueve manos»): no se copian los niveles,
cofres, rarezas, medallas ni el tablero de posiciones de Huddle.

## Huddle → SignaLab

| Huddle (signers) | SignaLab | Por qué así |
| --- | --- | --- |
| «Play in ASL. Train the AI.» + Free / Private / Useful | `/`: «Seña en LSM. Construye el corpus.» + Gratis / Tuyo / Útil | El fin no es «entrenar la IA» sino el corpus: investigar, enseñar (Aprender) y jugar (SignaPlay). |
| Intro de 40 s (8 escenas con cifras) | `Intro40`: **la historia de una seña** (MAÑANA), 8 escenas con dibujo animado propio (`inicio/historia/Escenas.tsx`), Pausa/Saltar/Esc | En vez de cifras, un relato: la buscas y no está descrita → una persona no basta → nueve manos → tú puedes ser una → tu cara se queda → la novena cierra el círculo → la seña sigue a investigación, Aprender y SignaPlay. |
| Join 1: nombre, correo, edad, *pseudo* | Unirse 1: correo (código) + apodo | Sin contraseñas (Cognito OTP ya existía). El nombre solo se pide al firmar. |
| Join 2: país/estado, Deaf/HoH/hearing, desde cuándo, ASL desde, familia sorda | Unirse 2: edad, estado, audición, sorda desde, LSM desde, familia sorda | Cae en `ParticipantMetadata` (nuevo `sorda_desde`); el cuestionario largo sigue en `/perfil`. |
| Join 3: pagado/voluntario, banco, dirección + acuerdo de una página + nombre escrito | Unirse 3: **nivel de acceso** (abierto / investigación / restringido) + acuerdo de una página + nombre escrito **o video en LSM** | No hay pago. Lo que sí se decide es quién ve tus videos. El consentimiento en LSM se conserva como forma de firma. |
| «Your face is never published» (derivados anonimizados) | «Tu rostro es parte de tu lengua»: no se borra; el nivel de acceso te protege | Difuminar el rostro borra parte de la seña. |
| Personal code (`mia-4821`) para otro dispositivo | El mismo correo + código | Ya lo resolvía la OTP. |
| Pick a list: bloques de 100 frases, ≤9 signers, Priority / Most needed, % hecho, *Our community goal* | `/listas`: 4 listas del LSM Corpus (por frecuencia) + 12 de SignaPlay (11 rutas + sueltas), meta 9 personas por seña, Prioridad / Más necesitada, lo que llevas, *Nuestra meta* | Las listas salen de los dos corpus (222 señas). |
| «Can you do it?» → Yes, I can / No, show me other lists | `DialogoCompromiso`: «¿Puedes con esta lista?» | Igual. |
| Studio: REC, Back/Pause/Next/Skip, R redo, B break | `/estudio`: Grabar (espacio) → revisar → Guardar (Enter) / Rehacer (R); Atrás / Siguiente / Saltar (S); Descanso (B) | Una pantalla sin scroll, cámara protagonista. |
| Level up, chest every 10 videos, rarity, badges 30/50/70/100, weekly leaderboard, signer card | **Nueve manos** (propio): tu lugar en el círculo de cada seña, la novena lo cierra; atlas de la mano (101 CM por grupos de dedos); sellos de ruta de SignaPlay; `/comunidad` (les falta poco, círculos cerrados con apodos, mapa por estado); `/tarjeta` (PNG 1080×1350) | Cooperativo y lingüístico: la meta de nueve personas por seña es la del corpus, el atlas enseña la fonología de Cruz Aldrete, y no hay posiciones entre personas. `/tablero` redirige a `/comunidad`. |
| Review: a video can be refused → record it again | Mis grabaciones muestra «Rechazada» con «Volver a grabarla» (`/estudio?corpus=&items=`) | El estado ya existía. |
| FAQ, withdraw by email | `/preguntas`, `/acuerdo`; retirar desde Mis grabaciones | Retirar es un botón, no un correo. |

## Nueve manos (`src/lib/nueve_manos.ts`)

Una seña no queda documentada con una sola persona: cada quien la hace
con sus manos, su cara, su región y su historia. Cada una de las 222
señas busca **nueve manos** (nueve personas distintas).

- **Tu mano**: al guardar una seña nueva para ti, el servidor devuelve tu
  lugar en su círculo («la mano 4 de 9»). La novena **cierra el círculo**:
  la seña queda completa y la comunidad muestra los apodos de sus nueve
  manos. Más allá de nueve, la mano suma variedad.
- **Atlas de la mano** (LSM Corpus): las 101 CM en los cinco grupos de
  dedos seleccionados (A 1234 · B 123 · C 12 · D 1 · E meñique y
  especiales). Completar un grupo es un momento.
- **Sellos de ruta** (SignaPlay): grabar todas las señas de una de las 11
  rutas da su sello.
- **Comunidad**: señas a 1–3 manos de cerrarse (sin las tuyas, con botón
  para grabarlas), círculos cerrados en la semana con sus apodos, manos
  que llegaron esa semana y el mapa de manos por estado (mosaico de
  `src/lib/mapa_mx.ts`, escalones de color). Sin posiciones.
- **Momentos** al confirmar (`momentosAlGuardar`): primera seña, tu mano
  (aviso breve), círculo cerrado, grupo del atlas completo, sello de ruta.
- **Semana** = semana ISO en UTC (`src/lib/semana.ts`).

## Datos: todo se acumula al escribir

El rol del runtime solo tiene `GetItem/PutItem/UpdateItem/Query` (sin
`Scan`), así que nada «entre personas» se calcula leyendo la tabla:

| Llave | Qué guarda | Cuándo cambia |
| --- | --- | --- |
| `PART#{uid}` / `PROFILE` | `apodo`, `apodo_norm`, `videos_total`, `consent_signed_name`, `consent_agreement_version`, `consent_signed_at` | apodo, confirmar, retirar, firmar |
| `APODO#{norm}` | `user_id`, `libre` | reclamar apodo (condición: libre o propio) |
| `SENANTE#{uid}` / `ITEM#{corpus}#{item}` | `activo`, `mano`, `estado` | primera grabación de la seña (`activo=true`), último retiro (`false`) |
| `COBERTURA#{corpus}` / `ITEM#{item}` | `senantes` (manos) | ±1 cuando el marcador cambia |
| `CIRCULO#{corpus}#{item}` / `PART#{uid}` | `apodo`, `mano`, `activo` | entrar al círculo, retirar, cambiar de apodo |
| `COMPLETAS#{semana}` / `ITEM#{corpus}#{item}` | `cerrada` | llega la novena mano |
| `COMUNIDAD#SEMANAS` / `SEMANA#{semana}` | `manos`, `completas` | cada mano nueva (no bajan al retirar: cuentan llegadas) |
| `COMUNIDAD#ESTADOS` / `ESTADO#{estado}` | `manos` | ±1 con el estado guardado en el marcador |

Las filas `TABLERO#{semana}` del primer camino quedan en la tabla sin uso.

`contarVideoNuevo` corre en `/api/recordings/confirm` solo cuando la
grabación no existía (una repetición de la misma seña en la misma sesión
sobrescribe el mismo ítem y no cuenta); `descontarVideo` en
`/api/recordings/{id}/withdraw` solo cuando el retiro la cambia de activa
a retirada (condición en DynamoDB: el doble clic no descuenta dos veces).
`putRecording` nunca reemplaza la grabación de otra persona (409). El
apodo anterior no se libera al cambiarlo: queda reservado a quien lo usó.

Perfiles anteriores a los contadores: `/api/me` y `/api/progreso` cuentan
sus grabaciones activas mientras `videos_total` no exista, y el primer
video nuevo lo crea con `if_not_exists(videos_total, base) + 1`, donde
`base` son las grabaciones activas previas. Lo que no se reconstruye solo
es la cobertura (`SENANTE#`/`COBERTURA#`/`CIRCULO#`) ni el mapa por
estado: para eso hace falta un *backfill* del operador (pendiente).

## API

- `GET /api/me` → además `apodo`, `agreementVersion`, `videos`, `estado`.
- `POST /api/apodo` `{apodo}` → 409 si está ocupado.
- `GET /api/progreso` → `senas`, `completas`, `cerraste`, `atlas`, `rutas`, `sellos`, `misSenas` (tu lugar y cómo va cada círculo), videos de la semana.
- `GET /api/listas` → cobertura por lista (manos por seña, %), `tuyas`, `masNecesitada`, `comunidad {pct, hechas, meta}`, `senantes` por seña y `eres` (para el estudio).
- `GET /api/comunidad?semana=` → `completas`, `meta`, `casi`, `deLaSemana {manos, completas, circulos[apodos]}`, `estados`.
- `POST /api/consent/grant` → además `signedName` (obligatorio en modo texto cuando se manda `agreementVersion`) y `agreementVersion` (409 si no es la vigente).
- `POST /api/profile` → además `sorda_desde`.
- `POST /api/recordings/confirm` → además `progreso {videos, mano, momentos}` cuando el video es nuevo.

## Rutas

`/` portada · `/unirse` (3 pasos; `?paso=` es pista) · `/auth` entrar ·
`/listas` · `/estudio?session=` (o `?corpus=&items=`) · `/comunidad` (`/tablero` redirige) ·
`/tarjeta` · `/preguntas` · `/acuerdo` · `/mis-grabaciones` · `/perfil`
(cuestionario largo) · `/record` (subir archivos; sigue existiendo) ·
`/consentimiento` → redirige a `/unirse?paso=3`.

`src/lib/camino.ts` decide a dónde mandar a cada persona: el primer paso
que falte (apodo → cuestionario → acuerdo) o las listas. Quien ya estaba
en el piloto sin apodo entra por el paso 1 al volver.

## Pendientes

- *Backfill* de cobertura, círculos y mapa para las grabaciones anteriores
  (sin él, esas señas cuentan en tu atlas pero no en sus círculos).
- Si una seña completa pierde una mano y vuelve a llegar a nueve en la
  misma semana, el contador de círculos cerrados de esa semana suma dos.
- Si `contarVideoNuevo` falla después de guardar la grabación (error de
  DynamoDB), ese video queda en el corpus sin sumar al total ni al círculo; el
  *backfill* lo reconcilia.
- Validar con OtherAI el correo de contacto (`CONTACTO_SIGNALAB`) y el
  texto del acuerdo (versión 1.1: el juego de las nueve manos y el mapa
  por estado) antes de abrirlo a la comunidad.
- Videos en LSM para la intro y para cada paso de Unirse.
