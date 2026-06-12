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
    process.env.AWS_REGION ?? process.env.NEXT_PUBLIC_AWS_REGION ?? "us-east-1",
  corpusTable: (): string => required("SIGNALAB_CORPUS_TABLE"),
  recordingsBucket: (): string => required("SIGNALAB_RECORDINGS_BUCKET"),
  consentBucket: (): string => required("SIGNALAB_CONSENT_BUCKET"),
  userPoolId: (): string => required("NEXT_PUBLIC_COGNITO_USER_POOL_ID"),
  userPoolClientId: (): string =>
    required("NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID"),
};
