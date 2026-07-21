"use client";
import {
  signIn,
  confirmSignIn,
  signUp,
  signOut as amplifySignOut,
  fetchAuthSession,
  getCurrentUser,
} from "aws-amplify/auth";
import "./amplify";

/**
 * Cognito's API requires a password at sign-up even for passwordless pools.
 * We register participants with a throwaway random secret that is never shown
 * or reused; authentication is done entirely via email OTP.
 */
function randomSecret(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += String.fromCharCode(b);
  const alnum = btoa(raw).replace(/[^a-zA-Z0-9]/g, "");
  return `Aa1!${alnum}${alnum}`.slice(0, 24);
}

/** Begin email-OTP sign-in, registering the participant on first use. */
export async function startEmailOtp(email: string): Promise<void> {
  try {
    await signUp({
      username: email,
      password: randomSecret(),
      options: { userAttributes: { email } },
    });
  } catch (err) {
    // Already-registered participants are expected here; rethrow anything else.
    const name = (err as { name?: string }).name;
    if (name !== "UsernameExistsException") throw err;
  }

  const doSignIn = () =>
    signIn({
      username: email,
      options: {
        authFlowType: "USER_AUTH",
        preferredChallenge: "EMAIL_OTP",
      },
    });

  try {
    await doSignIn();
  } catch (err) {
    // A leftover session ("There is already a signed in user") blocks signIn.
    // The participant explicitly asked to authenticate, so drop the old
    // session and retry once instead of dead-ending on the email form.
    const name = (err as { name?: string }).name;
    if (name !== "UserAlreadyAuthenticatedException") throw err;
    await amplifySignOut();
    await doSignIn();
  }
}

/** Complete sign-in with the emailed OTP code. */
export async function confirmEmailOtp(code: string): Promise<void> {
  await confirmSignIn({ challengeResponse: code });
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}

export async function currentUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user.userId;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await amplifySignOut();
}
