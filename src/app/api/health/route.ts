import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/lib/aws/clients";
import { awsEnv } from "@/lib/aws/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated health check. Exercises the runtime AWS credentials with a
 * read of a sentinel key (never written, so it always returns empty) and
 * reports only booleans + an error *name* — no data, no config values.
 * Lets us distinguish "app up but AWS creds broken" from "all good".
 */
export async function GET() {
  let dynamo = false;
  let error: string | undefined;
  try {
    await ddbDoc().send(
      new GetCommand({
        TableName: awsEnv.corpusTable(),
        Key: { pk: "HEALTH#sentinel", sk: "HEALTH" },
      }),
    );
    dynamo = true;
  } catch (e) {
    error = e instanceof Error ? e.name : "UnknownError";
  }

  // Which credential source is in play (booleans only, never values):
  // explicit SIGNALAB_-prefixed vars beat the Lambda-reserved AWS_* names.
  const creds = Boolean(
    process.env.SIGNALAB_AWS_ACCESS_KEY_ID?.trim() &&
      process.env.SIGNALAB_AWS_SECRET_ACCESS_KEY?.trim(),
  )
    ? "explicit"
    : process.env.AWS_ACCESS_KEY_ID
      ? "reserved-name"
      : "default-chain";

  return Response.json(
    { ok: dynamo, dynamo, creds, ...(error ? { error } : {}) },
    { status: dynamo ? 200 : 500 },
  );
}
