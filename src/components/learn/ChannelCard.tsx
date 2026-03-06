"use client";

import { useState } from "react";

interface ChannelCardProps {
  id: string;
  label: string;
  fullName: string;
  spanishName: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  isActive: boolean;
  onToggle: () => void;
}

export default function ChannelCard({
  id,
  label,
  fullName,
  spanishName,
  description,
  color,
  icon,
  children,
  isActive,
  onToggle,
}: ChannelCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-500 ${
        isActive
          ? "border-transparent shadow-2xl"
          : "border-gray-200 hover:border-gray-300 hover:shadow-lg"
      }`}
      style={isActive ? { borderColor: color, boxShadow: `0 20px 60px ${color}20` } : {}}
    >
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors"
        style={isActive ? { backgroundColor: `${color}08` } : {}}
      >
        {/* Channel badge */}
        <div
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-transform group-hover:scale-105"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-xs font-bold tracking-wider"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {label}
            </span>
            <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            <span className="italic">{spanishName}</span>
          </p>
        </div>

        {/* Expand indicator */}
        <svg
          className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform duration-300 ${
            isActive ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Description */}
      <div
        className={`overflow-hidden transition-all duration-500 ${
          isActive ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t px-5 pb-6 pt-4" style={{ borderColor: `${color}20` }}>
          <p className="mb-5 text-sm leading-relaxed text-gray-600">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
