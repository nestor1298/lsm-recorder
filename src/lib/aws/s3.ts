import "server-only";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./clients";

// Presigned URLs are deliberately short-lived (<= 5 min).
const PUT_EXPIRY_SECONDS = 300;
const GET_EXPIRY_SECONDS = 300;

export const VIDEO_CONTENT_TYPE = "video/webm";

/**
 * Presigned PUT. The client must send `Content-Type: video/webm` to match the
 * signature, so non-webm uploads are rejected by S3.
 */
export async function presignVideoPut(
  bucket: string,
  key: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: VIDEO_CONTENT_TYPE,
  });
  return getSignedUrl(s3Client(), command, { expiresIn: PUT_EXPIRY_SECONDS });
}

/** Presigned GET for playback of an object the caller is authorized to read. */
export async function presignGet(
  bucket: string,
  key: string,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client(), command, { expiresIn: GET_EXPIRY_SECONDS });
}
