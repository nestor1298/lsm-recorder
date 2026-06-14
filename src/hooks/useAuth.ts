"use client";
import { useCallback, useEffect, useState } from "react";
import { currentUserId } from "@/lib/auth-client";

export type AuthState = "loading" | "signedIn" | "signedOut";

export function useAuth() {
  const [state, setState] = useState<AuthState>("loading");
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const id = await currentUserId();
    setUserId(id);
    setState(id ? "signedIn" : "signedOut");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, userId, refresh };
}
