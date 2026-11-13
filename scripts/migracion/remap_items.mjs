// Lógica pura del remapeo de ids de usuario (sub de Cognito) en los ítems
// de la tabla `signalab-corpus` y en las llaves de S3. Sin AWS: se prueba
// con vitest y la usa remap.mjs.
//
// Dónde vive el sub (ver src/lib/aws/keys.ts):
//   participant: pk = PART#{sub}, user_id, consent_video_key = {sub}/consent.webm
//   session:     pk = PART#{sub}, user_id
//   recording:   gsi1pk = PART#{sub}, participant_id, s3_key = {sub}/{sessionId}/{itemId}.{ext}
//   annotation:  gsi1pk = PART#{sub}, annotator_id

export const PART = "PART#";

/** Reescribe el prefijo {sub}/… de una llave de S3. */
export function remapLlave(llave, mapa, huerfanos) {
  const i = llave.indexOf("/");
  const sub = i < 0 ? llave : llave.slice(0, i);
  const nuevo = mapa[sub];
  if (!nuevo) {
    huerfanos.add(sub);
    return llave;
  }
  return i < 0 ? nuevo : nuevo + llave.slice(i);
}

/**
 * Devuelve el ítem con el sub nuevo, `null` si no se migra (sentinel de
 * salud), y anota en `huerfanos` cada sub sin correspondencia (el ítem se
 * devuelve sin cambios en ese caso; quien llama decide abortar).
 */
export function remapItem(item, mapa, huerfanos) {
  const sub = (s) => {
    if (typeof s !== "string" || !s) return s;
    const n = mapa[s];
    if (!n) {
      huerfanos.add(s);
      return s;
    }
    return n;
  };
  const it = { ...item };
  switch (it.entity) {
    case "participant":
      it.user_id = sub(it.user_id);
      it.pk = PART + it.user_id;
      if (it.consent_video_key) it.consent_video_key = remapLlave(it.consent_video_key, mapa, huerfanos);
      return it;
    case "session":
      it.user_id = sub(it.user_id);
      it.pk = PART + it.user_id;
      return it;
    case "recording":
      it.participant_id = sub(it.participant_id);
      it.gsi1pk = PART + it.participant_id;
      it.s3_key = remapLlave(it.s3_key, mapa, huerfanos);
      return it;
    case "annotation":
      it.annotator_id = sub(it.annotator_id);
      it.gsi1pk = PART + it.annotator_id;
      return it;
    default:
      if (String(it.pk ?? "").startsWith("HEALTH#")) return null;
      throw new Error(`entity desconocida en ${it.pk}/${it.sk}: ${it.entity}`);
  }
}

export function contarPorEntity(items) {
  const c = {};
  for (const it of items) c[it.entity ?? "?"] = (c[it.entity ?? "?"] ?? 0) + 1;
  return c;
}

/** ¿Queda algún sub viejo en pk o gsi1pk? (verificación final) */
export function subsViejosPresentes(items, mapa) {
  const viejos = new Set(Object.keys(mapa).map((s) => PART + s));
  return items.filter((it) => viejos.has(it.pk) || viejos.has(it.gsi1pk));
}

/**
 * Cruza usuarios viejos (sub, email) con el sub nuevo por correo. Falla si
 * hay correos duplicados o sin contraparte.
 */
export function construirMapa(usuariosViejos, subNuevoPorCorreo) {
  const mapa = {};
  const vistos = new Map();
  const problemas = [];
  for (const u of usuariosViejos) {
    const correo = (u.email ?? "").trim().toLowerCase();
    if (!correo) {
      problemas.push(`sub ${u.sub} sin correo`);
      continue;
    }
    if (vistos.has(correo)) {
      problemas.push(`correo repetido en el pool viejo: ${correo} (${vistos.get(correo)} y ${u.sub})`);
      continue;
    }
    vistos.set(correo, u.sub);
    const nuevo = subNuevoPorCorreo[correo];
    if (!nuevo) {
      problemas.push(`sin usuario nuevo para ${correo}`);
      continue;
    }
    mapa[u.sub] = nuevo;
  }
  return { mapa, problemas };
}
