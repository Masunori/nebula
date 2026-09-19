"use client";

import React, { useState, useMemo } from "react";
import { X, PlusCircle, Train, ShieldCheck, ShieldAlert, Sparkles, Navigation, Zap } from "lucide-react";
import type { Activity, Contract, Station, BufferRule, TrackBound } from "@/lib/types";

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
  const [priority, setPriority] = useState<number>(1); // Default to P1 for urgent maintainer use case
  const [natureOfWorks, setNatureOfWorks] = useState<string>("Live");
  const [totalAccesses, setTotalAccesses] = useState<number>(3);
  const [plannedStartDate, setPlannedStartDate] = useState<string>("2027-02-01");
  const [predecessorId, setPredecessorId] = useState<string>("");

  // Unique line codes present in stations
  const availableLines = useMemo(() => {
    const linesSet = new Set<string>();
    stations.forEach((s) => linesSet.add(s.line_code));
    return Array.from(linesSet).sort();
  }, [stations]);

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
          maxWidth: 540,
          backgroundColor: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-default)",
          height: "100%",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 32,
          boxShadow: "0 25px 50px -12px rgba(15, 25, 35, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-5 border-b" style={{ borderColor: "var(--border-default)" }}>
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
                <PlusCircle size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--ink-900)" }}>Create Workload Entry</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
                  Add urgent maintenance or renewal activity with safety envelope validation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-5 text-xs">
            {/* Quick Priority Callout for Maintainers */}
            <div
              className="p-3.5 rounded-xl border space-y-1"
              style={{
                backgroundColor: "var(--status-red-bg)",
                borderColor: "var(--status-red-border)",
                color: "var(--status-red)",
              }}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Maintainer Fast-Track (Priority 1)</span>
              </div>
              <p className="text-[11px]" style={{ color: "var(--ink-700)" }}>
                In-house track maintenance possesses the track first. Priority 1 reservations take operational precedence over commercial contracts.
              </p>
            </div>

            {/* Interchange Crossover Alert */}
            {touchesInterchange && natureOfWorks === "Live" && (
              <div
                className="p-3.5 rounded-xl border space-y-1"
                style={{
                  backgroundColor: "#faf5ff",
                  borderColor: "#e9d5ff",
                  color: "#6b21a8",
                }}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Zap className="w-4 h-4 shrink-0 text-purple-600" />
                  <span>Dual-Line Interchange Crossover Notice</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--ink-700)" }}>
                  Performing 750V Live Rail work across H01/H02 isolates traction power for <strong>both interchange lines</strong> simultaneously.
                </p>
              </div>
            )}

            {/* Activity ID & Contract */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Activity ID</label>
                <input
                  type="text"
                  required
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--ink-900)",
                  }}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Associated Contract</label>
                <select
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--ink-900)",
                  }}
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
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Railway Line</label>
                <select
                  value={lineCode}
                  onChange={(e) => handleLineChange(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--teal-700)",
                  }}
                >
                  {availableLines.map((code) => (
                    <option key={code} value={code}>
                      Line {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Track Direction</label>
                <select
                  value={trackBound}
                  onChange={(e) => setTrackBound(e.target.value as TrackBound)}
                  className="w-full px-3.5 py-2 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--orange-700)",
                  }}
                >
                  <option value="EB">Eastbound (EB)</option>
                  <option value="WB">Westbound (WB)</option>
                </select>
              </div>
            </div>

            {/* Stations From / To */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Station From</label>
                <select
                  value={stationFrom}
                  onChange={(e) => setStationFrom(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--ink-900)",
                  }}
                >
                  {lineStations.map((st) => (
                    <option key={st.station_id} value={st.station_id}>
                      {st.station_id} ({st.station_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Station To</label>
                <select
                  value={stationTo}
                  onChange={(e) => setStationTo(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--ink-900)",
                  }}
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
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Job Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--ink-900)",
                  }}
                >
                  <option value={1}>P1 (Critical / Maintenance)</option>
                  <option value={2}>P2 (Important / High)</option>
                  <option value={3}>P3 (Routine Capital Renewal)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Nature of Works</label>
                <select
                  value={natureOfWorks}
                  onChange={(e) => setNatureOfWorks(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--ink-900)",
                  }}
                >
                  <option value="Live">Live (Requires 2-sec buffer & Opp Bound)</option>
                  <option value="Non-live (Consist)">Non-live (Consist - 1-sec buffer)</option>
                  <option value="Non-live (Others)">Non-live (Others - 0 buffer)</option>
                </select>
              </div>
            </div>

            {/* Total Accesses & Start Date */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Total Nights Required</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={totalAccesses}
                  onChange={(e) => setTotalAccesses(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--teal-700)",
                  }}
                />
              </div>

              <div>
                <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>Earliest Start Date</label>
                <input
                  type="date"
                  required
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    border: "1px solid var(--border-default)",
                    color: "var(--ink-900)",
                  }}
                />
              </div>
            </div>

            {/* Predecessor Activity */}
            <div>
              <label className="font-semibold block mb-1" style={{ color: "var(--ink-700)" }}>
                Predecessor Activity ID (Optional)
              </label>
              <select
                value={predecessorId}
                onChange={(e) => setPredecessorId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-page)",
                  border: "1px solid var(--border-default)",
                  color: "var(--ink-900)",
                }}
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
                padding: 16,
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--bg-muted)",
                border: "1px solid var(--border-default)",
              }}
              className="space-y-2.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: "var(--ink-500)" }}>
                Calculated Safety Footprint
              </span>
              <div className="flex items-center justify-between font-mono text-xs" style={{ color: "var(--ink-700)" }}>
                <span>Buffer Margin:</span>
                <span className="font-bold" style={{ color: "var(--orange-700)" }}>
                  {activeBufferRule.buffer_sectors} Sector(s) ({activeBufferRule.buffer_sectors * 1000}m)
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs" style={{ color: "var(--ink-700)" }}>
                <span>Opposite Track Isolation:</span>
                <span
                  className="font-bold"
                  style={{
                    color: activeBufferRule.requires_opposite_bound ? "var(--status-red)" : "var(--status-green)",
                  }}
                >
                  {activeBufferRule.requires_opposite_bound ? "Enforced (750V Live Rail Cutoff)" : "Not Required"}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-5 border-t" style={{ borderColor: "var(--border-default)" }}>
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
                style={{ gap: 8, padding: "10px 20px" }}
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
