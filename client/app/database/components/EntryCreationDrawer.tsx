"use client";

import React, { useState, useMemo } from "react";
import { X, PlusCircle, Train, ShieldCheck, ShieldAlert, Sparkles, Navigation } from "lucide-react";
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full overflow-y-auto flex flex-col justify-between p-6 shadow-2xl">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Create Database Workload Entry</h2>
                <p className="text-xs text-slate-400">
                  Add urgent maintenance or renewal activity with safety envelope validation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
            {/* Quick Priority Callout for Maintainers */}
            <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-cyan-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Maintainer Fast Track: Priority 1 (Urgent Maintenance)</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Setting Priority 1 ensures the optimization engine schedules this task before commercial renewal jobs.
              </p>
            </div>

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
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Calculated Safety Footprint
              </span>
              <div className="flex items-center justify-between text-slate-300 font-mono text-[11px]">
                <span>Buffer Margin:</span>
                <span className="text-amber-400 font-bold">
                  {activeBufferRule.buffer_sectors} Sector(s) ({activeBufferRule.buffer_sectors * 1000}m)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 font-mono text-[11px]">
                <span>Opposite Track Isolation:</span>
                <span className={activeBufferRule.requires_opposite_bound ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {activeBufferRule.requires_opposite_bound ? "Enforced (Live Track)" : "Not Required"}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-2 shadow-sm shadow-cyan-900/50 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Stage Activity to Draft</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
