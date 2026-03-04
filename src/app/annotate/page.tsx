"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CM_INVENTORY } from "@/lib/data";
import {
  getAnnotations,
  createAnnotation,
  saveAnnotation,
  deleteAnnotation,
  exportAnnotationAsLSMPN,
} from "@/lib/store";
import type { SignAnnotation, PSHRSegment, CMEntry } from "@/lib/types";
import HandVisualization from "@/components/HandVisualization";
import PSHRTimeline from "@/components/PSHRTimeline";
import AnnotationForm from "@/components/AnnotationForm";
import SignCard from "@/components/SignCard";

type View = "list" | "select_cm" | "annotate";

export default function AnnotatePage() {
  const [view, setView] = useState<View>("list");
  const [annotations, setAnnotations] = useState<SignAnnotation[]>([]);
  const [current, setCurrent] = useState<SignAnnotation | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setAnnotations(getAnnotations());
  }, []);

  const selectedCM = useMemo(
    () => (current ? CM_INVENTORY.find((cm) => cm.cm_id === current.cm_id) ?? null : null),
    [current]
  );

  const selectedSegment = useMemo(
    () => current?.segments.find((s) => s.id === selectedSegmentId) ?? null,
    [current, selectedSegmentId]
  );

  // Video time sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => setCurrentTimeMs(video.currentTime * 1000);
    video.addEventListener("timeupdate", handler);
    return () => video.removeEventListener("timeupdate", handler);
  }, [current]);

  const handleSeek = useCallback((ms: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = ms / 1000;
    }
    setCurrentTimeMs(ms);
  }, []);

  const handleSegmentAdd = useCallback(
    (segment: PSHRSegment) => {
      if (!current) return;
      const updated = {
        ...current,
        segments: [...current.segments, segment].sort((a, b) => a.start_ms - b.start_ms),
        updated_at: new Date().toISOString(),
      };
      setCurrent(updated);
      saveAnnotation(updated);
      setSelectedSegmentId(segment.id);
    },
    [current]
  );

  const handleSegmentUpdate = useCallback(
    (id: string, updates: Partial<PSHRSegment>) => {
      if (!current) return;
      const updated = {
        ...current,
        segments: current.segments.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        updated_at: new Date().toISOString(),
      };
      setCurrent(updated);
      saveAnnotation(updated);
    },
    [current]
  );

  const handleSegmentDelete = useCallback(
    (id: string) => {
      if (!current) return;
      const updated = {
        ...current,
        segments: current.segments.filter((s) => s.id !== id),
        updated_at: new Date().toISOString(),
      };
      setCurrent(updated);
      saveAnnotation(updated);
    },
    [current]
  );

  const handleCreateAnnotation = useCallback(
    (cm: CMEntry) => {
      const ann = createAnnotation(cm.cm_id, cm.example_sign);
      setCurrent(ann);
      setAnnotations(getAnnotations());
      setView("annotate");
    },
    []
  );

  const handleExportJSON = useCallback(() => {
    if (!current) return;
    const lsmPn = exportAnnotationAsLSMPN(current);
    const blob = new Blob([JSON.stringify(lsmPn, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${current.gloss.toLowerCase().replace(/\s+/g, "_")}_lsm_pn.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [current]);

  const filteredCMs = useMemo(() => {
    if (!searchQuery) return CM_INVENTORY;
    const q = searchQuery.toLowerCase();
    return CM_INVENTORY.filter(
      (cm) =>
        cm.example_sign.toLowerCase().includes(q) ||
        cm.cruz_aldrete_notation.toLowerCase().includes(q) ||
        (cm.alpha_code?.toLowerCase().includes(q) ?? false) ||
        cm.cm_id.toString() === q
    );
  }, [searchQuery]);

  // ── List View ─────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Annotations</h1>
            <p className="text-sm text-gray-500">
              LSM-PN phonological annotations with PSHR timeline
            </p>
          </div>
          <button
            onClick={() => setView("select_cm")}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            New Annotation
          </button>
        </div>

        {annotations.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <p className="text-lg font-medium text-gray-500">No annotations yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first LSM-PN annotation by selecting a handshape
            </p>
            <button
              onClick={() => setView("select_cm")}
              className="mt-4 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {annotations.map((ann) => {
              const cm = CM_INVENTORY.find((c) => c.cm_id === ann.cm_id);
              return (
                <div
                  key={ann.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300"
                >
                  <button
                    onClick={() => {
                      setCurrent(ann);
                      setView("annotate");
                    }}
                    className="flex items-center gap-4 text-left"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-sm font-bold text-indigo-700">
                      #{ann.cm_id}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{ann.gloss}</p>
                      <p className="text-xs text-gray-500">
                        {ann.segments.length} segments &middot;{" "}
                        <span
                          className={
                            ann.status === "complete"
                              ? "text-green-600"
                              : ann.status === "reviewed"
                                ? "text-blue-600"
                                : "text-gray-400"
                          }
                        >
                          {ann.status}
                        </span>{" "}
                        &middot; {new Date(ann.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      deleteAnnotation(ann.id);
                      setAnnotations(getAnnotations());
                    }}
                    className="rounded px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── CM Selection View ─────────────────────────────────────────
  if (view === "select_cm") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Select Handshape</h1>
          <button
            onClick={() => setView("list")}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by gloss, notation, or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCMs.map((cm) => (
            <SignCard
              key={cm.cm_id}
              cm={cm}
              compact
              onSelect={handleCreateAnnotation}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Annotation View ───────────────────────────────────────────
  if (!current || !selectedCM) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Annotation not found.</p>
        <button onClick={() => setView("list")} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
          Back
        </button>
      </div>
    );
  }

  const videoDuration = videoRef.current?.duration
    ? videoRef.current.duration * 1000
    : 5000; // Default 5s if no video

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setView("list");
              setAnnotations(getAnnotations());
            }}
            className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {current.gloss}{" "}
              <span className="text-sm font-normal text-gray-500">CM #{current.cm_id}</span>
            </h1>
            <p className="text-xs text-gray-500">
              {current.segments.length} segments &middot; {current.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportJSON}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Export LSM-PN
          </button>
          <button
            onClick={() => {
              const updated = { ...current, status: "complete" as const, updated_at: new Date().toISOString() };
              setCurrent(updated);
              saveAnnotation(updated);
            }}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Mark Complete
          </button>
        </div>
      </div>

      {/* Main layout: 2 columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Video + Timeline */}
        <div className="space-y-4 lg:col-span-2">
          {/* Video player */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
            {current.video_url ? (
              <video
                ref={videoRef}
                src={current.video_url}
                controls
                className="aspect-video w-full"
                style={{ transform: "scaleX(-1)" }}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-gray-900">
                <div className="text-center">
                  <p className="text-sm text-gray-400">No video attached</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Use the timeline below to define PSHR segments
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* PSHR Timeline */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              PSHR Timeline
            </h3>
            <PSHRTimeline
              segments={current.segments}
              durationMs={videoDuration}
              currentTimeMs={currentTimeMs}
              onSeek={handleSeek}
              onSegmentAdd={handleSegmentAdd}
              onSegmentUpdate={handleSegmentUpdate}
              onSegmentDelete={handleSegmentDelete}
              onSegmentSelect={setSelectedSegmentId}
              selectedSegmentId={selectedSegmentId}
            />
          </div>

          {/* Segment Annotation Form */}
          {selectedSegment && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Segment Annotation
              </h3>
              <AnnotationForm
                segment={selectedSegment}
                onUpdate={(updates) => handleSegmentUpdate(selectedSegment.id, updates)}
              />
            </div>
          )}
        </div>

        {/* Right: Hand viz + Global props */}
        <div className="space-y-4">
          {/* Hand Visualization */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Handshape (CM)
            </h3>
            <div className="flex justify-center">
              <HandVisualization cm={selectedCM} size={240} />
            </div>
          </div>

          {/* Global Properties */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Properties</h3>

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Dominant Hand
              </label>
              <div className="flex gap-2">
                {(["RIGHT", "LEFT"] as const).map((hand) => (
                  <button
                    key={hand}
                    onClick={() => {
                      const updated = { ...current, dominant_hand: hand, updated_at: new Date().toISOString() };
                      setCurrent(updated);
                      saveAnnotation(updated);
                    }}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                      current.dominant_hand === hand
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {hand}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={current.two_handed}
                onChange={(e) => {
                  const updated = { ...current, two_handed: e.target.checked, updated_at: new Date().toISOString() };
                  setCurrent(updated);
                  saveAnnotation(updated);
                }}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <span className="text-xs text-gray-700">Two-handed sign</span>
            </label>

            {current.two_handed && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={current.symmetrical}
                  onChange={(e) => {
                    const updated = { ...current, symmetrical: e.target.checked, updated_at: new Date().toISOString() };
                    setCurrent(updated);
                    saveAnnotation(updated);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <span className="text-xs text-gray-700">Symmetrical</span>
              </label>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Notes
              </label>
              <textarea
                value={current.notes}
                onChange={(e) => {
                  const updated = { ...current, notes: e.target.value, updated_at: new Date().toISOString() };
                  setCurrent(updated);
                  saveAnnotation(updated);
                }}
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                rows={3}
                placeholder="Additional notes about this sign..."
              />
            </div>
          </div>

          {/* Sign details */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <SignCard cm={selectedCM} />
          </div>
        </div>
      </div>
    </div>
  );
}
