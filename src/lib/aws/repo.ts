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
    task_type: "phonological",
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
    cmId: number;
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
    sk: recSk(args.cmId),
    entity: "recording",
    gsi1pk: partPk(userId),
    gsi1sk: recGsi1Sk(recordedAt),
    participant_id: userId,
    session_id: args.sessionId,
    cm_id: args.cmId,
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
  cmId: number,
): Promise<RecordingItem | null> {
  const res = await ddbDoc().send(
    new GetCommand({
      TableName: awsEnv.corpusTable(),
      Key: { pk: sessPk(sessionId), sk: recSk(cmId) },
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
  cmId: number,
  tier: AccessTier,
): Promise<boolean> {
  try {
    await ddbDoc().send(
      new UpdateCommand({
        TableName: awsEnv.corpusTable(),
        Key: { pk: sessPk(sessionId), sk: recSk(cmId) },
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
  cmId: number,
): Promise<boolean> {
  try {
    await ddbDoc().send(
      new UpdateCommand({
        TableName: awsEnv.corpusTable(),
        Key: { pk: sessPk(sessionId), sk: recSk(cmId) },
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
