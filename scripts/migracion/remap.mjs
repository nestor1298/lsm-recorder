#!/usr/bin/env node
// Migración de SignaLab a otra cuenta AWS: usuarios, tabla y S3 con remapeo
// del id de usuario (sub de Cognito). Cada subcomando escribe su archivo en
// $DIR (fuera del repo, chmod 700) y falla ruidosamente. Ver
// docs/migracion-cuenta-aws.md para el orden y las verificaciones.
//
//   node scripts/migracion/remap.mjs inventario
//   node scripts/migracion/remap.mjs exportar-usuarios
//   node scripts/migracion/remap.mjs crear-usuarios
//   node scripts/migracion/remap.mjs exportar-tabla
//   node scripts/migracion/remap.mjs remap-tabla
//   node scripts/migracion/remap.mjs copiar-s3 [--desde 2026-10-01T00:00:00Z]
//   node scripts/migracion/remap.mjs cargar-tabla
//   node scripts/migracion/remap.mjs verificar
//
// Variables: PERFIL_VIEJO, PERFIL_NUEVO, REGION_VIEJA, REGION_NUEVA, POOL_VIEJO,
// POOL_NUEVO, TABLA (signalab-corpus), BUCKET_REC_VIEJO, BUCKET_REC_NUEVO,
// BUCKET_CONS_VIEJO, BUCKET_CONS_NUEVO, DIR (~/signalab-migracion).
// El mapa sub↔correo es dato personal: se borra al cerrar la migración.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fromIni } from "@aws-sdk/credential-providers";
import {
  CognitoIdentityProviderClient,
  paginateListUsers,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  DescribeUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  paginateScan,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  paginateListObjectsV2,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  construirMapa,
  contarPorEntity,
  remapItem,
  remapLlave,
  subsViejosPresentes,
} from "./remap_items.mjs";

// ── Configuración ───────────────────────────────────────────────────────────

const env = (k, def) => {
  const v = process.env[k] ?? def;
  if (v === undefined) throw new Error(`Falta la variable ${k}`);
  return v;
};
const DIR = env("DIR", path.join(os.homedir(), "signalab-migracion"));
const TABLA = env("TABLA", "signalab-corpus");
const archivo = (n) => path.join(DIR, n);
const escribir = (n, data) => {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(archivo(n), typeof data === "string" ? data : JSON.stringify(data, null, 2), { mode: 0o600 });
  console.log(`  → ${archivo(n)}`);
};
const leer = (n) => JSON.parse(fs.readFileSync(archivo(n), "utf8"));

const viejo = () => ({ region: env("REGION_VIEJA", "us-west-1"), credentials: fromIni({ profile: env("PERFIL_VIEJO", "signalab-vieja-ro") }) });
const nuevo = () => ({ region: env("REGION_NUEVA"), credentials: fromIni({ profile: env("PERFIL_NUEVO", "signalab-nueva") }) });
const doc = (cfg) => DynamoDBDocumentClient.from(new DynamoDBClient(cfg), { marshallOptions: { removeUndefinedValues: true } });

// ── Subcomandos ─────────────────────────────────────────────────────────────

async function inventario() {
  console.log("Inventario de la cuenta vieja");
  const cog = new CognitoIdentityProviderClient(viejo());
  const pool = await cog.send(new DescribeUserPoolCommand({ UserPoolId: env("POOL_VIEJO") }));
  const ddb = new DynamoDBClient(viejo());
  const tabla = await ddb.send(new DescribeTableCommand({ TableName: TABLA }));
  const items = await scanTodo(doc(viejo()));
  const s3 = new S3Client(viejo());
  const buckets = {};
  for (const b of [env("BUCKET_REC_VIEJO"), env("BUCKET_CONS_VIEJO")]) {
    let objetos = 0, bytes = 0;
    for await (const page of paginateListObjectsV2({ client: s3 }, { Bucket: b })) {
      for (const o of page.Contents ?? []) { objetos++; bytes += o.Size ?? 0; }
    }
    buckets[b] = { objetos, bytes };
  }
  const inv = {
    tomado: new Date().toISOString(),
    usuariosEstimados: pool.UserPool?.EstimatedNumberOfUsers,
    tabla: { itemCount: tabla.Table?.ItemCount, porEntity: contarPorEntity(items), total: items.length },
    buckets,
  };
  console.log(JSON.stringify(inv, null, 2));
  escribir("inventario-viejo.json", inv);
}

async function exportarUsuarios() {
  console.log("Exportando usuarios del pool viejo (sub, correo, estado)");
  const cog = new CognitoIdentityProviderClient(viejo());
  const out = [];
  for await (const page of paginateListUsers({ client: cog }, { UserPoolId: env("POOL_VIEJO") })) {
    for (const u of page.Users ?? []) {
      const a = Object.fromEntries((u.Attributes ?? []).map((x) => [x.Name, x.Value]));
      out.push({ sub: a.sub, email: (a.email ?? "").trim().toLowerCase(), status: u.UserStatus, creado: u.UserCreateDate });
    }
  }
  const sinCorreo = out.filter((u) => !u.email).length;
  console.log(`  ${out.length} usuarios, ${sinCorreo} sin correo, estados:`, contar(out.map((u) => u.status)));
  escribir("usuarios-viejo.json", out);
}

async function crearUsuarios() {
  console.log("Creando usuarios en el pool nuevo y construyendo el mapa de ids");
  const cog = new CognitoIdentityProviderClient(nuevo());
  const viejos = leer("usuarios-viejo.json");
  const subNuevoPorCorreo = {};
  for (const u of viejos) {
    if (!u.email) continue;
    let sub;
    try {
      const r = await cog.send(new AdminCreateUserCommand({
        UserPoolId: env("POOL_NUEVO"),
        Username: u.email,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: u.email },
          { Name: "email_verified", Value: "true" },
        ],
      }));
      sub = r.User?.Attributes?.find((a) => a.Name === "sub")?.Value;
      // Contraseña aleatoria descartable, solo para dejar al usuario CONFIRMED:
      // la app entra por código por correo y nunca la usa.
      await cog.send(new AdminSetUserPasswordCommand({
        UserPoolId: env("POOL_NUEVO"),
        Username: u.email,
        Password: randomBytes(24).toString("base64url") + "Aa1!",
        Permanent: true,
      }));
      console.log(`  creado ${u.email}`);
    } catch (e) {
      if (e?.name !== "UsernameExistsException") throw e;
      const g = await cog.send(new AdminGetUserCommand({ UserPoolId: env("POOL_NUEVO"), Username: u.email }));
      sub = g.UserAttributes?.find((a) => a.Name === "sub")?.Value;
      console.log(`  ya existía ${u.email}`);
    }
    if (!sub) throw new Error(`sin sub para ${u.email}`);
    subNuevoPorCorreo[u.email] = sub;
  }
  const { mapa, problemas } = construirMapa(viejos, subNuevoPorCorreo);
  if (problemas.length) {
    escribir("problemas-usuarios.txt", problemas.join("\n"));
    console.error(`  ${problemas.length} problemas (ver problemas-usuarios.txt); el mapa cubre ${Object.keys(mapa).length} de ${viejos.length}`);
    process.exitCode = 1;
  }
  escribir("mapa-sub.json", mapa);
  console.log(`  mapa con ${Object.keys(mapa).length} entradas`);
}

async function scanTodo(cliente) {
  const items = [];
  for await (const page of paginateScan({ client: cliente }, { TableName: TABLA, ConsistentRead: true })) {
    items.push(...(page.Items ?? []));
  }
  return items;
}

async function exportarTabla() {
  console.log("Exportando la tabla vieja (Scan consistente)");
  const items = await scanTodo(doc(viejo()));
  console.log(`  ${items.length} ítems`, contarPorEntity(items));
  escribir("tabla-vieja.json", items);
}

function remapTabla() {
  console.log("Reescribiendo ids en los ítems");
  const mapa = leer("mapa-sub.json");
  const viejos = leer("tabla-vieja.json");
  const huerfanos = new Set();
  const nuevos = viejos.map((it) => remapItem(it, mapa, huerfanos)).filter(Boolean);
  if (huerfanos.size) {
    escribir("huerfanos-tabla.txt", [...huerfanos].join("\n"));
    throw new Error(`${huerfanos.size} sub sin mapa (ver huerfanos-tabla.txt); no se escribe tabla-nueva.json`);
  }
  console.log(`  ${nuevos.length} ítems`, contarPorEntity(nuevos));
  escribir("tabla-nueva.json", nuevos);
}

async function cargarTabla() {
  console.log("Cargando la tabla nueva (BatchWrite, lotes de 25)");
  const d = doc(nuevo());
  const items = leer("tabla-nueva.json");
  let escritos = 0;
  for (let i = 0; i < items.length; i += 25) {
    let req = { [TABLA]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) };
    for (let intento = 0; Object.keys(req).length; intento++) {
      if (intento > 8) throw new Error("demasiados reintentos de BatchWrite");
      const r = await d.send(new BatchWriteCommand({ RequestItems: req }));
      req = r.UnprocessedItems && Object.keys(r.UnprocessedItems).length ? r.UnprocessedItems : {};
      if (Object.keys(req).length) await new Promise((res) => setTimeout(res, 100 * 2 ** intento));
    }
    escritos += Math.min(25, items.length - i);
  }
  console.log(`  ${escritos} ítems escritos`);
}

async function copiarBucket(bucketViejo, bucketNuevo, mapa, desde) {
  const sV = new S3Client(viejo());
  const sN = new S3Client(nuevo());
  const huerfanos = [];
  let n = 0, bytes = 0, saltados = 0;
  for await (const page of paginateListObjectsV2({ client: sV }, { Bucket: bucketViejo })) {
    for (const o of page.Contents ?? []) {
      if (desde && o.LastModified && o.LastModified <= desde) { saltados++; continue; }
      const h = new Set();
      const llaveNueva = remapLlave(o.Key, mapa, h);
      if (h.size) { huerfanos.push(o.Key); continue; }
      const src = await sV.send(new GetObjectCommand({ Bucket: bucketViejo, Key: o.Key }));
      await new Upload({
        client: sN,
        params: { Bucket: bucketNuevo, Key: llaveNueva, Body: src.Body, ContentType: src.ContentType, Metadata: src.Metadata },
      }).done();
      const head = await sN.send(new HeadObjectCommand({ Bucket: bucketNuevo, Key: llaveNueva }));
      if (head.ContentLength !== o.Size) throw new Error(`tamaño distinto en ${llaveNueva}: ${head.ContentLength} vs ${o.Size}`);
      n++; bytes += o.Size ?? 0;
      console.log(`  ${o.Key} → ${llaveNueva} (${o.Size} B)`);
    }
  }
  if (huerfanos.length) escribir(`huerfanos-s3-${bucketViejo}.txt`, huerfanos.join("\n"));
  console.log(`  ${bucketViejo} → ${bucketNuevo}: ${n} objetos, ${bytes} B, ${saltados} saltados, ${huerfanos.length} huérfanos`);
  return { n, bytes, huerfanos: huerfanos.length };
}

async function copiarS3(args) {
  const i = args.indexOf("--desde");
  const desde = i >= 0 ? new Date(args[i + 1]) : undefined;
  if (desde && Number.isNaN(desde.getTime())) throw new Error("--desde necesita una fecha ISO");
  console.log(`Copiando S3 con prefijo de usuario nuevo${desde ? ` (solo objetos después de ${desde.toISOString()})` : ""}`);
  const mapa = leer("mapa-sub.json");
  const r1 = await copiarBucket(env("BUCKET_REC_VIEJO"), env("BUCKET_REC_NUEVO"), mapa, desde);
  const r2 = await copiarBucket(env("BUCKET_CONS_VIEJO"), env("BUCKET_CONS_NUEVO"), mapa, desde);
  if (r1.huerfanos || r2.huerfanos) {
    console.error("  hay objetos con prefijo sin mapa; revisa huerfanos-s3-*.txt");
    process.exitCode = 1;
  }
}

async function verificar() {
  console.log("Verificación cruzada en la cuenta nueva");
  const mapa = leer("mapa-sub.json");
  const esperados = leer("tabla-nueva.json");
  const items = await scanTodo(doc(nuevo()));
  const fallas = [];
  const cEsp = contarPorEntity(esperados), cReal = contarPorEntity(items);
  for (const k of new Set([...Object.keys(cEsp), ...Object.keys(cReal)])) {
    if (cEsp[k] !== cReal[k]) fallas.push(`entity ${k}: esperados ${cEsp[k] ?? 0}, en tabla ${cReal[k] ?? 0}`);
  }
  const viejosPresentes = subsViejosPresentes(items, mapa);
  if (viejosPresentes.length) fallas.push(`${viejosPresentes.length} ítems aún con sub viejo en pk/gsi1pk`);
  const s3 = new S3Client(nuevo());
  const existe = async (bucket, key) => {
    try { await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return true; } catch { return false; }
  };
  let videos = 0;
  for (const it of items) {
    if (it.entity === "recording" && it.s3_key) {
      videos++;
      if (!(await existe(env("BUCKET_REC_NUEVO"), it.s3_key))) fallas.push(`falta el video ${it.s3_key}`);
    }
    if (it.entity === "participant" && it.consent_video_key) {
      if (!(await existe(env("BUCKET_CONS_NUEVO"), it.consent_video_key))) fallas.push(`falta el consentimiento ${it.consent_video_key}`);
    }
  }
  console.log(`  ${items.length} ítems`, cReal, `· ${videos} videos comprobados`);
  if (fallas.length) {
    console.error("  FALLAS:\n  - " + fallas.join("\n  - "));
    process.exitCode = 1;
  } else {
    console.log("  todo coincide");
  }
  escribir("verificacion.json", { tomado: new Date().toISOString(), porEntity: cReal, videos, fallas });
}

function contar(xs) {
  const c = {};
  for (const x of xs) c[x] = (c[x] ?? 0) + 1;
  return c;
}

// ── Entrada ─────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);
const comandos = {
  inventario,
  "exportar-usuarios": exportarUsuarios,
  "crear-usuarios": crearUsuarios,
  "exportar-tabla": exportarTabla,
  "remap-tabla": remapTabla,
  "copiar-s3": () => copiarS3(args),
  "cargar-tabla": cargarTabla,
  verificar,
};
if (!comandos[cmd]) {
  console.error(`Uso: node scripts/migracion/remap.mjs <${Object.keys(comandos).join("|")}>`);
  process.exit(2);
}
try {
  await comandos[cmd]();
} catch (e) {
  console.error("ERROR:", e?.message ?? e);
  process.exit(1);
}
