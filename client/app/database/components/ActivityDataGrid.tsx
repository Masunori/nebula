"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import type { Activity, TrackBound } from "@/lib/types";

interface ActivityDataGridProps {
  activities: Activity[];
  selectedActivityId: string;
  onSelectActivity: (id: string) => void;
  onUpdateActivity: (id: string, updates: Partial<Activity>) => void;
  onOpenCreateDrawer: () => void;
  filterSector?: string | null;
}

export function ActivityDataGrid({
  activities,
  selectedActivityId,
  onSelectActivity,
  onUpdateActivity,
  onOpenCreateDrawer,
  filterSector,
}: ActivityDataGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [lineFilter, setLineFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [natureFilter, setNatureFilter] = useState("ALL");
  const [boundFilter, setBoundFilter] = useState("ALL");

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

      return matchesSearch && matchesLine && matchesPriority && matchesNature && matchesBound;
    });
  }, [activities, searchTerm, lineFilter, priorityFilter, natureFilter, boundFilter]);

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
      predecessor_activity_id: editForm.predecessor_activity_id.trim() === "" ? null : editForm.predecessor_activity_id.trim(),
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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
              <span>Add Entry</span>
            </button>
          </div>
        </div>

        {/* Multi-Criteria Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
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

          {(lineFilter !== "ALL" || priorityFilter !== "ALL" || natureFilter !== "ALL" || boundFilter !== "ALL" || searchTerm !== "") && (
            <button
              onClick={() => {
                setLineFilter("ALL");
                setPriorityFilter("ALL");
                setNatureFilter("ALL");
                setBoundFilter("ALL");
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
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono">
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No activities match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredActivities.map((act) => {
                  const isSelected = act.activity_id === selectedActivityId;
                  const isEditing = act.activity_id === editingId;

                  return (
                    <tr
                      key={act.activity_id}
                      onClick={() => onSelectActivity(act.activity_id)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-cyan-950/40 text-cyan-100"
                          : "hover:bg-slate-800/60 text-slate-200"
                      }`}
                    >
                      {/* Activity ID */}
                      <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
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
                        &middot; <span className="text-amber-400 font-bold">{act.track_bound}</span>
                      </td>

                      {/* Reach */}
                      <td className="py-2.5 px-3 text-slate-300">
                        {act.station_from} → {act.station_to}
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
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              act.priority === 1
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : act.priority === 2
                                ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            P{act.priority}
                          </span>
                        )}
                      </td>

                      {/* Nature */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[11px] ${
                            act.nature_of_works === "Live"
                              ? "text-rose-400 font-bold"
                              : "text-slate-300"
                          }`}
                        >
                          {act.nature_of_works}
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
                              setEditForm({ ...editForm, predecessor_activity_id: e.target.value })
                            }
                            className="w-20 px-1.5 py-0.5 bg-slate-950 border border-cyan-500 rounded text-xs text-white uppercase focus:outline-none"
                          />
                        ) : act.predecessor_activity_id ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800 text-[10px]">
                            {act.predecessor_activity_id}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">None</span>
                        )}
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
                              title="Save inline changes"
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                              title="Cancel editing"
                              className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(act);
                              }}
                              title="Edit activity"
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectActivity(act.activity_id);
                              }}
                              title="Inspect 1D spatial footprint"
                              className="p-1 rounded hover:bg-cyan-950 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
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
