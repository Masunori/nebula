"use client";

import React, { useState, useMemo } from "react";
import { X, PlusCircle, Train, ShieldCheck, ShieldAlert, Sparkles, Navigation, Zap } from "lucide-react";
import type { Activity, Contract, Station, BufferRule, TrackBound } from "@/lib/types";
import { DESIGN_TOKENS } from "@/lib/design-tokens";

interface EntryCreationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddActivity: (activity: Activity) => void;
  contracts: Contract[];
  stations: Station[];
  bufferRules: BufferRule[];
  existingActivities: Activity[];
}

export function EntryCreationDrawer({
  isOpen,
  onClose,
  onAddActivity,
  contracts,
  stations,
  bufferRules,
  existingActivities,
}: EntryCreationDrawerProps) {
  // Form fields
  const [activityId, setActivityId] = useState(`A0${existingActivities.length + 1}`);
  const [contractNumber, setContractNumber] = useState(contracts[0]?.contract_number || "C001");
  const [lineCode, setLineCode] = useState<string>("ALP");
  const [trackBound, setTrackBound] = useState<TrackBound>("EB");
  const [stationFrom, setStationFrom] = useState<string>("S01");
  const [stationTo, setStationTo] = useState<string>("S02");
  const [activityType, setActivityType] = useState<string>("Maintenance");
  const [priority, setPriority] = useState<number>(1); // Default to P1 for urgent maintainer use case!
  const [natureOfWorks, setNatureOfWorks] = useState<string>("Live");
  const [totalAccesses, setTotalAccesses] = useState<number>(3);
  const [plannedStartDate, setPlannedStartDate] = useState<string>("2027-02-01");
  const [predecessorId, setPredecessorId] = useState<string>("");

  // Stations for selected line
  const lineStations = useMemo(() => {
    return stations
      .filter((s) => s.line_code === lineCode)
      .sort((a, b) => a.seq_order - b.seq_order);
  }, [stations, lineCode]);

  // Buffer info for selected nature
  const activeBufferRule = useMemo(() => {
    return (
      bufferRules.find((b) => b.nature_of_works.toLowerCase() === natureOfWorks.toLowerCase()) || {
        nature_of_works: natureOfWorks,
        buffer_sectors: 1,
        requires_opposite_bound: false,
      }
    );
  }, [bufferRules, natureOfWorks]);

  // Check if track reaches interchange H01 or H02
  const touchesInterchange = useMemo(() => {
    return (
      stationFrom.includes("H01") ||
      stationFrom.includes("H02") ||
      stationTo.includes("H01") ||
      stationTo.includes("H02")
    );
  }, [stationFrom, stationTo]);

  // Handle line change
  const handleLineChange = (newLine: string) => {
    setLineCode(newLine);
    const newSts = stations.filter((s) => s.line_code === newLine).sort((a, b) => a.seq_order - b.seq_order);
    if (newSts.length >= 2) {
      setStationFrom(newSts[0].station_id);
      setStationTo(newSts[1].station_id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newActivity: Activity = {
      activity_id: activityId.trim().toUpperCase(),
      contract_number: contractNumber,
      line_code: lineCode,
      activity_type: activityType,
      priority: Number(priority),
      nature_of_works: natureOfWorks,
      station_from: stationFrom,
      station_to: stationTo,
      track_bound: trackBound,
      total_accesses: Number(totalAccesses),
      planned_start_date: plannedStartDate,
      predecessor_activity_id: predecessorId.trim() ? predecessorId.trim().toUpperCase() : null,
    };

    onAddActivity(newActivity);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose} style={{ justifyContent: "flex-end", alignItems: "stretch", padding: 0 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          backgroundColor: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-default)",
          height: "100%",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 24,
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  padding: 6,
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--teal-50)",
                  border: "1px solid var(--border-teal)",
                  color: "var(--teal-700)",
                }}
              >
                <PlusCircle size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)" }}>Create Workload Entry</h2>
                <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                  Add urgent maintenance or renewal activity with safety envelope validation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn btn--ghost btn--icon"
              aria-label="Close drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
            {/* Quick Priority Callout for Maintainers */}
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-rose-300">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>Maintainer Fast-Track (Priority 1)</span>
              </div>
              <p className="text-[11px] text-slate-300">
                In-house track maintenance possesses the track first. Priority 1 reservations take operational precedence over commercial contracts.
              </p>
            </div>

            {/* Interchange Crossover Alert */}
            {touchesInterchange && natureOfWorks === "Live" && (
              <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-800/80 text-purple-200 space-y-1 animate-pulse">
                <div className="flex items-center gap-1.5 font-bold text-[11px] text-purple-300">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>Dual-Line Interchange Crossover Notice</span>
                </div>
                <p className="text-[11px] text-purple-200">
                  Performing 750V Live Rail work across H01/H02 isolates traction power for <strong>both Line Alpha and Line Beta</strong> tunnels simultaneously.
                </p>
              </div>
            )}

            {/* Activity ID & Contract */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Activity ID</label>
                <input
                  type="text"
                  required
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono uppercase focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Associated Contract</label>
                <select
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {contracts.map((c) => (
                    <option key={c.contract_number} value={c.contract_number}>
                      {c.contract_number}: {c.contractor_name} (P{c.priority})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line & Bound */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Railway Line</label>
                <select
                  value={lineCode}
                  onChange={(e) => handleLineChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="ALP">Line Alpha (ALP)</option>
                  <option value="BET">Line Beta (BET)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Track Direction</label>
                <select
                  value={trackBound}
                  onChange={(e) => setTrackBound(e.target.value as TrackBound)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="EB">Eastbound (EB)</option>
                  <option value="WB">Westbound (WB)</option>
                </select>
              </div>
            </div>

            {/* Stations From / To */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Station From</label>
                <select
                  value={stationFrom}
                  onChange={(e) => setStationFrom(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {lineStations.map((st) => (
                    <option key={st.station_id} value={st.station_id}>
                      {st.station_id} ({st.station_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Station To</label>
                <select
                  value={stationTo}
                  onChange={(e) => setStationTo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {lineStations.map((st) => (
                    <option key={st.station_id} value={st.station_id}>
                      {st.station_id} ({st.station_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority & Nature */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Job Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value={1}>P1 (Critical / Maintenance)</option>
                  <option value={2}>P2 (Important / High)</option>
                  <option value={3}>P3 (Routine Capital Renewal)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Nature of Works</label>
                <select
                  value={natureOfWorks}
                  onChange={(e) => setNatureOfWorks(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="Live">Live (Requires 2-sec buffer & Opp Bound)</option>
                  <option value="Non-live (Consist)">Non-live (Consist - 1-sec buffer)</option>
                  <option value="Non-live (Others)">Non-live (Others - 0 buffer)</option>
                </select>
              </div>
            </div>

            {/* Total Accesses & Start Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Total Nights Required</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={totalAccesses}
                  onChange={(e) => setTotalAccesses(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Earliest Start Date</label>
                <input
                  type="date"
                  required
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Predecessor Activity */}
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Predecessor Activity ID (Optional)
              </label>
              <select
                value={predecessorId}
                onChange={(e) => setPredecessorId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="">None (Independent Root Activity)</option>
                {existingActivities.map((a) => (
                  <option key={a.activity_id} value={a.activity_id}>
                    {a.activity_id}: {a.contract_number} ({a.station_from} → {a.station_to}, P{a.priority})
                  </option>
                ))}
              </select>
            </div>

            {/* Calculated Safety Footprint Preview */}
            <div
              style={{
                padding: 12,
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-muted)",
                border: "1px solid var(--border-default)",
              }}
              className="space-y-2"
            >
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-500)", display: "block" }}>
                Calculated Safety Footprint
              </span>
              <div className="flex items-center justify-between font-mono text-[11px]" style={{ color: "var(--ink-700)" }}>
                <span>Buffer Margin:</span>
                <span style={{ color: "var(--orange-500)", fontWeight: 700 }}>
                  {activeBufferRule.buffer_sectors} Sector(s) ({activeBufferRule.buffer_sectors * 1000}m)
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]" style={{ color: "var(--ink-700)" }}>
                <span>Opposite Track Isolation:</span>
                <span style={{ color: activeBufferRule.requires_opposite_bound ? "var(--status-red)" : "var(--status-green)", fontWeight: 700 }}>
                  {activeBufferRule.requires_opposite_bound ? "Enforced (750V Live Rail Cutoff)" : "Not Required"}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border-default)" }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn--secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                style={{ gap: 6 }}
              >
                <PlusCircle size={16} />
                <span>Stage Activity to Draft</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
