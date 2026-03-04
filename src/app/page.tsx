"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CM_INVENTORY, getCMsByTier } from "@/lib/data";
import { getSessions } from "@/lib/store";
import type { RecordingSession } from "@/lib/types";

export default function Dashboard() {
  const [sessions, setSessions] = useState<RecordingSession[]>([]);

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  const tierCounts = [1, 2, 3, 4].map(
    (t) => getCMsByTier(t as 1 | 2 | 3 | 4).length
  );

  const totalRecorded = sessions.reduce(
    (acc, s) => acc + s.signs.filter((sign) => sign.status !== "pending").length,
    0
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white">
        <h1 className="text-3xl font-bold">LSM Recording Studio</h1>
        <p className="mt-2 text-lg text-indigo-100">
          Record Mexican Sign Language videos for the 101 Cruz Aldrete handshape
          configurations
        </p>
        <div className="mt-6 flex gap-4">
          <Link
            href="/record"
            className="rounded-lg bg-white px-6 py-3 font-semibold text-indigo-700 shadow transition-colors hover:bg-indigo-50"
          >
            Start Recording
          </Link>
          <Link
            href="/catalog"
            className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
          >
            Browse Catalog
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Handshapes"
          value={CM_INVENTORY.length}
          color="text-indigo-600"
        />
        <StatCard
          label="Signs Recorded"
          value={totalRecorded}
          color="text-green-600"
        />
        <StatCard
          label="Sessions"
          value={sessions.length}
          color="text-purple-600"
        />
        <StatCard
          label="Completion"
          value={`${CM_INVENTORY.length > 0 ? Math.round((totalRecorded / CM_INVENTORY.length) * 100) : 0}%`}
          color="text-amber-600"
        />
      </div>

      {/* Tier Breakdown */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Inventory by Frequency Tier
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { tier: 1, label: "High Frequency", color: "bg-green-500" },
            { tier: 2, label: "Medium Frequency", color: "bg-blue-500" },
            { tier: 3, label: "Low Frequency", color: "bg-yellow-500" },
            { tier: 4, label: "Rare", color: "bg-red-500" },
          ].map(({ tier, label, color }, i) => (
            <div
              key={tier}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${color}`} />
                <span className="text-sm font-medium text-gray-600">
                  Tier {tier}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {tierCounts[i]}
              </p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Recent Sessions
          </h2>
          <div className="space-y-3">
            {sessions.slice(-5).reverse().map((session) => {
              const recorded = session.signs.filter(
                (s) => s.status !== "pending"
              ).length;
              return (
                <Link
                  key={session.id}
                  href={`/record?session=${session.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {session.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(session.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-600">
                      {recorded}/{session.signs.length}
                    </p>
                    <p className="text-xs text-gray-500">recorded</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
