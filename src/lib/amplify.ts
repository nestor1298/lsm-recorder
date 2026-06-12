"use client";
import { Amplify } from "aws-amplify";

// Configure Amplify Auth once (idempotent). Cognito values are public
// (NEXT_PUBLIC_*) — the security boundary is the API layer, not these ids.
let configured = false;

export function configureAmplify(): void {
  if (configured) return;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
  if (!userPoolId || !userPoolClientId) return;

  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
        },
      },
    },
    { ssr: true },
  );
  configured = true;
}

// Run on module load so any client component importing auth has config ready.
configureAmplify();
