"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Navigation } from "lucide-react";
import type { ActivityFootprint, Activity } from "@/lib/types";

interface ActivitySpatialFootprintProps {
  footprint: ActivityFootprint | null;
  activities: Activity[];
  selectedActivityId: string;
  onSelectActivity: (id: string) => void;
}

export function ActivitySpatialFootprint({
  footprint,
  activities,
  selectedActivityId,
  onSelectActivity,
}: ActivitySpatialFootprintProps) {
  if (!footprint) {
    return (
      <div
        className="p-8 rounded-2xl border text-center text-xs"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          color: "var(--ink-500)",
        }}
      >
        Select an activity from the data grid to inspect its 1D spatial footprint and buffer envelopes.
      </div>
    );
  }

  const maxCoord = footprint.max_coord || 19;
  const coords = Array.from({ length: maxCoord }, (_, i) => i + 1);

  return (
    <div
      className="rounded-2xl border transition-all"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-default)",
        boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
        padding: "24px 28px",
      }}
    >
      {/* Header & Activity Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: "var(--border-default)" }}>
        <div className="flex items-center gap-3">
          <div
            style={{
              padding: 10,
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--teal-050)",
              border: "1px solid var(--border-teal)",
              color: "var(--teal-700)",
            }}
          >
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold" style={{ color: "var(--ink-900)" }}>
                1D Linear Spatial Footprint & Safety Buffer Envelope
              </h3>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold"
                style={{
                  backgroundColor: "var(--teal-050)",
                  border: "1px solid var(--border-teal)",
                  color: "var(--teal-800)",
                }}
              >
                {footprint.activity_id}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
              Discrete coordinate span (1 &hellip; {maxCoord}) with upstream, downstream, and opposing track buffers
            </p>
          </div>
        </div>

        {/* Quick Activity Dropdown Switcher */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium" style={{ color: "var(--ink-600)" }}>
            Select Activity:
          </span>
          <select
            value={selectedActivityId}
            onChange={(e) => onSelectActivity(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg font-mono cursor-pointer transition-all"
            style={{
              backgroundColor: "var(--bg-page)",
              border: "1px solid var(--border-default)",
              color: "var(--ink-900)",
            }}
          >
            {activities.map((a) => (
              <option key={a.activity_id} value={a.activity_id}>
                {a.activity_id}: {a.contract_number} (P{a.priority}, {a.nature_of_works})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Activity Details Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 text-xs">
        <div
          className="p-3.5 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-page)",
            borderColor: "var(--border-default)",
          }}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: "var(--ink-500)" }}>
            Contract / Line
          </span>
          <span className="font-semibold font-mono mt-1 block" style={{ color: "var(--ink-900)" }}>
            {footprint.contract_number} ({footprint.line_code}) &middot; Track {footprint.bound}
          </span>
        </div>
        <div
          className="p-3.5 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-page)",
            borderColor: "var(--border-default)",
          }}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: "var(--ink-500)" }}>
            Working Span
          </span>
          <span className="font-semibold font-mono mt-1 block" style={{ color: "var(--teal-700)" }}>
            {footprint.station_from} → {footprint.station_to} (Coord {footprint.start_coord}..{footprint.end_coord})
          </span>
        </div>
        <div
          className="p-3.5 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-page)",
            borderColor: "var(--border-default)",
          }}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: "var(--ink-500)" }}>
            Safety Buffer Rule
          </span>
          <span className="font-semibold font-mono mt-1 block" style={{ color: "var(--orange-700)" }}>
            {footprint.buffer_sectors} sector(s) &middot; {footprint.nature_of_works}
          </span>
        </div>
        <div
          className="p-3.5 rounded-xl border"
          style={{
            backgroundColor: "var(--bg-page)",
            borderColor: "var(--border-default)",
          }}
        >
          <span className="text-[10px] uppercase font-bold tracking-wider block" style={{ color: "var(--ink-500)" }}>
            Opposite Bound Protection
          </span>
          <span className="font-semibold font-mono mt-1 flex items-center gap-1">
            {footprint.requires_opposite_bound ? (
              <span className="text-rose-700 flex items-center gap-1 font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Enforced (Live Track)
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Not Required
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 1D Visual Coordinate Track Bar */}
      <div className="space-y-4 pt-5">
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--ink-600)" }}>
          <span className="font-mono font-semibold">Primary Track: {footprint.bound}</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: "var(--teal-600)" }}></span>
              <span>Working Span [{footprint.start_coord}..{footprint.end_coord}]</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border" style={{ backgroundColor: "var(--status-amber-bg)", borderColor: "var(--status-amber-border)" }}></span>
              <span>Buffer Envelope [{footprint.buffer_start_coord}..{footprint.buffer_end_coord}]</span>
            </span>
          </div>
        </div>

        {/* Primary Bound Bar */}
        <div
          className="p-4 rounded-xl border space-y-2 overflow-x-auto"
          style={{
            backgroundColor: "var(--bg-page)",
            borderColor: "var(--border-default)",
          }}
        >
          {/* Coordinate Numbers */}
          <div className="grid grid-cols-19 gap-1 text-[11px] font-mono text-center min-w-[620px]" style={{ color: "var(--ink-500)" }}>
            {coords.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>

          {/* Coordinate Blocks */}
          <div className="grid grid-cols-19 gap-1 h-8 min-w-[620px]">
            {coords.map((c) => {
              const isWork = c >= footprint.start_coord && c <= footprint.end_coord;
              const isBuffer =
                !isWork &&
                c >= footprint.buffer_start_coord &&
                c <= footprint.buffer_end_coord;

              return (
                <div
                  key={c}
                  title={`Coordinate ${c}: ${isWork ? "Active Work Zone" : isBuffer ? "Safety Buffer Margin" : "Clear Track"}`}
                  className="rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all shadow-xs"
                  style={{
                    backgroundColor: isWork
                      ? "var(--teal-600)"
                      : isBuffer
                      ? "var(--status-amber-bg)"
                      : "var(--bg-muted)",
                    color: isWork
                      ? "#ffffff"
                      : isBuffer
                      ? "var(--orange-800)"
                      : "var(--ink-400)",
                    border: isBuffer ? "1px solid var(--status-amber-border)" : "1px solid transparent",
                  }}
                >
                  {isWork ? "WORK" : isBuffer ? "BUF" : "·"}
                </div>
              );
            })}
          </div>
        </div>

        {/* Opposing Bound Projection (If Live Track Work) */}
        {footprint.requires_opposite_bound && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold" style={{ color: "var(--status-red)" }}>
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Opposite Track ({footprint.bound === "EB" ? "WB" : "EB"}) Live Safety Exclusion Zone
              </span>
              <span>Coordinates: [{footprint.buffer_start_coord}..{footprint.buffer_end_coord}]</span>
            </div>

            <div
              className="p-3.5 rounded-xl border overflow-x-auto"
              style={{
                backgroundColor: "var(--status-red-bg)",
                borderColor: "var(--status-red-border)",
              }}
            >
              <div className="grid grid-cols-19 gap-1 h-6 min-w-[620px]">
                {coords.map((c) => {
                  const isOppositeBlocked =
                    c >= footprint.buffer_start_coord && c <= footprint.buffer_end_coord;

                  return (
                    <div
                      key={c}
                      title={`Opposite Track Coord ${c}: ${isOppositeBlocked ? "Blocked by Live Track Buffer" : "Clear"}`}
                      className="rounded flex items-center justify-center text-[10px] font-mono font-bold"
                      style={{
                        backgroundColor: isOppositeBlocked ? "var(--status-red)" : "transparent",
                        color: isOppositeBlocked ? "#ffffff" : "var(--ink-400)",
                      }}
                    >
                      {isOppositeBlocked ? "X" : "·"}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
