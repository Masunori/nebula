"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Navigation, Info, Eye } from "lucide-react";
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
      <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
        Select an activity from the data grid to inspect its 1D spatial footprint and buffer envelopes.
      </div>
    );
  }

  const maxCoord = footprint.max_coord || 19;
  const coords = Array.from({ length: maxCoord }, (_, i) => i + 1);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 space-y-4">
      {/* Header & Activity Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                1D Linear Spatial Footprint & Safety Buffer Envelope
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                {footprint.activity_id}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Discrete coordinate span ($1 \dots {maxCoord}$) with upstream, downstream, and opposing track buffers
            </p>
          </div>
        </div>

        {/* Quick Activity Dropdown Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Select Activity:</span>
          <select
            value={selectedActivityId}
            onChange={(e) => onSelectActivity(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Contract / Line</span>
          <span className="font-semibold text-white font-mono">
            {footprint.contract_number} ({footprint.line_code}) &middot; Track {footprint.bound}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Working Span</span>
          <span className="font-semibold text-cyan-400 font-mono">
            {footprint.station_from} → {footprint.station_to} (Coord {footprint.start_coord}..{footprint.end_coord})
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Safety Buffer Rule</span>
          <span className="font-semibold text-amber-400 font-mono">
            {footprint.buffer_sectors} sector(s) &middot; {footprint.nature_of_works}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <span className="text-[10px] text-slate-400 block uppercase font-medium">Opposite Bound Protection</span>
          <span className="font-semibold font-mono flex items-center gap-1">
            {footprint.requires_opposite_bound ? (
              <span className="text-rose-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Enforced (Live Track)
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Not Required
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 1D Visual Coordinate Track Bar */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-mono">Primary Track: {footprint.bound}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-cyan-500"></span> Working Span [{footprint.start_coord}..{footprint.end_coord}]
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-400"></span> Buffer Envelope [{footprint.buffer_start_coord}..{footprint.buffer_end_coord}]
            </span>
          </div>
        </div>

        {/* Primary Bound Bar */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 overflow-x-auto">
          {/* Coordinate Numbers */}
          <div className="grid grid-cols-19 gap-1 text-[10px] text-slate-500 font-mono text-center min-w-[600px]">
            {coords.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>

          {/* Coordinate Blocks */}
          <div className="grid grid-cols-19 gap-1 h-7 min-w-[600px]">
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
                  className={`rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                    isWork
                      ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                      : isBuffer
                      ? "bg-amber-500/30 border border-amber-400 text-amber-200"
                      : "bg-slate-800 text-slate-600"
                  }`}
                >
                  {isWork ? "WORK" : isBuffer ? "BUF" : "·"}
                </div>
              );
            })}
          </div>
        </div>

        {/* Opposing Bound Projection (If Live Track Work) */}
        {footprint.requires_opposite_bound && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] text-rose-400 font-mono">
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Opposite Track ({footprint.bound === "EB" ? "WB" : "EB"}) Live Safety Exclusion Zone
              </span>
              <span>Coordinates: [{footprint.buffer_start_coord}..{footprint.buffer_end_coord}]</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-rose-950/60 overflow-x-auto">
              <div className="grid grid-cols-19 gap-1 h-5 min-w-[600px]">
                {coords.map((c) => {
                  const isOppositeBlocked =
                    c >= footprint.buffer_start_coord && c <= footprint.buffer_end_coord;

                  return (
                    <div
                      key={c}
                      title={`Opposite Track Coord ${c}: ${isOppositeBlocked ? "Blocked by Live Track Buffer" : "Clear"}`}
                      className={`rounded flex items-center justify-center text-[9px] font-mono ${
                        isOppositeBlocked
                          ? "bg-rose-950/80 border border-rose-600 text-rose-300 font-bold"
                          : "bg-slate-900 text-slate-700"
                      }`}
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
