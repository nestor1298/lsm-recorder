"use client";

import { useMemo, useCallback } from "react";
import type { SignConstruction } from "@/lib/sign_types";

interface SignSummaryProps {
  sign: SignConstruction;
}

export default function SignSummary({ sign }: SignSummaryProps) {
  const summary = useMemo(() => {
    const lines: { label: string; detail: string; color: string }[] = [];

    let dCount = 0;
    let mCount = 0;

    for (const seg of sign.segments) {
      if (seg.type === "D") {
        dCount++;
        const parts: string[] = [];
        if (seg.cm) parts.push(`CM #${seg.cm.cm_id}`);
        if (seg.ub) parts.push(`UB=${seg.ub.code}`);
        parts.push(`OR(${seg.orientation.palm[0].toLowerCase()},${seg.orientation.fingers[0].toLowerCase()})`);
        if (seg.handMode === "both_symmetric") parts.push("2M");
        lines.push({
          label: `D\u2082${dCount}`,
          detail: parts.join(" \u00B7 "),
          color: "#4f46e5",
        });
      } else {
        mCount++;
        const parts: string[] = [];
        parts.push(seg.contour.toLowerCase());
        parts.push(seg.plane.toLowerCase());
        if (seg.local) parts.push(seg.local.toLowerCase());
        lines.push({
          label: `M\u2082${mCount}`,
          detail: parts.join(" \u00B7 "),
          color: "#0284c7",
        });
      }
    }

    return lines;
  }, [sign]);

  const rnmParts = useMemo(() => {
    const parts: string[] = [];
    if (sign.rnm.eyebrows !== "NEUTRAL")
      parts.push(`cejas=${sign.rnm.eyebrows.toLowerCase()}`);
    if (sign.rnm.mouth !== "NEUTRAL")
      parts.push(`boca=${sign.rnm.mouth.toLowerCase()}`);
    if (sign.rnm.head !== "NONE")
      parts.push(`cabeza=${sign.rnm.head.toLowerCase()}`);
    return parts;
  }, [sign.rnm]);

  // Hand mode from first hold
  const handModeSummary = useMemo(() => {
    const firstHold = sign.segments.find((s) => s.type === "D");
    if (!firstHold || firstHold.type !== "D") return "dominante";
    return firstHold.handMode === "both_symmetric" ? "ambas (sim.)" : "dominante";
  }, [sign]);

  const copyToClipboard = useCallback(() => {
    const text = summary.map((s) => `${s.label}: ${s.detail}`).join("\n")
      + (rnmParts.length > 0 ? `\nRNM: ${rnmParts.join(", ")}` : "")
      + `\nManos: ${handModeSummary}`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, [summary, rnmParts, handModeSummary]);

  return (
    <div className="rounded-xl border border-black/5 bg-gray-900/80 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Resumen Fonol&oacute;gico
        </span>
        <button
          onClick={copyToClipboard}
          className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:bg-white/20 hover:text-white"
          title="Copiar resumen"
        >
          Copiar
        </button>
      </div>

      {/* Segment lines */}
      <div className="mb-2 space-y-1">
        {summary.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-6 text-center text-[10px] font-bold"
              style={{ color: line.color }}
            >
              {line.label.replace(/\u2082(\d)/, (_, d) => {
                const subs = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
                return subs[parseInt(d)] || d;
              })}
            </span>
            <span className="text-[11px] text-gray-300">{line.detail}</span>
          </div>
        ))}
      </div>

      {/* RNM */}
      {rnmParts.length > 0 && (
        <div className="mb-2 rounded bg-rose-500/10 px-2 py-1">
          <span className="text-[10px] font-medium text-rose-300">
            RNM: {rnmParts.join(", ")}
          </span>
        </div>
      )}

      {/* Hand mode */}
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <span>Manos: {handModeSummary}</span>
        {sign.name && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-indigo-400">{sign.name}</span>
          </>
        )}
      </div>
    </div>
  );
}
