import "server-only";

/**
 * Server-side environment access. Values are read lazily so a missing var only
 * fails the request that needs it (not the build). Never import this on the
 * client — the `server-only` guard will throw if you try.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const awsEnv = {
  region: (): string =>
    (
      process.env.SIGNALAB_AWS_REGION ??
      process.env.AWS_REGION ??
      process.env.NEXT_PUBLIC_AWS_REGION ??
      "us-east-1"
    ).trim(),
  /**
   * Explicit runtime credentials. Vercel functions run on AWS Lambda, where
   * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are runtime-owned names — custom
   * values under those names may be stripped or shadowed. We therefore read
   * SIGNALAB_-prefixed names first and hand them to the SDK explicitly.
   * `trim()` defends against pasted whitespace. Returns undefined when unset
   * (local dev then uses the default provider chain: profiles, SSO, etc.).
   */
  credentials: ():
    | { accessKeyId: string; secretAccessKey: string }
    | undefined => {
    const accessKeyId = (
      process.env.SIGNALAB_AWS_ACCESS_KEY_ID ??
      process.env.AWS_ACCESS_KEY_ID ??
      ""
    ).trim();
    const secretAccessKey = (
      process.env.SIGNALAB_AWS_SECRET_ACCESS_KEY ??
      process.env.AWS_SECRET_ACCESS_KEY ??
      ""
    ).trim();
    if (!accessKeyId || !secretAccessKey) return undefined;
    return { accessKeyId, secretAccessKey };
  },
  corpusTable: (): string => required("SIGNALAB_CORPUS_TABLE"),
  recordingsBucket: (): string => required("SIGNALAB_RECORDINGS_BUCKET"),
  consentBucket: (): string => required("SIGNALAB_CONSENT_BUCKET"),
  userPoolId: (): string => required("NEXT_PUBLIC_COGNITO_USER_POOL_ID"),
  userPoolClientId: (): string =>
    required("NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID"),
};
