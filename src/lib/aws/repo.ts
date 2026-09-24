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
} from "./keys";

const now = (): string => new Date().toISOString();

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
  args: { videoKey?: string; mode: ConsentMode; defaultTier: AccessTier },
): Promise<void> {
  await ddbDoc().send(
    new UpdateCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: partPk(userId), sk: PROFILE_SK },
      UpdateExpression:
        "SET consent_status = :granted, consent_mode = :mode, default_access_tier = :tier" +
        (args.videoKey ? ", consent_video_key = :key" : ""),
      ExpressionAttributeValues: {
        ":granted": "granted",
        ":mode": args.mode,
        ":tier": args.defaultTier,
        ...(args.videoKey ? { ":key": args.videoKey } : {}),
      },
    }),
  );
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
    new PutCommand({ TableName: awsEnv.corpusTable(), Item: item }),
  );
  return item;
}

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
