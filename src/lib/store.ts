import type { RecordingSession, RecordedSign } from "./types";

const SESSIONS_KEY = "lsm-recorder-sessions";

export function getSessions(): RecordingSession[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(SESSIONS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveSession(session: RecordingSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getSession(id: string): RecordingSession | null {
  return getSessions().find((s) => s.id === id) ?? null;
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function createSession(name: string, cmIds: number[]): RecordingSession {
  const session: RecordingSession = {
    id: crypto.randomUUID(),
    name,
    created_at: new Date().toISOString(),
    signs: cmIds.map((cm_id) => ({
      cm_id,
      recorded_at: "",
      duration_ms: 0,
      status: "pending" as const,
    })),
  };
  saveSession(session);
  return session;
}

export function updateSignRecording(
  sessionId: string,
  cmId: number,
  update: Partial<RecordedSign>
): void {
  const session = getSession(sessionId);
  if (!session) return;
  const sign = session.signs.find((s) => s.cm_id === cmId);
  if (sign) {
    Object.assign(sign, update);
    saveSession(session);
  }
}
