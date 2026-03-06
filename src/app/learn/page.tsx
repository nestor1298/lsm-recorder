"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ChannelCard from "@/components/learn/ChannelCard";
import CMExplorer from "@/components/learn/CMExplorer";
import UBExplorer from "@/components/learn/UBExplorer";
import ORExplorer from "@/components/learn/ORExplorer";
import MVExplorer from "@/components/learn/MVExplorer";
import RNMExplorer from "@/components/learn/RNMExplorer";

// Dynamic import for 3D component (no SSR)
const HandModelViewer = dynamic(() => import("@/components/HandModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-2xl bg-gradient-to-b from-indigo-950 to-slate-900">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        <p className="text-sm text-indigo-300">Loading 3D model...</p>
      </div>
    </div>
  ),
});

// Channel configuration
const CHANNELS = [
  {
    id: "cm",
    label: "CM",
    fullName: "Handshape",
    spanishName: "Configuraci\u00f3n Manual",
    color: "#4f46e5",
    description:
      "The handshape channel encodes which fingers are selected, their flexion level (extended, curved, bent, or closed), thumb position, finger spread, and inter-finger interactions. Cruz Aldrete (2008) documented 101 distinct handshape configurations in Mexican Sign Language, organized into 4 frequency tiers and 5 finger groups. Each handshape is given a unique numeric code (CM #1 \u2013 #101) and a descriptive phonological notation.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22V8M12 8l-3-6M12 8l3-6M7 16l-4-3M17 16l4-3" />
      </svg>
    ),
  },
  {
    id: "ub",
    label: "UB",
    fullName: "Location",
    spanishName: "Ubicaci\u00f3n",
    color: "#059669",
    description:
      "The location channel specifies where on or near the body a sign is articulated. The 80 documented locations span 8 body regions \u2014 head, face, neck, trunk, arm, forearm, hand, and neutral space. Each point is coded with a Latin-derived abbreviation (e.g., \u2018Fr\u2019 = frons/forehead, \u2018Pe\u2019 = pectus/chest). Modifiers like \u2018Ipsi\u2019 (same side as dominant hand) and \u2018X\u2019 (contralateral) add spatial precision.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="5" r="3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="9" y1="22" x2="12" y2="16" />
        <line x1="15" y1="22" x2="12" y2="16" />
      </svg>
    ),
  },
  {
    id: "or",
    label: "OR",
    fullName: "Orientation",
    spanishName: "Orientaci\u00f3n",
    color: "#7c3aed",
    description:
      "Orientation describes the spatial posture of the hand through two independent parameters: palm facing (the direction the palm surface points \u2014 up, down, forward, back, left, or right) and finger pointing (the direction the extended fingers aim). Together, they define 36 possible hand orientations in 3D space relative to the signer\u2019s body.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4M6.34 6.34l2.83 2.83m5.66 5.66l2.83 2.83M17.66 6.34l-2.83 2.83M8.17 14.83l-2.83 2.83" />
      </svg>
    ),
  },
  {
    id: "mv",
    label: "MV",
    fullName: "Movement",
    spanishName: "Movimiento",
    color: "#0284c7",
    description:
      "Movement is the dynamic channel that captures how the hand travels through signing space. It decomposes into three sub-parameters: contour (the geometric path \u2014 straight, arc, circle, zigzag, or seven-shape), local movements (internal motions like wiggling, twisting, or vibrating), and the movement plane (horizontal, vertical, sagittal, or oblique). Movement can also carry phonological diacritics for speed, repetition, and direction.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    id: "rnm",
    label: "RNM",
    fullName: "Non-Manual Markers",
    spanishName: "Rasgos No Manuales",
    color: "#e11d48",
    description:
      "Non-manual markers are the facial expressions, head movements, and body postures that function as grammatical morphemes in sign language. Raised eyebrows signal yes/no questions, furrowed eyebrows mark WH-questions, and head tilts add conditional or topicalized meaning. These markers operate simultaneously with manual signs and are essential for grammatical completeness. In LSM, a manual sign without its correct non-manual component can change meaning entirely.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="10" r="7" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="9" r="1" fill="currentColor" />
        <path d="M9 13q3 2 6 0" />
      </svg>
    ),
  },
];

export default function LearnPage() {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  const toggleChannel = (id: string) => {
    setActiveChannel(activeChannel === id ? null : id);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950">
        <div className="grid items-center lg:grid-cols-2">
          {/* Text */}
          <div className="relative z-10 p-8 lg:p-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-indigo-200">Interactive Reference</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Phonological<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Representation
              </span>
              <br />
              of LSM
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-indigo-200/80">
              An interactive guide to the 5-channel phonological notation system for
              Mexican Sign Language (LSM-PN), based on the foundational work of
              <b className="text-indigo-100"> Cruz Aldrete (2008)</b>.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChannel(ch.id);
                    document.getElementById(`channel-${ch.id}`)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold tracking-wider text-white/90 transition-all hover:scale-105 hover:text-white"
                  style={{ backgroundColor: `${ch.color}50`, border: `1px solid ${ch.color}80` }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3D Model */}
          <div className="relative">
            <HandModelViewer height="420px" autoRotate />
            {/* Decorative glow */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-indigo-950/80 lg:block hidden" />
          </div>
        </div>

        {/* Background decoration */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
      </section>

      {/* Overview section */}
      <section>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            The 5 Channels of LSM-PN
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500">
            Every sign in Mexican Sign Language can be decomposed into 5 simultaneous phonological
            channels. Together, they form a complete articulatory description that is both
            human-readable and machine-processable.
          </p>
        </div>

        {/* Channel diagram */}
        <div className="mx-auto mb-10 max-w-3xl">
          <div className="relative rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6">
            {/* Center label */}
            <div className="mb-6 text-center">
              <span className="rounded-full bg-gray-900 px-4 py-1.5 text-xs font-bold text-white">
                SIGN = CM + UB + OR + MV + RNM
              </span>
            </div>

            {/* Channel pills in a flow */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {CHANNELS.map((ch, i) => (
                <div key={ch.id} className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-2 rounded-xl px-4 py-3 shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: `${ch.color}10`, border: `2px solid ${ch.color}30` }}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: ch.color }}
                    >
                      <span className="text-xs font-bold">{ch.label}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{ch.fullName}</p>
                      <p className="text-[10px] italic text-gray-400">{ch.spanishName}</p>
                    </div>
                  </div>
                  {i < CHANNELS.length - 1 && (
                    <span className="text-lg font-light text-gray-300">+</span>
                  )}
                </div>
              ))}
            </div>

            {/* Temporal axis */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-300" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
                  simultaneous articulation on a temporal axis
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-300" />
              </div>
              <div className="mt-3 flex items-center gap-1">
                <div className="h-2 flex-1 rounded-l-full bg-blue-200" title="Preparation" />
                <div className="h-3 flex-[2] bg-indigo-400" title="Stroke" />
                <div className="h-2 flex-1 bg-violet-200" title="Hold" />
                <div className="h-2 flex-1 rounded-r-full bg-gray-200" title="Retraction" />
              </div>
              <div className="mt-1 flex text-[9px] text-gray-400">
                <span className="flex-1 text-center">P</span>
                <span className="flex-[2] text-center font-semibold text-indigo-600">Stroke</span>
                <span className="flex-1 text-center">H</span>
                <span className="flex-1 text-center">R</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Channel explorer cards */}
      <section>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Explore Each Channel
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Click on a channel to expand its interactive explorer
          </p>
        </div>

        <div className="space-y-4">
          {CHANNELS.map((ch) => (
            <div key={ch.id} id={`channel-${ch.id}`}>
              <ChannelCard
                id={ch.id}
                label={ch.label}
                fullName={ch.fullName}
                spanishName={ch.spanishName}
                description={ch.description}
                color={ch.color}
                icon={ch.icon}
                isActive={activeChannel === ch.id}
                onToggle={() => toggleChannel(ch.id)}
              >
                {ch.id === "cm" && <CMExplorer />}
                {ch.id === "ub" && <UBExplorer />}
                {ch.id === "or" && <ORExplorer />}
                {ch.id === "mv" && <MVExplorer />}
                {ch.id === "rnm" && <RNMExplorer />}
              </ChannelCard>
            </div>
          ))}
        </div>
      </section>

      {/* Reference section */}
      <section className="rounded-2xl bg-gradient-to-br from-gray-50 to-slate-50 p-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900">About This Notation</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Primary Source</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              Cruz Aldrete, M. (2008). <i>Gramática de la Lengua de Señas Mexicana</i>.
              Doctoral thesis, El Colegio de México. Chapter 4: Phonological representation
              of manual signs.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">LSM-PN Format</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              LSM-PN (LSM Phonological Notation) is a machine-readable extension of Cruz Aldrete&apos;s
              framework, designed for computational processing while maintaining linguistic precision.
              Each sign is a JSON object with typed fields for all 5 channels.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Coverage</h3>
            <div className="flex flex-wrap gap-3">
              {[
                { n: "101", label: "Handshapes" },
                { n: "80", label: "Body locations" },
                { n: "36", label: "Orientations" },
                { n: "5+11", label: "Movement types" },
                { n: "3", label: "NM channels" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <span className="text-lg font-bold text-indigo-600">{stat.n}</span>
                  <span className="ml-1.5 text-xs text-gray-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Project</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              SignaLab is building the first computational pipeline for LSM phonological analysis.
              This interactive reference helps researchers, educators, and the Deaf community
              understand the notation system used to document and animate Mexican Sign Language.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
