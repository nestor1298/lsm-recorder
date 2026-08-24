import "server-only";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "./clients";

// Presigned URLs are deliberately short-lived (<= 5 min).
const PUT_EXPIRY_SECONDS = 300;
const GET_EXPIRY_SECONDS = 300;

export const VIDEO_CONTENT_TYPE = "video/webm";

/**
 * Tipos de video aceptados para subir al corpus, con su extensión de objeto:
 * webm (grabación en el navegador) + mp4/mov (archivos subidos por la
 * persona participante). Cualquier otro tipo se rechaza en el presign.
 */
export const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/**
 * Presigned PUT. The client must send a `Content-Type` matching the
 * signature, so uploads with any other type are rejected by S3.
 */
export async function presignVideoPut(
  bucket: string,
  key: string,
  contentType: string = VIDEO_CONTENT_TYPE,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
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
