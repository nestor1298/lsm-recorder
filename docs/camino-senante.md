# El camino del señante

Desde octubre de 2026 SignaLab recibe a quien graba como lo hace
[Huddle](https://huddle.playwithasl.com) (Play With ASL / CLERC) con sus
*signers*: una portada de una pantalla, una intro de 40 segundos, unirse
en tres pasos con un acuerdo de una página, elegir una lista, y un
estudio que es un juego (niveles, cofres, medallas, tablero de la semana,
tarjeta de señante). Lo que se replica es el **camino**; lo que se
conserva es la **esencia** de SignaLab.

## Huddle → SignaLab

| Huddle (signers) | SignaLab | Por qué así |
| --- | --- | --- |
| «Play in ASL. Train the AI.» + Free / Private / Useful | `/`: «Seña en LSM. Construye el corpus.» + Gratis / Tuyo / Útil | El fin no es «entrenar la IA» sino el corpus: investigar, enseñar (Aprender) y jugar (SignaPlay). |
| Intro de 40 s (8 escenas, contadores) | `Intro40` (8 diapositivas, contadores, Pausa/Saltar, Esc) | Mismas cifras de la FMS; se suma «desde 2005 la LSM es lengua nacional» y el rostro como parte de la lengua. |
| Join 1: nombre, correo, edad, *pseudo* | Unirse 1: correo (código) + apodo | Sin contraseñas (Cognito OTP ya existía). El nombre solo se pide al firmar. |
| Join 2: país/estado, Deaf/HoH/hearing, desde cuándo, ASL desde, familia sorda | Unirse 2: edad, estado, audición, sorda desde, LSM desde, familia sorda | Cae en `ParticipantMetadata` (nuevo `sorda_desde`); el cuestionario largo sigue en `/perfil`. |
| Join 3: pagado/voluntario, banco, dirección + acuerdo de una página + nombre escrito | Unirse 3: **nivel de acceso** (abierto / investigación / restringido) + acuerdo de una página + nombre escrito **o video en LSM** | No hay pago. Lo que sí se decide es quién ve tus videos. El consentimiento en LSM se conserva como forma de firma. |
| «Your face is never published» (derivados anonimizados) | «Tu rostro es parte de tu lengua»: no se borra; el nivel de acceso te protege | Difuminar el rostro borra parte de la seña. |
| Personal code (`mia-4821`) para otro dispositivo | El mismo correo + código | Ya lo resolvía la OTP. |
| Pick a list: bloques de 100 frases, ≤9 signers, Priority / Most needed, % hecho, *Our community goal* | `/listas`: 4 listas del LSM Corpus (por frecuencia) + 12 de SignaPlay (11 rutas + sueltas), meta 9 personas por seña, Prioridad / Más necesitada, lo que llevas, *Nuestra meta* | Las listas salen de los dos corpus (222 señas). |
| «Can you do it?» → Yes, I can / No, show me other lists | `DialogoCompromiso`: «¿Puedes con esta lista?» | Igual. |
| Studio: REC, Back/Pause/Next/Skip, R redo, B break | `/estudio`: Grabar (espacio) → revisar → Guardar (Enter) / Rehacer (R); Atrás / Siguiente / Saltar (S); Descanso (B) | Una pantalla sin scroll, cámara protagonista. |
| Level up, chest every 10 videos (collected signs by rarity), badges Bronze 30 / Silver 50 / Gold 70 / Diamond 100, weekly leaderboard by pseudo, signer card | Nivel = videos; cofre cada 10 con la seña más rara de la decena; medallas Bronce 30 / Plata 50 / Oro 70 / Diamante 100; `/tablero` semanal por apodo; `/tarjeta` (PNG 1080×1350) + colección | La rareza viene del corpus (ver abajo). |
| Review: a video can be refused → record it again | Mis grabaciones muestra «Rechazada» con «Volver a grabarla» (`/estudio?corpus=&items=`) | El estado ya existía. |
| FAQ, withdraw by email | `/preguntas`, `/acuerdo`; retirar desde Mis grabaciones | Retirar es un botón, no un correo. |

## Rareza, niveles, medallas (`src/lib/progresion.ts`)

- **Nivel** = videos confirmados y no retirados (`videos_total` en el
  perfil). Repetir una seña en la misma sesión no suma; retirar resta.
- **Cofre** cada 10 videos: muestra la seña más rara de los últimos diez
  (el cliente recuerda la rareza que devuelve cada confirmación).
- **Medallas**: Bronce 30, Plata 50, Oro 70, Diamante 100.
- **Rareza** por corpus: LSM Corpus → nivel de frecuencia de la CM (T1
  común, T2 rara, T3 épica, T4 legendaria); SignaPlay → rutas 1–4 común,
  5–8 rara, 9–11 épica, sin ruta (`PERRO`) legendaria.
- **Semana** = semana ISO en UTC (`2026-W44`).

## Datos: todo se acumula al escribir

El rol del runtime solo tiene `GetItem/PutItem/UpdateItem/Query` (sin
`Scan`), así que nada «entre personas» se calcula leyendo la tabla:

| Llave | Qué guarda | Cuándo cambia |
| --- | --- | --- |
| `PART#{uid}` / `PROFILE` | `apodo`, `apodo_norm`, `videos_total`, `consent_signed_name`, `consent_agreement_version`, `consent_signed_at` | apodo, confirmar, retirar, firmar |
| `APODO#{norm}` | `user_id`, `libre` | reclamar apodo (condición: libre o propio) |
| `SENANTE#{uid}` / `ITEM#{corpus}#{item}` | `activo` | primera grabación de la seña (`activo=true`), último retiro (`false`) |
| `COBERTURA#{corpus}` / `ITEM#{item}` | `senantes` | ±1 cuando el marcador cambia |
| `TABLERO#{semana}` / `PART#{uid}` | `videos`, `apodo`, `nivel` | confirmar (+1), retirar (−1 en la semana del video) |

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
es la cobertura (`SENANTE#`/`COBERTURA#`) ni el tablero de semanas
pasadas: para eso hace falta un *backfill* del operador (pendiente).

## API

- `GET /api/me` → además `apodo`, `agreementVersion`, `videos`, `nivel`, `medalla`.
- `POST /api/apodo` `{apodo}` → 409 si está ocupado.
- `GET /api/progreso` → nivel, medalla, siguiente, cofre, videos de la semana, `porLista`, `coleccion` (una por seña con su rareza), `rarezaMax`, `cmDistintas`.
- `GET /api/listas` → cobertura por lista (personas por seña, %), `tuyas`, `masNecesitada`, `comunidad {pct, hechas, meta}`.
- `GET /api/tablero?semana=` → filas por apodo (tope 20) y tu puesto.
- `POST /api/consent/grant` → además `signedName` (obligatorio en modo texto cuando se manda `agreementVersion`) y `agreementVersion` (409 si no es la vigente).
- `POST /api/profile` → además `sorda_desde`.
- `POST /api/recordings/confirm` → además `progreso {videos, nivel, cofre, medalla, rareza}` cuando el video es nuevo.

## Rutas

`/` portada · `/unirse` (3 pasos; `?paso=` es pista) · `/auth` entrar ·
`/listas` · `/estudio?session=` (o `?corpus=&items=`) · `/tablero` ·
`/tarjeta` · `/preguntas` · `/acuerdo` · `/mis-grabaciones` · `/perfil`
(cuestionario largo) · `/record` (subir archivos; sigue existiendo) ·
`/consentimiento` → redirige a `/unirse?paso=3`.

`src/lib/camino.ts` decide a dónde mandar a cada persona: el primer paso
que falte (apodo → cuestionario → acuerdo) o las listas. Quien ya estaba
en el piloto sin apodo entra por el paso 1 al volver.

## Pendientes

- *Backfill* de cobertura y tablero para las grabaciones anteriores.
- Rehacer en otra semana una seña ya guardada mueve su `recorded_at`; si
  luego se retira, el tablero descuenta en la semana nueva y no en la
  original. Raro en el piloto; se corrige guardando la semana en que contó.
- Si `contarVideoNuevo` falla después de guardar la grabación (error de
  DynamoDB), ese video queda en el corpus sin sumar nivel ni cobertura; el
  *backfill* lo reconcilia.
- Validar con OtherAI el correo de contacto (`CONTACTO_SIGNALAB`) y el
  texto del acuerdo (versión 1.0) antes de abrirlo a la comunidad.
- Videos en LSM para la intro y para cada paso de Unirse.
