"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CM_INVENTORY, TIER_LABELS } from "@/lib/data";
import {
  createSession,
  getSession,
  getSessions,
  deleteSession,
  updateSignRecording,
} from "@/lib/store";
import type { CMEntry, RecordingSession } from "@/lib/types";
import SignPrompt from "@/components/SignPrompt";
import CameraRecorder from "@/components/CameraRecorder";

type View = "setup" | "recording" | "review";

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-500">Loading...</div>}>
      <RecordPageInner />
    </Suspense>
  );
}

function RecordPageInner() {
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("session");

  const [view, setView] = useState<View>(resumeId ? "recording" : "setup");
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [lastBlobUrl, setLastBlobUrl] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);

  // Setup form state
  const [sessionName, setSessionName] = useState("");
  const [selectedTier, setSelectedTier] = useState<number | null>(1);
  const [shuffled, setShuffled] = useState(false);

  // Load existing session if resuming
  useEffect(() => {
    if (resumeId) {
      const existing = getSession(resumeId);
      if (existing) {
        setSession(existing);
        const firstPending = existing.signs.findIndex(
          (s) => s.status === "pending"
        );
        setCurrentIndex(firstPending >= 0 ? firstPending : 0);
        setView("recording");
      }
    }
    setSessions(getSessions());
  }, [resumeId]);

  // Get CM entries for the session
  const sessionCMs = useMemo(() => {
    if (!session) return [];
    return session.signs
      .map((s) => CM_INVENTORY.find((cm) => cm.cm_id === s.cm_id))
      .filter(Boolean) as CMEntry[];
  }, [session]);

  const currentCM = sessionCMs[currentIndex] ?? null;

  // Create new session
  const handleCreateSession = useCallback(() => {
    let cmIds = CM_INVENTORY.map((cm) => cm.cm_id);
    if (selectedTier !== null) {
      cmIds = CM_INVENTORY.filter((cm) => cm.frequency_tier === selectedTier).map(
        (cm) => cm.cm_id
      );
    }
    if (shuffled) {
      cmIds = cmIds.sort(() => Math.random() - 0.5);
    }
    const name = sessionName.trim() || `Session ${new Date().toLocaleString()}`;
    const newSession = createSession(name, cmIds);
    setSession(newSession);
    setCurrentIndex(0);
    setView("recording");
    setSessions(getSessions());
  }, [sessionName, selectedTier, shuffled]);

  // Handle recording completion
  const handleRecordingComplete = useCallback(
    (blob: Blob, durationMs: number) => {
      if (!session || !currentCM) return;
      const url = URL.createObjectURL(blob);
      setLastBlob(blob);
      setLastBlobUrl(url);
      setView("review");
    },
    [session, currentCM]
  );

  // Accept recording
  const handleAccept = useCallback(() => {
    if (!session || !currentCM) return;
    updateSignRecording(session.id, currentCM.cm_id, {
      status: "recorded",
      recorded_at: new Date().toISOString(),
      duration_ms: lastBlob ? lastBlob.size : 0,
      video_blob_url: lastBlobUrl ?? undefined,
    });

    // Refresh session
    const updated = getSession(session.id);
    if (updated) setSession(updated);

    // Move to next
    if (currentIndex < sessionCMs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setLastBlob(null);
    setLastBlobUrl(null);
    setView("recording");
  }, [session, currentCM, currentIndex, sessionCMs.length, lastBlob, lastBlobUrl]);

  // Retry recording
  const handleRetry = useCallback(() => {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    setLastBlob(null);
    setLastBlobUrl(null);
    setView("recording");
  }, [lastBlobUrl]);

  // Skip sign
  const handleSkip = useCallback(() => {
    if (currentIndex < sessionCMs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, sessionCMs.length]);

  // Go back
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Delete a session
  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    setSessions(getSessions());
  }, []);

  // ── Setup View ────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Recording Session</h1>
          <p className="text-sm text-gray-500">
            Configure which signs to record and start capturing videos
          </p>
        </div>

        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
          {/* Session name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Session Name
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Tier 1 — First Pass"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Tier selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Frequency Tier
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTier(null)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selectedTier === null
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All 101 Signs
              </button>
              {[1, 2, 3, 4].map((tier) => {
                const count = CM_INVENTORY.filter(
                  (cm) => cm.frequency_tier === tier
                ).length;
                return (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      selectedTier === tier
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    T{tier}: {TIER_LABELS[tier]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shuffle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shuffled}
              onChange={(e) => setShuffled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Shuffle sign order</span>
          </label>

          {/* Start button */}
          <button
            onClick={handleCreateSession}
            className="w-full rounded-lg bg-indigo-600 py-3 text-lg font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Start Recording (
            {selectedTier
              ? CM_INVENTORY.filter((cm) => cm.frequency_tier === selectedTier)
                  .length
              : 101}{" "}
            signs)
          </button>
        </div>

        {/* Existing sessions */}
        {sessions.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-bold text-gray-900">
              Previous Sessions
            </h2>
            <div className="space-y-2">
              {sessions.map((s) => {
                const recorded = s.signs.filter(
                  (sign) => sign.status !== "pending"
                ).length;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <button
                      onClick={() => {
                        setSession(s);
                        const firstPending = s.signs.findIndex(
                          (sign) => sign.status === "pending"
                        );
                        setCurrentIndex(
                          firstPending >= 0 ? firstPending : 0
                        );
                        setView("recording");
                      }}
                      className="text-left"
                    >
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      <p className="text-sm text-gray-500">
                        {recorded}/{s.signs.length} recorded &middot;{" "}
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Review View ───────────────────────────────────────────────
  if (view === "review" && lastBlobUrl && currentCM) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Review Recording</h1>

        <SignPrompt
          cm={currentCM}
          index={currentIndex}
          total={sessionCMs.length}
        />

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
          <video
            src={lastBlobUrl}
            controls
            className="aspect-video w-full"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleAccept}
            className="flex-1 rounded-lg bg-green-600 py-3 text-lg font-semibold text-white transition-colors hover:bg-green-700"
          >
            Accept &amp; Next
          </button>
          <button
            onClick={handleRetry}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Recording View ────────────────────────────────────────────
  if (!currentCM || !session) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-gray-500">No signs to record.</p>
        <button
          onClick={() => setView("setup")}
          className="mt-4 rounded-lg bg-indigo-600 px-6 py-2 text-white"
        >
          Create New Session
        </button>
      </div>
    );
  }

  const recorded = session.signs.filter((s) => s.status !== "pending").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
          <p className="text-sm text-gray-500">
            {recorded}/{session.signs.length} recorded
          </p>
        </div>
        <button
          onClick={() => {
            setView("setup");
            setSession(null);
          }}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Back to Sessions
        </button>
      </div>

      {/* Sign prompt */}
      <SignPrompt
        cm={currentCM}
        index={currentIndex}
        total={sessionCMs.length}
      />

      {/* Camera */}
      <CameraRecorder onRecordingComplete={handleRecordingComplete} />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {sessionCMs.length}
        </span>
        <button
          onClick={handleSkip}
          disabled={currentIndex >= sessionCMs.length - 1}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Skip
        </button>
      </div>

      {/* Mini progress grid */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Session Progress
        </p>
        <div className="flex flex-wrap gap-1">
          {session.signs.map((sign, i) => (
            <button
              key={sign.cm_id}
              onClick={() => setCurrentIndex(i)}
              className={`h-6 w-6 rounded text-xs font-medium transition-colors ${
                i === currentIndex
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-300"
                  : sign.status === "recorded"
                    ? "bg-green-200 text-green-800"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
              title={`CM #${sign.cm_id}`}
            >
              {sign.cm_id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
