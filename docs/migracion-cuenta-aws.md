# Migración de producción a la cuenta AWS nueva

Plan operativo para mover SignaLab (infra, datos y dominio) de la cuenta
actual (`<CUENTA_VIEJA>`, `us-west-1`) a la cuenta nueva de other-ai.com
(`<CUENTA_NUEVA>`, `<REGION_NUEVA>`). No lleva ids de cuenta ni secretos:
donde hace falta un valor va un marcador. Todo lo marcado **V** es una
verificación obligatoria antes de seguir. Los comandos los corre la persona
operadora; los agentes no despliegan ni tocan cuentas.

## 0. Dos hechos que gobiernan el plan

1. **El id de usuario cambia.** La app identifica a cada persona por el
   `sub` de Cognito y un pool nuevo asigna un `sub` nuevo a cada quien; el
   correo no se guarda en la tabla. Por eso hay que construir el mapa
   `sub_viejo → sub_nuevo` por correo (el único puente vive en el pool
   viejo) y reescribir con él la tabla y las llaves de S3. Lo hace
   `scripts/migracion/remap.mjs`; el mapa es dato personal y se destruye
   al terminar.
2. **El dominio no cruza cuentas en la misma región.** Amplify rechaza
   asociar un dominio que ya estuvo asociado a una app de otra cuenta en la
   misma región (error 400 «cross account domain association»; hay que
   pedirlo a Soporte). Por eso la recomendación es desplegar la cuenta
   nueva en **otra región**, por ejemplo `us-west-2` (Oregón): Cognito
   ESSENTIALS y Amplify WEB_COMPUTE están disponibles y los datos son
   pequeños. Si se quiere conservar `us-west-1`, abrir el caso de soporte
   antes del cutover.

## 1. Qué se mueve

| Recurso | Cuenta vieja | Cuenta nueva |
| --- | --- | --- |
| Stack CDK `SignalabPilotStack` | existe | se crea |
| Buckets `signalab-recordings-<cuenta>-<región>` y `signalab-consent-…` | nombres con cuenta vieja | nombres con cuenta nueva (automático) |
| Tabla `signalab-corpus` (pk/sk + gsi1) | existe | se crea con el mismo nombre; los ítems se copian remapeados |
| Cognito `signalab-participants` + cliente `signalab-web` | ids viejos | ids nuevos; usuarios recreados por correo |
| Policy `signalab-app-runtime`, rol `signalab-amplify-compute` | existen | se crean (mismos nombres, ARN nuevo) |
| App Amplify `signalab-web`, rama `main`, dominio `signalab.other-ai.com` | existen | se crean con un PAT de GitHub nuevo |

No se mueve: el DNS (sigue en Cloudflare; solo cambian dos CNAME), el
repositorio de GitHub, ni el código de la app (el CDK ya toma cuenta y
región del perfil con el que se despliega).

Datos que se transforman: cada llave de S3 lleva el `sub` como prefijo
(`{sub}/{sessionId}/{itemId}.{ext}`, `{sub}/consent.webm`); en la tabla el
`sub` está en `participant` (`pk`, `user_id`, `consent_video_key`),
`session` (`pk`, `user_id`), `recording` (`gsi1pk`, `participant_id`,
`s3_key`) y `annotation` (`gsi1pk`, `annotator_id`). Ver
`scripts/migracion/remap_items.mjs`.

## 2. Prerrequisitos

**Cuenta nueva.** IAM Identity Center con un permission set
`AdministratorAccess` (temporal, mientras dure la migración). Perfil local:

```bash
aws configure sso --profile signalab-nueva   # sesión SSO nueva, cuenta <CUENTA_NUEVA>, región <REGION_NUEVA>
aws sso login --profile signalab-nueva
aws sts get-caller-identity --profile signalab-nueva   # V: devuelve <CUENTA_NUEVA>
```

**Cuenta vieja.** El perfil `signalab-deploy` solo puede asumir los roles
de CDK: no alcanza para leer datos. Crear (desde la consola, con un usuario
administrador) un rol o usuario `signalab-migracion-ro` con lectura sobre
`signalab-corpus` (`DescribeTable`, `Scan`, `Query`), ambos buckets
(`ListBucket`, `GetObject`), el pool (`ListUsers`, `DescribeUserPool`),
`cloudformation:DescribeStacks` y `amplify:Get*`. Perfil local
`signalab-vieja-ro`. Para la ventana de congelación y el cutover hace falta
además escritura acotada (`iam:AttachRolePolicy`/`DetachRolePolicy` sobre
`signalab-amplify-compute` y `amplify:DeleteDomainAssociation`): perfil
`signalab-vieja-cutover`, usado solo en esos pasos.

**Secretos.** `infra/cdk.out/` guarda la plantilla sintetizada con el PAT de
GitHub en texto plano: borrarlo antes y después de cada deploy. Crear un
PAT nuevo de grano fino para `nestor1298/lsm-recorder` (Contents y Metadata
lectura, Webhooks lectura y escritura) y revocar el viejo cuando la app
nueva quede conectada. Rotar las llaves estáticas de `signalab-deploy` al
apagar la cuenta vieja.

**Local.** Node 20+, `cd infra && npm ci && npm run build`, y un directorio
efímero `~/signalab-migracion` (`chmod 700`) para exportaciones y el mapa.

Variables para el script (exportar en el shell de la migración):

```bash
export PERFIL_VIEJO=signalab-vieja-ro PERFIL_NUEVO=signalab-nueva
export REGION_VIEJA=us-west-1 REGION_NUEVA=<REGION_NUEVA> TABLA=signalab-corpus
export POOL_VIEJO=<POOL_VIEJO> POOL_NUEVO=<POOL_NUEVO>
export BUCKET_REC_VIEJO=signalab-recordings-<CUENTA_VIEJA>-us-west-1
export BUCKET_CONS_VIEJO=signalab-consent-<CUENTA_VIEJA>-us-west-1
export BUCKET_REC_NUEVO=signalab-recordings-<CUENTA_NUEVA>-<REGION_NUEVA>
export BUCKET_CONS_NUEVO=signalab-consent-<CUENTA_NUEVA>-<REGION_NUEVA>
```

## 3. Pasos

### Paso 1. Inventario de la cuenta vieja

```bash
node scripts/migracion/remap.mjs inventario
```

**V:** `inventario-viejo.json` con usuarios, ítems por `entity` y objetos y
bytes por bucket. Es la referencia de todo lo demás.

### Paso 2. Bootstrap y stack de datos en la cuenta nueva

Sin `AMPLIFY_GITHUB_TOKEN` en el shell, el stack crea solo pool, tabla,
buckets y policy (los recursos de Amplify están condicionados a esa
variable).

```bash
cd infra && rm -rf cdk.out && npm ci && npm run build
npx cdk bootstrap aws://<CUENTA_NUEVA>/<REGION_NUEVA> --profile signalab-nueva
env -u AMPLIFY_GITHUB_TOKEN npx cdk diff   -c prodOrigin=https://signalab.other-ai.com --profile signalab-nueva
env -u AMPLIFY_GITHUB_TOKEN npx cdk deploy -c prodOrigin=https://signalab.other-ai.com --profile signalab-nueva --outputs-file ~/signalab-migracion/nueva-outputs.json
```

**V:** `nueva-outputs.json` trae `UserPoolId` (prefijo `<REGION_NUEVA>_`),
`UserPoolClientId`, buckets y `CorpusTableName=signalab-corpus`;
`aws dynamodb describe-table --table-name signalab-corpus --profile signalab-nueva`
muestra `gsi1` ACTIVE; `describe-user-pool` muestra `UserPoolTier=ESSENTIALS`
y `AllowedFirstAuthFactors=[PASSWORD, EMAIL_OTP]`.

### Paso 3. Usuarios y mapa de ids

```bash
node scripts/migracion/remap.mjs exportar-usuarios   # pool viejo → usuarios-viejo.json
node scripts/migracion/remap.mjs crear-usuarios      # pool nuevo (AdminCreateUser, sin correo de invitación) → mapa-sub.json
```

Cada persona se crea con su correo verificado y una contraseña aleatoria
descartable (deja el estado `CONFIRMED`; la app entra por código por correo
y nunca usa contraseña). Es idempotente: si el usuario ya existe, toma su
`sub`.

**V:** `mapa-sub.json` tiene tantas entradas como usuarios con correo; no
hay `problemas-usuarios.txt`. Con un correo propio: `npm run dev` con los
`NEXT_PUBLIC_COGNITO_*` nuevos en `.env.local`, pedir código, entrar y
confirmar que el `sub` coincide con el del mapa.

### Paso 4. Ensayo de copia (sin congelar)

Correr los pasos 6 a 8 una vez contra la cuenta nueva para medir tiempos y
depurar. La corrida definitiva sobrescribe (Put por llave).

### Paso 5. Congelar escrituras en la cuenta vieja (empieza la ventana)

Sin código: en la cuenta vieja, cambiar la policy del rol de cómputo por
una de solo lectura (`s3:GetObject` en ambos buckets, `dynamodb:GetItem` y
`Query` en la tabla y `gsi1`):

```bash
aws iam create-policy --policy-name signalab-app-readonly-freeze --policy-document file://~/signalab-migracion/readonly-freeze.json --profile signalab-vieja-cutover
aws iam attach-role-policy --role-name signalab-amplify-compute --policy-arn arn:aws:iam::<CUENTA_VIEJA>:policy/signalab-app-readonly-freeze --profile signalab-vieja-cutover
aws iam detach-role-policy --role-name signalab-amplify-compute --policy-arn arn:aws:iam::<CUENTA_VIEJA>:policy/signalab-app-runtime --profile signalab-vieja-cutover
date -u   # anotar T0
```

Efecto en 1–5 min: leer y reproducir siguen; grabar, consentir y anotar
fallan (también `/api/me`, porque crea el perfil al entrar). Avisar en la
portada 48 h antes. Reversa: intercambiar las políticas de nuevo.

### Paso 6. Exportar la tabla

```bash
node scripts/migracion/remap.mjs exportar-tabla   # Scan consistente → tabla-vieja.json
```

Opcional, como respaldo inmutable: `aws dynamodb export-table-to-point-in-time`
a un bucket de respaldo.

**V:** los conteos por `entity` no son menores que los del inventario.

### Paso 7. Copiar S3 con el prefijo nuevo

```bash
node scripts/migracion/remap.mjs copiar-s3
```

Lee de la cuenta vieja y sube a la nueva en flujo (sin pasar por disco ni
políticas de bucket entre cuentas), conservando `ContentType`, y compara
tamaños. Solo copia las versiones actuales (los buckets son versionados;
el historial de sobrescrituras se queda en la cuenta vieja hasta el paso
13).

**V:** objetos y bytes por bucket iguales al inventario; sin
`huerfanos-s3-*.txt`.

### Paso 8. Reescribir y cargar la tabla

```bash
node scripts/migracion/remap.mjs remap-tabla    # tabla-nueva.json; aborta si hay sub sin mapa
node scripts/migracion/remap.mjs cargar-tabla   # BatchWrite en la cuenta nueva
node scripts/migracion/remap.mjs verificar      # conteos, videos y consentimientos existen, sin subs viejos
```

**V:** `verificar` termina con «todo coincide».

### Paso 9. App Amplify en la cuenta nueva, sin dominio todavía

```bash
cd infra && rm -rf cdk.out && npm run build
read -s AMPLIFY_GITHUB_TOKEN && export AMPLIFY_GITHUB_TOKEN
npx cdk diff   -c prodOrigin=https://signalab.other-ai.com -c skipDomain=true --profile signalab-nueva
npx cdk deploy -c prodOrigin=https://signalab.other-ai.com -c skipDomain=true --profile signalab-nueva --outputs-file ~/signalab-migracion/nueva-outputs.json
unset AMPLIFY_GITHUB_TOKEN && rm -rf cdk.out
aws amplify start-job --app-id <APP_ID_NUEVO> --branch-name main --job-type RELEASE --profile signalab-nueva
```

Para probar grabación desde la URL por defecto antes del cutover, añadir
ese origen al CORS con `-c extraOrigins=https://main.<APP_ID_NUEVO>.amplifyapp.com`
en el mismo deploy (se quita en el deploy final).

**V:** el build termina `SUCCEED`;
`curl https://main.<APP_ID_NUEVO>.amplifyapp.com/api/health` → `ok` y
`creds: default-chain`. Con la cuenta propia migrada: entra por código,
`/mis-grabaciones` lista lo mismo que producción y reproduce un video;
grabar un ítem de prueba lo deja en el bucket nuevo bajo `<sub_nuevo>/`.

### Paso 10. Liberar el dominio en la cuenta vieja

Bajar antes el TTL del CNAME `signalab` en Cloudflare a 60 s. Guardar el
valor actual (`<hash_viejo>.cloudfront.net`) y el CNAME de validación viejo.

```bash
aws amplify get-domain-association --app-id <APP_ID_VIEJO> --domain-name signalab.other-ai.com --profile signalab-vieja-ro > ~/signalab-migracion/dominio-viejo.json
aws amplify delete-domain-association --app-id <APP_ID_VIEJO> --domain-name signalab.other-ai.com --profile signalab-vieja-cutover
```

Aquí empieza la indisponibilidad del dominio (el sitio viejo sigue en su
URL por defecto). CloudFront puede tardar hasta una hora en soltar el
alias.

### Paso 11. Asociar el dominio en la cuenta nueva

```bash
cd infra && npm run build && read -s AMPLIFY_GITHUB_TOKEN && export AMPLIFY_GITHUB_TOKEN
npx cdk deploy -c prodOrigin=https://signalab.other-ai.com --profile signalab-nueva
unset AMPLIFY_GITHUB_TOKEN && rm -rf cdk.out
aws amplify get-domain-association --app-id <APP_ID_NUEVO> --domain-name signalab.other-ai.com --profile signalab-nueva
```

En Cloudflare, zona `other-ai.com`, modo DNS only: crear el CNAME de
validación `_<hash>.signalab → _<hash>.acm-validations.aws.` (sustituye al
viejo) y esperar `domainStatus: AVAILABLE` (10–40 min).

### Paso 12. Cutover de DNS

CNAME `signalab → <hash_nuevo>.cloudfront.net`, DNS only, TTL 60 s.

**V:** `dig +short signalab.other-ai.com CNAME @1.1.1.1` devuelve el hash
nuevo; `curl -sI https://signalab.other-ai.com/` → 200;
`curl https://signalab.other-ai.com/api/health` → `ok`, `default-chain`.
Después: código por correo, grabar, anotar, consentimiento de una cuenta
nueva, y un push trivial a `main` dispara el build.

### Paso 13. Convivencia y apagado de la cuenta vieja

Mantener la cuenta vieja congelada al menos 14 días. Después: revocar el
PAT viejo y su webhook, `cdk destroy` en la cuenta vieja (pool, tabla y
buckets tienen RETAIN: vaciar versiones y borrarlos a mano), exportar la
tabla una última vez a un bucket de respaldo en la cuenta nueva, borrar el
usuario IAM `signalab-deploy` y el perfil local, y borrar
`~/signalab-migracion` de forma segura (`rm -P`).

## 4. Riesgos y reversa

| Riesgo | Mitigación |
| --- | --- |
| Correo sin contraparte o repetido en el pool viejo | `crear-usuarios` lo reporta; `remap-tabla` aborta si queda un sub sin mapa |
| Alguien entra a la app nueva antes de cargar la tabla y se crea un perfil vacío | Cargar la tabla (paso 8) antes de abrir el dominio (12); Put sobrescribe |
| `cdk deploy` sin `AMPLIFY_GITHUB_TOKEN` sobre un stack con Amplify borra app, rama, dominio y rol | `cdk diff` siempre antes: debe decir 0 recursos a destruir |
| Amplify rechaza el PAT fino | Usar uno clásico (`repo` + `admin:repo_hook`) de caducidad corta |
| Límite de correos OTP del remitente por defecto de Cognito | No re-registrar a todo el mundo el mismo día; considerar SES |
| Región distinta a `us-west-1` | `SIGNALAB_AWS_REGION` la pone el stack; `/api/health` confirma |

Reversa: antes del paso 10 no hay nada que revertir. Entre el 10 y el 12,
volver a asociar el dominio en la app vieja (`create-domain-association`)
y levantar la congelación. Después del 12, las escrituras hechas en la
cuenta nueva no existen en la vieja: el mismo script sirve con el mapa
invertido, pero es mejor verificar (paso 12) antes de anunciar.
