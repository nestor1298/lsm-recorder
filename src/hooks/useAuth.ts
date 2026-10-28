"use client";
import { useCallback, useEffect, useState } from "react";
import { currentUserId, EVENTO_AUTH } from "@/lib/auth-client";

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
    // Entrar o salir en otra parte de la página (el chip del encabezado,
    // por ejemplo) también actualiza a este hook.
    const alCambiar = () => void refresh();
    window.addEventListener(EVENTO_AUTH, alCambiar);
    return () => window.removeEventListener(EVENTO_AUTH, alCambiar);
  }, [refresh]);

  return { state, userId, refresh };
}
