"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  Eye,
  Edit2,
  Check,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  PlusCircle,
  Wrench,
  GitBranch,
  CalendarClock,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { Activity, TrackBound, PersonaMode } from "@/lib/types";
import { DESIGN_TOKENS } from "@/lib/design-tokens";
import { getActivityAccessSummary } from "@/lib/api";

interface ActivityDataGridProps {
  activities: Activity[];
  selectedActivityId: string;
  onSelectActivity: (id: string) => void;
  onUpdateActivity: (id: string, updates: Partial<Activity>) => void;
  onOpenCreateDrawer: () => void;
  personaMode?: PersonaMode;
  filterSector?: string | null;
  onClearSectorFilter?: () => void;
}

export function ActivityDataGrid({
  activities,
  selectedActivityId,
  onSelectActivity,
  onUpdateActivity,
  onOpenCreateDrawer,
  personaMode = "ALL",
  filterSector,
  onClearSectorFilter,
}: ActivityDataGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [lineFilter, setLineFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [natureFilter, setNatureFilter] = useState("ALL");
  const [boundFilter, setBoundFilter] = useState("ALL");
  const [quickFilter, setQuickFilter] = useState<"ALL" | "P1" | "LIVE" | "INTERCHANGE" | "PRED">("ALL");

  // Sync quickFilter with personaMode changes
  useEffect(() => {
    if (personaMode === "MAINTAINER") {
      setPriorityFilter("1");
      setQuickFilter("P1");
    } else if (personaMode === "PLANNER") {
      setPriorityFilter("ALL");
      setQuickFilter("ALL");
    } else if (personaMode === "AUDITOR") {
      setQuickFilter("PRED");
    }
  }, [personaMode]);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    total_accesses: number;
    priority: number;
    nature_of_works: string;
    predecessor_activity_id: string;
  }>({
    total_accesses: 0,
    priority: 1,
    nature_of_works: "",
    predecessor_activity_id: "",
  });

  const lines = useMemo(() => Array.from(new Set(activities.map((a) => a.line_code))).sort(), [activities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Search
      const matchesSearch =
        searchTerm === "" ||
        act.activity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.contract_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.station_from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.station_to.toLowerCase().includes(searchTerm.toLowerCase()) ||
        act.activity_type.toLowerCase().includes(searchTerm.toLowerCase());

      // Line filter
      const matchesLine = lineFilter === "ALL" || act.line_code === lineFilter;

      // Priority filter
      const matchesPriority = priorityFilter === "ALL" || act.priority.toString() === priorityFilter;

      // Nature filter
      const matchesNature = natureFilter === "ALL" || act.nature_of_works === natureFilter;

      // Bound filter
      const matchesBound = boundFilter === "ALL" || act.track_bound === boundFilter;

      // Quick filter
      let matchesQuick = true;
      if (quickFilter === "P1") matchesQuick = act.priority === 1;
      else if (quickFilter === "LIVE") matchesQuick = act.nature_of_works === "Live";
      else if (quickFilter === "INTERCHANGE") {
        matchesQuick =
          act.station_from.includes("H01") ||
          act.station_from.includes("H02") ||
          act.station_to.includes("H01") ||
          act.station_to.includes("H02");
      } else if (quickFilter === "PRED") {
        matchesQuick = act.predecessor_activity_id !== null && act.predecessor_activity_id !== "";
      }

      // Sector filter if clicked from topology
      let matchesSector = true;
      if (filterSector) {
        matchesSector =
          filterSector.includes(act.station_from) ||
          filterSector.includes(act.station_to) ||
          filterSector.includes(act.line_code);
      }

      return (
        matchesSearch &&
        matchesLine &&
        matchesPriority &&
        matchesNature &&
        matchesBound &&
        matchesQuick &&
        matchesSector
      );
    });
  }, [
    activities,
    searchTerm,
    lineFilter,
    priorityFilter,
    natureFilter,
    boundFilter,
    quickFilter,
    filterSector,
  ]);

  const startEditing = (act: Activity) => {
    setEditingId(act.activity_id);
    setEditForm({
      total_accesses: act.total_accesses,
      priority: act.priority,
      nature_of_works: act.nature_of_works,
      predecessor_activity_id: act.predecessor_activity_id || "",
    });
  };

  const saveEditing = (id: string) => {
    onUpdateActivity(id, {
      total_accesses: Number(editForm.total_accesses),
      priority: Number(editForm.priority),
      nature_of_works: editForm.nature_of_works,
      predecessor_activity_id:
        editForm.predecessor_activity_id.trim() === "" ? null : editForm.predecessor_activity_id.trim(),
    });
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
        {/* Sector Isolation Banner if active */}
        {filterSector && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800 text-xs text-cyan-200">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>
                Isolated Track Segment: <strong className="font-mono text-white">{filterSector}</strong>
              </span>
            </span>
            {onClearSectorFilter && (
              <button
                onClick={onClearSectorFilter}
                className="text-cyan-400 hover:text-white underline cursor-pointer"
              >
                Clear Track Filter
              </button>
            )}
          </div>
        )}

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Quick Views:</span>
          <button
            onClick={() => {
              setQuickFilter("ALL");
              setPriorityFilter("ALL");
            }}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              quickFilter === "ALL" && priorityFilter === "ALL"
                ? "bg-slate-700 text-white font-semibold"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            All Workloads ({activities.length})
          </button>
          <button
            onClick={() => {
              setQuickFilter("P1");
              setPriorityFilter("1");
            }}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              quickFilter === "P1" || priorityFilter === "1"
                ? DESIGN_TOKENS.role.maintainerP1.badge + " font-bold"
                : "bg-slate-800/60 text-rose-400/80 hover:text-rose-300"
            }`}
          >
            <Wrench className="w-3 h-3" />
            <span>Maintainer P1 Urgent ({activities.filter((a) => a.priority === 1).length})</span>
          </button>
          <button
            onClick={() => {
              setQuickFilter("LIVE");
              setNatureFilter("Live");
            }}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              quickFilter === "LIVE"
                ? DESIGN_TOKENS.role.liveTrack.badge + " font-bold"
                : "bg-slate-800/60 text-amber-400/80 hover:text-amber-300"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>750V Live Rail ({activities.filter((a) => a.nature_of_works === "Live").length})</span>
          </button>
          <button
            onClick={() => setQuickFilter("INTERCHANGE")}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              quickFilter === "INTERCHANGE"
                ? DESIGN_TOKENS.role.interchangeHub.badge + " font-bold"
                : "bg-slate-800/60 text-purple-400/80 hover:text-purple-300"
            }`}
          >
            <span>🔀 Interchange Crossover (H01-H02)</span>
          </button>
          <button
            onClick={() => setQuickFilter("PRED")}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              quickFilter === "PRED"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                : "bg-slate-800/60 text-cyan-400/80 hover:text-cyan-300"
            }`}
          >
            <GitBranch className="w-3 h-3" />
            <span>Has Predecessors</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Activity ID, Contract, Station (e.g. A004, C001, S04)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredActivities.length} of {activities.length} entries
            </span>
            <button
              onClick={onOpenCreateDrawer}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm shadow-cyan-900/50 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ New Workload</span>
            </button>
          </div>
        </div>

        {/* Multi-Criteria Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Faceted Filters:</span>
          </div>

          {/* Line Filter */}
          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono cursor-pointer"
          >
            <option value="ALL">All Lines</option>
            {lines.map((l) => (
              <option key={l} value={l}>
                Line {l}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="1">Priority 1 (Critical Maintenance)</option>
            <option value="2">Priority 2 (High)</option>
            <option value="3">Priority 3 (Routine)</option>
          </select>

          {/* Nature Filter */}
          <select
            value={natureFilter}
            onChange={(e) => setNatureFilter(e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono cursor-pointer"
          >
            <option value="ALL">All Work Natures</option>
            <option value="Live">Live (Requires 2-Sector Buffer & Opp Bound)</option>
            <option value="Non-live (Consist)">Non-live (Consist)</option>
            <option value="Non-live (Others)">Non-live (Others)</option>
          </select>

          {/* Bound Filter */}
          <select
            value={boundFilter}
            onChange={(e) => setBoundFilter(e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-mono cursor-pointer"
          >
            <option value="ALL">Both Bounds (EB & WB)</option>
            <option value="EB">Eastbound (EB)</option>
            <option value="WB">Westbound (WB)</option>
          </select>

          {(lineFilter !== "ALL" ||
            priorityFilter !== "ALL" ||
            natureFilter !== "ALL" ||
            boundFilter !== "ALL" ||
            quickFilter !== "ALL" ||
            searchTerm !== "") && (
            <button
              onClick={() => {
                setLineFilter("ALL");
                setPriorityFilter("ALL");
                setNatureFilter("ALL");
                setBoundFilter("ALL");
                setQuickFilter("ALL");
                setSearchTerm("");
              }}
              className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Activities Data Table */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Activity ID</th>
                <th className="py-3 px-3">Contract</th>
                <th className="py-3 px-3">Line & Bound</th>
                <th className="py-3 px-3">Track Reach</th>
                <th className="py-3 px-3 text-center">Volume (Nights)</th>
                <th className="py-3 px-3 text-center">Priority</th>
                <th className="py-3 px-3">Nature of Work</th>
                <th className="py-3 px-3">Predecessor</th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No activities match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((act) => {
                  const isSelected = act.activity_id === selectedActivityId;
                  const isEditing = act.activity_id === editingId;
                  const crossesInterchange =
                    act.station_from.includes("H01") ||
                    act.station_from.includes("H02") ||
                    act.station_to.includes("H01") ||
                    act.station_to.includes("H02");

                  return (
                    <tr
                      key={act.activity_id}
                      onClick={() => onSelectActivity(act.activity_id)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-cyan-950/40 text-cyan-100 border-l-4 border-l-cyan-400"
                          : "hover:bg-slate-800/60 text-slate-200"
                      }`}
                    >
                      {/* Activity ID */}
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            act.priority === 1
                              ? "bg-rose-500"
                              : act.line_code === "ALP"
                              ? "bg-cyan-400"
                              : "bg-emerald-400"
                          }`}
                        ></span>
                        <span>{act.activity_id}</span>
                      </td>

                      {/* Contract */}
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                          {act.contract_number}
                        </span>
                      </td>

                      {/* Line & Bound */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            act.line_code === "ALP" ? "text-cyan-400" : "text-emerald-400"
                          }`}
                        >
                          {act.line_code}
                        </span>{" "}
                        &middot;{" "}
                        <span className="text-amber-400 font-bold">{act.track_bound}</span>
                      </td>

                      {/* Reach */}
                      <td className="py-2.5 px-3 text-slate-300">
                        <span className="font-semibold text-white">
                          {act.station_from} → {act.station_to}
                        </span>
                        {crossesInterchange && (
                          <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-purple-950 border border-purple-800 text-purple-300 font-bold">
                            H01★H02
                          </span>
                        )}
                      </td>

                      {/* Total Accesses (Editable) */}
                      <td className="py-2.5 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={editForm.total_accesses}
                            onChange={(e) =>
                              setEditForm({ ...editForm, total_accesses: Number(e.target.value) })
                            }
                            className="w-16 px-1.5 py-0.5 bg-slate-950 border border-cyan-500 rounded text-center text-cyan-300 text-xs focus:outline-none"
                          />
                        ) : (
                          <span className="font-bold text-cyan-400">{act.total_accesses}</span>
                        )}
                      </td>

                      {/* Priority (Editable) */}
                      <td className="py-2.5 px-3 text-center">
                        {isEditing ? (
                          <select
                            value={editForm.priority}
                            onChange={(e) =>
                              setEditForm({ ...editForm, priority: Number(e.target.value) })
                            }
                            className="px-1 py-0.5 bg-slate-950 border border-cyan-500 rounded text-xs text-white"
                          >
                            <option value={1}>P1</option>
                            <option value={2}>P2</option>
                            <option value={3}>P3</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              act.priority === 1
                                ? DESIGN_TOKENS.role.maintainerP1.badge
                                : act.priority === 2
                                ? DESIGN_TOKENS.role.commercialP2.badge
                                : DESIGN_TOKENS.role.routineP3.badge
                            }`}
                          >
                            P{act.priority}
                          </span>
                        )}
                      </td>

                      {/* Nature */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[11px] font-medium ${
                            act.nature_of_works === "Live"
                              ? "text-amber-400 font-bold flex items-center gap-1"
                              : "text-slate-300"
                          }`}
                        >
                          {act.nature_of_works === "Live" && <Zap className="w-3 h-3 text-amber-400" />}
                          <span>{act.nature_of_works}</span>
                        </span>
                      </td>

                      {/* Predecessor */}
                      <td className="py-2.5 px-3">
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="e.g. A003"
                            value={editForm.predecessor_activity_id}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                predecessor_activity_id: e.target.value,
                              })
                            }
                            className="w-20 px-1.5 py-0.5 bg-slate-950 border border-cyan-500 rounded text-xs text-cyan-300 font-mono uppercase focus:outline-none"
                          />
                        ) : act.predecessor_activity_id ? (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-[11px] flex items-center gap-1 w-fit">
                            <span>FS+0:</span>
                            <strong>{act.predecessor_activity_id}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">- None -</span>
                        )}
                      </td>

                      {/* Scheduled Access */}
                      <td className="py-2.5 px-3">
                        {(() => {
                          const sched = getActivityAccessSummary(act.activity_id);
                          return sched ? (
                            <span className="badge badge--valid font-mono text-[11px]" title={`Scheduled shifts for ${act.activity_id}`}>
                              {sched}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px] font-mono">—</span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEditing(act.activity_id);
                              }}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              title="Save changes to draft"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                              className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/schedule?activity=${act.activity_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                              title={`Open ${act.activity_id} in Master Schedule`}
                            >
                              <CalendarClock className="w-3 h-3" />
                              <span>Gantt</span>
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectActivity(act.activity_id);
                              }}
                              className={`p-1 rounded cursor-pointer ${
                                isSelected
                                  ? "text-cyan-400 bg-cyan-950/60"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                              title="Inspect 1D spatial footprint"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(act);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 cursor-pointer"
                              title="Inline edit activity"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
