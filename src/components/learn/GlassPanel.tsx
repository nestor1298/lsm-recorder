"use client";

import { useState } from "react";

interface GlassPanelProps {
  children: React.ReactNode;
  channelColor: string;
  channelLabel: string;
  channelName: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  className?: string;
}

export default function GlassPanel({
  children,
  channelColor,
  channelLabel,
  channelName,
  description,
  icon,
  isActive,
  className = "",
}: GlassPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  return (
    <div
      className={`
        rounded-2xl border border-white/20
        bg-white/75 backdrop-blur-xl
        shadow-2xl
        transition-all duration-500
        ${isActive ? "opacity-100 translate-y-0" : "opacity-50 translate-y-3"}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-2">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md"
          style={{ backgroundColor: channelColor }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider"
              style={{ backgroundColor: `${channelColor}15`, color: channelColor }}
            >
              {channelLabel}
            </span>
            <h3 className="text-base font-bold text-gray-900 truncate">{channelName}</h3>
          </div>
        </div>
      </div>

      {/* Description (collapsible) */}
      <div className="px-5 pb-2">
        <p
          className={`text-[11px] leading-relaxed text-gray-500 transition-all ${
            descExpanded ? "" : "line-clamp-2"
          }`}
        >
          {description}
        </p>
        <button
          onClick={() => setDescExpanded(!descExpanded)}
          className="mt-0.5 text-[10px] font-medium text-gray-400 hover:text-gray-600"
        >
          {descExpanded ? "Menos" : "Leer mas..."}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-gray-200/60" />

      {/* Controls */}
      <div className="p-5">{children}</div>
    </div>
  );
}
