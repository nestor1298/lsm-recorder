import "server-only";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { awsEnv } from "./env";

/**
 * The API layer is the security boundary. Every route handler must call
 * `requireUser(req)` and scope all reads/writes to the returned `userId`.
 * Any DynamoDB query that is not scoped to this userId is a bug.
 */
export interface AuthedUser {
  userId: string;
}

export class AuthError extends Error {
  readonly status = 401;
  constructor(message = "No autorizado") {
    super(message);
    this.name = "AuthError";
  }
}

let _verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function verifier() {
  if (!_verifier) {
    _verifier = CognitoJwtVerifier.create({
      userPoolId: awsEnv.userPoolId(),
      tokenUse: "access",
      clientId: awsEnv.userPoolClientId(),
    });
  }
  return _verifier;
}

/** Verify the Cognito access token from the Authorization header. */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const header =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new AuthError("Falta el token de acceso");
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    // Access tokens carry `sub` (the stable user id) but not `email` — email
    // lives in the ID token. We intentionally do not collect email server-side
    // (PII minimization); Cognito holds it only for authentication.
    const payload = await verifier().verify(token);
    return { userId: payload.sub };
  } catch {
    throw new AuthError("Token inválido o expirado");
  }
}

/** Build a JSON Response for an AuthError (or rethrow unknown errors). */
export function authErrorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
