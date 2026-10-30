import "server-only";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "./clients";
import { awsEnv } from "./env";
import {
  partPk,
  PROFILE_SK,
  sessPk,
  sessSk,
  recSk,
  recGsi1Sk,
  DEFAULT_ACCESS_TIER,
  type AccessTier,
  type ConsentMode,
  type ParticipantItem,
  type SessionItem,
  type RecordingItem,
  type RecordingStatus,
  annotPk,
  annotSk,
  annotGsi1Sk,
  type AnnotationItem,
  type CorpusId,
  apodoPk,
  coberturaPk,
  coberturaSk,
  senantePk,
  senanteSk,
  type CoberturaItem,
  type SenanteItem,
  circuloPk,
  circuloSk,
  completasPk,
  completasSk,
  SEMANAS_PK,
  semanaSk,
  ESTADOS_PK,
  estadoSk,
  type CirculoItem,
  type CompletaItem,
  type EstadoComunidadItem,
  type SemanaComunidadItem,
} from "./keys";
import { normalizarApodo } from "@/lib/apodos";
import { semanaIso } from "@/lib/semana";
import { MANOS_POR_SENA } from "@/lib/nueve_manos";
import { esEstadoMx } from "@/lib/mapa_mx";

const now = (): string => new Date().toISOString();

function esCondicionFallida(err: unknown): boolean {
  return (err as { name?: string })?.name === "ConditionalCheckFailedException";
}

// ── Participant ─────────────────────────────────────────────────────────────

export async function getParticipant(
  userId: string,
): Promise<ParticipantItem | null> {
  const res = await ddbDoc().send(
    new GetCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
    }),
  );
  return (res.Item as ParticipantItem | undefined) ?? null;
}

/** Idempotent: create the profile if absent, never clobbering existing consent. */
export async function ensureParticipant(userId: string): Promise<void> {
  await ddbDoc().send(
    new UpdateCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      UpdateExpression:
        "SET entity = :entity, user_id = :uid, created_at = if_not_exists(created_at, :now), " +
        "consent_status = if_not_exists(consent_status, :none), " +
        "default_access_tier = if_not_exists(default_access_tier, :tier)",
      ExpressionAttributeValues: {
        ":entity": "participant",
        ":uid": userId,
        ":now": now(),
        ":none": "none",
        ":tier": DEFAULT_ACCESS_TIER,
      },
    }),
  );
}

export async function setConsent(
  userId: string,
  args: {
    videoKey?: string;
    mode: ConsentMode;
    defaultTier: AccessTier;
    /** nombre escrito al firmar y versión del acuerdo (camino del señante) */
    signedName?: string;
    agreementVersion?: string;
  },
): Promise<void> {
  const sets = [
    "consent_status = :granted",
    "consent_mode = :mode",
    "default_access_tier = :tier",
    "consent_signed_at = :now",
  ];
  const values: Record<string, unknown> = {
    ":granted": "granted",
    ":mode": args.mode,
    ":tier": args.defaultTier,
    ":now": now(),
  };
  if (args.videoKey) {
    sets.push("consent_video_key = :key");
    values[":key"] = args.videoKey;
  }
  if (args.signedName) {
    sets.push("consent_signed_name = :name");
    values[":name"] = args.signedName;
  }
  if (args.agreementVersion) {
    sets.push("consent_agreement_version = :ver");
    values[":ver"] = args.agreementVersion;
  }
  await ddbDoc().send(
    new UpdateCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeValues: values,
    }),
  );
}

// ── Apodo ───────────────────────────────────────────────────────────────────

/**
 * Reclama un apodo para la persona. Devuelve "ocupado" si otra persona lo
 * tiene. Si la persona ya tenía otro apodo, el anterior queda libre.
 */
export async function reclamarApodo(
  userId: string,
  apodo: string,
): Promise<"ok" | "ocupado"> {
  const norm = normalizarApodo(apodo);
  try {
    await ddbDoc().send(
      new PutCommand({
        TableName: awsEnv.corpusTable(),
        Item: {
          pk: apodoPk(norm),
          sk: apodoPk(norm),
          entity: "apodo",
          apodo_norm: norm,
          user_id: userId,
          libre: false,
        },
        ConditionExpression:
          "attribute_not_exists(pk) OR user_id = :uid OR libre = :t",
        ExpressionAttributeValues: { ":uid": userId, ":t": true },
      }),
    );
  } catch (err) {
    if (esCondicionFallida(err)) return "ocupado";
    throw err;
  }

  const participant = await getParticipant(userId);
  const anterior = participant?.apodo_norm;
  await ddbDoc().send(
    new UpdateCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      UpdateExpression: "SET apodo = :a, apodo_norm = :n",
      ExpressionAttributeValues: { ":a": apodo, ":n": norm },
    }),
  );
  // El apodo anterior NO se libera: queda reservado a quien lo usó, para
  // que nadie más aparezca con él. En los círculos de sus señas se cambia
  // por el nuevo.
  if (anterior && anterior !== norm) {
    const marcas = (await listSenante(userId)).filter((m) => m.activo);
    for (let i = 0; i < marcas.length; i += 10) {
      await Promise.all(
        marcas.slice(i, i + 10).map(async (m) => {
          try {
            await ddbDoc().send(
              new UpdateCommand({
                TableName: awsEnv.corpusTable(),
                Key: { pk: circuloPk(m.corpus, m.item_id), sk: circuloSk(userId) },
                UpdateExpression: "SET apodo = :a",
                ConditionExpression: "attribute_exists(pk)",
                ExpressionAttributeValues: { ":a": apodo },
              }),
            );
          } catch (err) {
            if (!esCondicionFallida(err)) throw err;
          }
        }),
      );
    }
  }
  return "ok";
}

// ── Nueve manos: contadores que se acumulan al escribir ─────────────────────

export interface VideoContado {
  videosTotal: number;
  apodo?: string;
  /** su lugar en el círculo de la seña; null si ya era una de sus manos */
  mano: number | null;
}

/**
 * Un video nuevo (no una repetición de la misma seña en la misma sesión):
 * suma al total de la persona y, si todavía no era una de las manos de la
 * seña, la suma al círculo (cobertura, miembro con su apodo y su lugar), a
 * los contadores de la semana y al mapa de su estado. La novena mano marca
 * la seña como completa en la semana.
 */
export async function contarVideoNuevo(
  userId: string,
  args: {
    corpus: CorpusId;
    itemId: string;
    recordedAt: string;
    /** Perfil sin contador (anterior al camino): videos activos previos a este. */
    baseSiFalta?: number;
  },
): Promise<VideoContado> {
  const tabla = awsEnv.corpusTable();
  const t = now();

  const res = await ddbDoc().send(
    new UpdateCommand({
      TableName: tabla,
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      // El contador nace con las grabaciones que ya había (baseSiFalta) y
      // sube una; si ya existe, if_not_exists devuelve el valor actual.
      UpdateExpression: "SET videos_total = if_not_exists(videos_total, :base) + :uno",
      ExpressionAttributeValues: {
        ":base": Math.max(0, Math.floor(args.baseSiFalta ?? 0)),
        ":uno": 1,
      },
      ReturnValues: "ALL_NEW",
    }),
  );
  const participante = res.Attributes as ParticipantItem | undefined;
  const videosTotal = Math.max(0, Number(participante?.videos_total ?? 0));
  const apodo = participante?.apodo;
  const region = participante?.metadata?.region_vive;
  const estado = esEstadoMx(region) ? region : undefined;

  let nuevaMano = false;
  try {
    await ddbDoc().send(
      new UpdateCommand({
        TableName: tabla,
        Key: { pk: senantePk(userId), sk: senanteSk(args.corpus, args.itemId) },
        UpdateExpression:
          "SET entity = :e, user_id = :uid, corpus = :c, item_id = :i, activo = :t, desde = if_not_exists(desde, :now)" +
          (estado ? ", estado = :es" : " REMOVE estado"),
        ConditionExpression: "attribute_not_exists(pk) OR activo = :f",
        ExpressionAttributeValues: {
          ":e": "senante",
          ":uid": userId,
          ":c": args.corpus,
          ":i": args.itemId,
          ":t": true,
          ":f": false,
          ":now": t,
          ...(estado ? { ":es": estado } : {}),
        },
      }),
    );
    nuevaMano = true;
  } catch (err) {
    if (!esCondicionFallida(err)) throw err;
  }
  if (!nuevaMano) return { videosTotal, apodo, mano: null };

  const cob = await ddbDoc().send(
    new UpdateCommand({
      TableName: tabla,
      Key: { pk: coberturaPk(args.corpus), sk: coberturaSk(args.itemId) },
      UpdateExpression: "SET entity = :e, corpus = :c, item_id = :i ADD senantes :uno",
      ExpressionAttributeValues: {
        ":e": "cobertura",
        ":c": args.corpus,
        ":i": args.itemId,
        ":uno": 1,
      },
      ReturnValues: "UPDATED_NEW",
    }),
  );
  const mano = Math.max(1, Number((cob.Attributes as { senantes?: number } | undefined)?.senantes ?? 1));
  const semana = semanaIso(new Date(args.recordedAt));
  const cierra = mano === MANOS_POR_SENA;

  await Promise.all([
    ddbDoc().send(
      new UpdateCommand({
        TableName: tabla,
        Key: { pk: senantePk(userId), sk: senanteSk(args.corpus, args.itemId) },
        UpdateExpression: "SET mano = :m",
        ExpressionAttributeValues: { ":m": mano },
      }),
    ),
    ddbDoc().send(
      new PutCommand({
        TableName: tabla,
        Item: {
          pk: circuloPk(args.corpus, args.itemId),
          sk: circuloSk(userId),
          entity: "circulo",
          corpus: args.corpus,
          item_id: args.itemId,
          user_id: userId,
          ...(apodo ? { apodo } : {}),
          mano,
          activo: true,
          desde: t,
        } satisfies CirculoItem,
      }),
    ),
    ddbDoc().send(
      new UpdateCommand({
        TableName: tabla,
        Key: { pk: SEMANAS_PK, sk: semanaSk(semana) },
        UpdateExpression:
          "SET entity = :e, semana = :s ADD manos :uno" + (cierra ? ", completas :uno" : ""),
        ExpressionAttributeValues: { ":e": "semana_comunidad", ":s": semana, ":uno": 1 },
      }),
    ),
    cierra
      ? ddbDoc().send(
          new PutCommand({
            TableName: tabla,
            Item: {
              pk: completasPk(semana),
              sk: completasSk(args.corpus, args.itemId),
              entity: "completa",
              semana,
              corpus: args.corpus,
              item_id: args.itemId,
              cerrada: t,
            } satisfies CompletaItem,
          }),
        )
      : Promise.resolve(),
    estado
      ? ddbDoc().send(
          new UpdateCommand({
            TableName: tabla,
            Key: { pk: ESTADOS_PK, sk: estadoSk(estado) },
            UpdateExpression: "SET entity = :e, estado = :es ADD manos :uno",
            ExpressionAttributeValues: { ":e": "estado_comunidad", ":es": estado, ":uno": 1 },
          }),
        )
      : Promise.resolve(),
  ]);

  return { videosTotal, apodo, mano };
}

/**
 * Un video retirado: baja el total y, si era el último video activo de la
 * persona en esa seña, la quita del círculo (cobertura, miembro, mapa).
 * Los contadores de la semana cuentan llegadas y no bajan.
 */
export async function descontarVideo(
  userId: string,
  rec: RecordingItem,
): Promise<{ videosTotal: number }> {
  const tabla = awsEnv.corpusTable();
  const corpus: CorpusId = rec.corpus ?? "lsm";
  const itemId = rec.item_id ?? String(rec.cm_id ?? "");

  const todas = await listParticipantRecordings(userId);
  const otraActiva = todas.some(
    (r) =>
      !r.withdrawn &&
      r.session_id !== rec.session_id &&
      (r.corpus ?? "lsm") === corpus &&
      (r.item_id ?? String(r.cm_id ?? "")) === itemId,
  );
  if (!otraActiva) {
    let marca: SenanteItem | undefined;
    try {
      const r = await ddbDoc().send(
        new UpdateCommand({
          TableName: tabla,
          Key: { pk: senantePk(userId), sk: senanteSk(corpus, itemId) },
          UpdateExpression: "SET activo = :f",
          ConditionExpression: "activo = :t",
          ExpressionAttributeValues: { ":f": false, ":t": true },
          ReturnValues: "ALL_OLD",
        }),
      );
      marca = r.Attributes as SenanteItem | undefined;
    } catch (err) {
      if (!esCondicionFallida(err)) throw err;
    }
    if (marca) {
      const opcional = async (cmd: UpdateCommand) => {
        try {
          await ddbDoc().send(cmd);
        } catch (err) {
          if (!esCondicionFallida(err)) throw err;
        }
      };
      await Promise.all([
        opcional(
          new UpdateCommand({
            TableName: tabla,
            Key: { pk: coberturaPk(corpus), sk: coberturaSk(itemId) },
            UpdateExpression: "ADD senantes :menos",
            ConditionExpression: "senantes >= :uno",
            ExpressionAttributeValues: { ":menos": -1, ":uno": 1 },
          }),
        ),
        opcional(
          new UpdateCommand({
            TableName: tabla,
            Key: { pk: circuloPk(corpus, itemId), sk: circuloSk(userId) },
            UpdateExpression: "SET activo = :f",
            ConditionExpression: "attribute_exists(pk)",
            ExpressionAttributeValues: { ":f": false },
          }),
        ),
        marca.estado
          ? opcional(
              new UpdateCommand({
                TableName: tabla,
                Key: { pk: ESTADOS_PK, sk: estadoSk(marca.estado) },
                UpdateExpression: "ADD manos :menos",
                ConditionExpression: "manos >= :uno",
                ExpressionAttributeValues: { ":menos": -1, ":uno": 1 },
              }),
            )
          : Promise.resolve(),
      ]);
    }
  }

  let videosTotal = 0;
  try {
    const res = await ddbDoc().send(
      new UpdateCommand({
        TableName: tabla,
        Key: { pk: partPk(userId), sk: PROFILE_SK },
        UpdateExpression: "ADD videos_total :menos",
        ConditionExpression: "videos_total >= :uno",
        ExpressionAttributeValues: { ":menos": -1, ":uno": 1 },
        ReturnValues: "ALL_NEW",
      }),
    );
    videosTotal = Math.max(
      0,
      Number((res.Attributes as ParticipantItem | undefined)?.videos_total ?? 0),
    );
  } catch (err) {
    if (!esCondicionFallida(err)) throw err;
  }
  return { videosTotal };
}

async function queryTodo<T>(args: {
  pk: string;
  index?: string;
  pkName?: string;
}): Promise<T[]> {
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddbDoc().send(
      new QueryCommand({
        TableName: awsEnv.corpusTable(),
        IndexName: args.index,
        KeyConditionExpression: `${args.pkName ?? "pk"} = :p`,
        ExpressionAttributeValues: { ":p": args.pk },
        ExclusiveStartKey,
      }),
    );
    items.push(...((res.Items as T[] | undefined) ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** Cuántas personas han grabado cada seña de un corpus. */
export async function listCobertura(corpus: CorpusId): Promise<CoberturaItem[]> {
  return queryTodo<CoberturaItem>({ pk: coberturaPk(corpus) });
}

/** Las señas en las que la persona ya cuenta como señante. */
export async function listSenante(userId: string): Promise<SenanteItem[]> {
  return queryTodo<SenanteItem>({ pk: senantePk(userId) });
}

/** Las manos (activas) del círculo de una seña. */
export async function listCirculo(corpus: CorpusId, itemId: string): Promise<CirculoItem[]> {
  return (await queryTodo<CirculoItem>({ pk: circuloPk(corpus, itemId) })).filter(
    (m) => m.activo,
  );
}

/** Señas cuyo círculo se cerró en una semana. */
export async function listCompletas(semana: string): Promise<CompletaItem[]> {
  return queryTodo<CompletaItem>({ pk: completasPk(semana) });
}

export async function getSemanaComunidad(semana: string): Promise<SemanaComunidadItem | null> {
  const r = await ddbDoc().send(
    new GetCommand({ TableName: awsEnv.corpusTable(), Key: { pk: SEMANAS_PK, sk: semanaSk(semana) } }),
  );
  return (r.Item as SemanaComunidadItem | undefined) ?? null;
}

/** Manos por estado (agregado). */
export async function listEstados(): Promise<EstadoComunidadItem[]> {
  return queryTodo<EstadoComunidadItem>({ pk: ESTADOS_PK });
}

export async function setDefaultTier(
  userId: string,
  tier: AccessTier,
): Promise<void> {
  await ddbDoc().send(
    new UpdateCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      UpdateExpression: "SET default_access_tier = :tier",
      ExpressionAttributeValues: { ":tier": tier },
    }),
  );
}

export async function setParticipantMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await ddbDoc().send(
    new UpdateCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      UpdateExpression: "SET metadata = :m",
      ExpressionAttributeValues: { ":m": metadata },
    }),
  );
}

export async function withdrawAllConsent(userId: string): Promise<void> {
  await ddbDoc().send(
    new UpdateCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      UpdateExpression: "SET consent_status = :withdrawn",
      ExpressionAttributeValues: { ":withdrawn": "withdrawn" },
    }),
  );
}

// ── Session ─────────────────────────────────────────────────────────────────

export async function putSession(
  userId: string,
  args: {
    corpus?: CorpusId;
    sessionId: string;
    name: string;
    deviceInfo?: Record<string, unknown>;
    sessionMetadata?: Record<string, unknown>;
  },
): Promise<SessionItem> {
  const item: SessionItem = {
    pk: partPk(userId),
    sk: sessSk(args.sessionId),
    entity: "session",
    session_id: args.sessionId,
    user_id: userId,
    name: args.name,
    task_type: args.corpus === "signaplay" ? "lexical" : "phonological",
    corpus: args.corpus ?? "lsm",
    created_at: now(),
    device_info: args.deviceInfo,
    session_metadata: args.sessionMetadata,
  };
  await ddbDoc().send(
    new PutCommand({ TableName: awsEnv.corpusTable(), Item: item }),
  );
  return item;
}

// ── Recording ───────────────────────────────────────────────────────────────

export async function putRecording(
  userId: string,
  args: {
    sessionId: string;
    itemId: string;
    corpus: CorpusId;
    cmId?: number;
    gloss?: string;
    s3Key: string;
    durationMs: number;
    status?: RecordingStatus;
    accessTier: AccessTier;
    notes?: string;
    // Re-recording a previously withdrawn sign must not silently un-withdraw it.
    withdrawn?: boolean;
  },
): Promise<RecordingItem> {
  const recordedAt = now();
  const item: RecordingItem = {
    pk: sessPk(args.sessionId),
    sk: recSk(args.itemId),
    entity: "recording",
    gsi1pk: partPk(userId),
    gsi1sk: recGsi1Sk(recordedAt),
    participant_id: userId,
    session_id: args.sessionId,
    item_id: args.itemId,
    corpus: args.corpus,
    cm_id: args.cmId,
    gloss: args.gloss,
    s3_key: args.s3Key,
    duration_ms: args.durationMs,
    recorded_at: recordedAt,
    status: args.status ?? "approved",
    access_tier: args.accessTier,
    withdrawn: args.withdrawn ?? false,
    notes: args.notes,
  };
  await ddbDoc().send(
    new PutCommand({
      TableName: awsEnv.corpusTable(),
      Item: item,
      // Mismo sessionId e ítem de otra persona: nunca se reemplaza su grabación.
      ConditionExpression: "attribute_not_exists(pk) OR participant_id = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    }),
  );
  return item;
}

export { esCondicionFallida };

/** Fetch one recording, scoped: returns null if it isn't the caller's. */
export async function getOwnedRecording(
  userId: string,
  sessionId: string,
  itemId: string,
): Promise<RecordingItem | null> {
  const res = await ddbDoc().send(
    new GetCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: sessPk(sessionId), sk: recSk(itemId) },
    }),
  );
  const item = res.Item as RecordingItem | undefined;
  if (!item || item.participant_id !== userId) return null;
  return item;
}

/** All of a participant's recordings across sessions, via gsi1. */
export async function listParticipantRecordings(
  userId: string,
): Promise<RecordingItem[]> {
  const res = await ddbDoc().send(
    new QueryCommand({
      TableName: awsEnv.corpusTable(),
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :p AND begins_with(gsi1sk, :rec)",
      ExpressionAttributeValues: { ":p": partPk(userId), ":rec": "REC#" },
      ScanIndexForward: false,
    }),
  );
  return (res.Items as RecordingItem[] | undefined) ?? [];
}

export async function setRecordingTier(
  userId: string,
  sessionId: string,
  itemId: string,
  tier: AccessTier,
): Promise<boolean> {
  try {
    await ddbDoc().send(
      new UpdateCommand({
        TableName: awsEnv.corpusTable(),
        Key: { pk: sessPk(sessionId), sk: recSk(itemId) },
        UpdateExpression: "SET access_tier = :tier",
        ConditionExpression: "participant_id = :uid",
        ExpressionAttributeValues: { ":tier": tier, ":uid": userId },
      }),
    );
    return true;
  } catch {
    return false; // condition failed => not the caller's recording
  }
}

export async function withdrawRecording(
  userId: string,
  sessionId: string,
  itemId: string,
): Promise<boolean> {
  try {
    await ddbDoc().send(
      new UpdateCommand({
        TableName: awsEnv.corpusTable(),
        Key: { pk: sessPk(sessionId), sk: recSk(itemId) },
        UpdateExpression: "SET withdrawn = :t",
        ConditionExpression: "participant_id = :uid",
        ExpressionAttributeValues: { ":t": true, ":uid": userId },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Retira solo si estaba activa: devuelve true únicamente a la llamada que
 * la cambió. Dos retiros simultáneos (doble clic) descuentan una sola vez.
 */
export async function retirarSiActiva(
  userId: string,
  sessionId: string,
  itemId: string,
): Promise<boolean> {
  try {
    await ddbDoc().send(
      new UpdateCommand({
        TableName: awsEnv.corpusTable(),
        Key: { pk: sessPk(sessionId), sk: recSk(itemId) },
        UpdateExpression: "SET withdrawn = :t",
        ConditionExpression:
          "participant_id = :uid AND (attribute_not_exists(withdrawn) OR withdrawn = :f)",
        ExpressionAttributeValues: { ":t": true, ":f": false, ":uid": userId },
      }),
    );
    return true;
  } catch (err) {
    if (esCondicionFallida(err)) return false;
    throw err;
  }
}

// ── Anotaciones ─────────────────────────────────────────────────────────────

/**
 * Crea o actualiza una anotación. La condición impide sobrescribir la
 * anotación de otra persona aunque coincida el id (los ids los genera el
 * cliente con crypto.randomUUID).
 */
export async function putAnnotation(
  userId: string,
  ann: {
    id: string;
    gloss: string;
    cm_id: number;
    status: string;
    created_at: string;
    updated_at: string;
    recording_id?: string;
    schema_version: string;
    segment_count: number;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const item: AnnotationItem = {
    pk: annotPk(ann.id),
    sk: annotSk(ann.id),
    entity: "annotation",
    gsi1pk: partPk(userId),
    gsi1sk: annotGsi1Sk(ann.updated_at),
    annotation_id: ann.id,
    annotator_id: userId,
    gloss: ann.gloss,
    cm_id: ann.cm_id,
    status: ann.status,
    ...(ann.recording_id ? { recording_id: ann.recording_id } : {}),
    schema_version: ann.schema_version,
    segment_count: ann.segment_count,
    created_at: ann.created_at,
    updated_at: ann.updated_at,
    payload: ann.payload,
    deleted: false,
  };
  await ddbDoc().send(
    new PutCommand({
      TableName: awsEnv.corpusTable(),
      Item: item,
      ConditionExpression:
        "attribute_not_exists(pk) OR annotator_id = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    }),
  );
}

/** Lee una anotación propia (null si no existe o es de alguien más). */
export async function getOwnedAnnotation(
  userId: string,
  annotationId: string,
): Promise<AnnotationItem | null> {
  const res = await ddbDoc().send(
    new GetCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: annotPk(annotationId), sk: annotSk(annotationId) },
    }),
  );
  const item = res.Item as AnnotationItem | undefined;
  if (!item || item.annotator_id !== userId) return null;
  return item;
}

/** Todas las anotaciones de quien llama, vía gsi1. */
export async function listParticipantAnnotations(
  userId: string,
): Promise<AnnotationItem[]> {
  const res = await ddbDoc().send(
    new QueryCommand({
      TableName: awsEnv.corpusTable(),
      IndexName: "gsi1",
      KeyConditionExpression:
        "gsi1pk = :pk AND begins_with(gsi1sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": partPk(userId),
        ":prefix": "ANNOT#",
      },
    }),
  );
  return (res.Items ?? []) as AnnotationItem[];
}

/**
 * Borrado suave. El runtime no tiene permiso de DeleteItem (y en un
 * corpus conviene poder auditar qué se retiró).
 */
export async function softDeleteAnnotation(
  userId: string,
  annotationId: string,
): Promise<boolean> {
  try {
    await ddbDoc().send(
      new UpdateCommand({
        TableName: awsEnv.corpusTable(),
        Key: { pk: annotPk(annotationId), sk: annotSk(annotationId) },
        UpdateExpression: "SET deleted = :t, updated_at = :now",
        ConditionExpression: "annotator_id = :uid",
        ExpressionAttributeValues: {
          ":t": true,
          ":uid": userId,
          ":now": new Date().toISOString(),
        },
      }),
    );
    return true;
  } catch {
    return false;
  }
}
