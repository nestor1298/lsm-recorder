import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { awsEnv } from "./env";

// Singletons reused across warm invocations.
let _s3: S3Client | null = null;
let _ddb: DynamoDBDocumentClient | null = null;

export function s3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({ region: awsEnv.region() });
  }
  return _s3;
}

export function ddbDoc(): DynamoDBDocumentClient {
  if (!_ddb) {
    const base = new DynamoDBClient({ region: awsEnv.region() });
    _ddb = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _ddb;
}
