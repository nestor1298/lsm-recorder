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

  return Response.json(
    { ok: dynamo, dynamo, ...(error ? { error } : {}) },
    { status: dynamo ? 200 : 500 },
  );
}
