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
  ChevronLeft,
  ChevronRight,
  RotateCcw,
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

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

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, lineFilter, priorityFilter, natureFilter, boundFilter, quickFilter, filterSector]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize));
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, currentPage, pageSize]);

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

  const handleResetFilters = () => {
    setLineFilter("ALL");
    setPriorityFilter("ALL");
    setNatureFilter("ALL");
    setBoundFilter("ALL");
    setQuickFilter("ALL");
    setSearchTerm("");
  };

  const hasActiveFilters =
    lineFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    natureFilter !== "ALL" ||
    boundFilter !== "ALL" ||
    quickFilter !== "ALL" ||
    searchTerm !== "";

  return (
    <div className="space-y-6">
      {/* Elevated Filter & Control Console */}
      <div
        className="rounded-2xl border transition-all"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
          padding: "28px 32px",
        }}
      >
        {/* Sector Isolation Banner if active */}
        {filterSector && (
          <div
            className="flex items-center justify-between px-5 py-3 rounded-xl mb-6 text-xs"
            style={{
              backgroundColor: "var(--teal-050)",
              border: "1px solid var(--border-teal)",
              color: "var(--teal-900)",
            }}
          >
            <span className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: "var(--teal-600)" }}></span>
              <span>
                Isolated Track Segment: <strong className="font-mono text-sm">{filterSector}</strong>
              </span>
            </span>
            {onClearSectorFilter && (
              <button
                onClick={onClearSectorFilter}
                className="font-semibold hover:underline cursor-pointer px-2 py-1 rounded"
                style={{ color: "var(--teal-700)" }}
              >
                Clear Track Segment Filter
              </button>
            )}
          </div>
        )}

        {/* Console Header: Title, Search & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold" style={{ color: "var(--ink-900)" }}>
                Possession Activity Registry
              </h2>
              <span
                className="font-mono text-xs font-semibold px-3 py-1 rounded-full"
                style={{ backgroundColor: "var(--bg-muted)", color: "var(--ink-700)" }}
              >
                {filteredActivities.length} {filteredActivities.length === 1 ? "workload" : "workloads"}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--ink-500)" }}>
              Manage maintenance workfronts, contractor possessions, priority tiers, and precedence DAG links
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Search Box */}
            <div className="relative min-w-[300px]">
              <Search className="w-4 h-4 absolute left-3.5 top-3" style={{ color: "var(--ink-400)" }} />
              <input
                type="text"
                placeholder="Search activity ID, contract, station..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                style={{
                  backgroundColor: "var(--bg-page)",
                  border: "1px solid var(--border-default)",
                  color: "var(--ink-900)",
                }}
              />
            </div>

            {/* + New Workload Action */}
            <button
              onClick={onOpenCreateDrawer}
              className="btn btn--primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px" }}
            >
              <PlusCircle size={15} />
              <span>+ New Workload</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Perspective Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-5 pb-5">
          <span className="text-xs font-semibold mr-1 uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>
            Quick Views:
          </span>
          <button
            onClick={() => {
              setQuickFilter("ALL");
              setPriorityFilter("ALL");
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            style={{
              backgroundColor: quickFilter === "ALL" && priorityFilter === "ALL" ? "var(--teal-600)" : "var(--bg-muted)",
              color: quickFilter === "ALL" && priorityFilter === "ALL" ? "#ffffff" : "var(--ink-700)",
              border: `1px solid ${quickFilter === "ALL" && priorityFilter === "ALL" ? "var(--teal-700)" : "var(--border-default)"}`,
            }}
          >
            All Workloads ({activities.length})
          </button>

          <button
            onClick={() => {
              setQuickFilter("P1");
              setPriorityFilter("1");
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              backgroundColor: quickFilter === "P1" || priorityFilter === "1" ? "var(--status-red)" : "var(--status-red-bg)",
              color: quickFilter === "P1" || priorityFilter === "1" ? "#ffffff" : "var(--status-red)",
              border: `1px solid ${quickFilter === "P1" || priorityFilter === "1" ? "var(--status-red)" : "var(--status-red-border)"}`,
            }}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Priority 1 Maintainer ({activities.filter((a) => a.priority === 1).length})</span>
          </button>

          <button
            onClick={() => {
              setQuickFilter("LIVE");
              setNatureFilter("Live");
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              backgroundColor: quickFilter === "LIVE" ? "var(--orange-500)" : "var(--status-amber-bg)",
              color: quickFilter === "LIVE" ? "#ffffff" : "var(--orange-600)",
              border: `1px solid ${quickFilter === "LIVE" ? "var(--orange-600)" : "var(--status-amber-border)"}`,
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>750V Live Rail ({activities.filter((a) => a.nature_of_works === "Live").length})</span>
          </button>

          <button
            onClick={() => setQuickFilter("INTERCHANGE")}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              backgroundColor: quickFilter === "INTERCHANGE" ? "#7c3aed" : "#f5f3ff",
              color: quickFilter === "INTERCHANGE" ? "#ffffff" : "#6d28d9",
              border: `1px solid ${quickFilter === "INTERCHANGE" ? "#6d28d9" : "#ddd6fe"}`,
            }}
          >
            <span>Interchange Hubs (H01/H02)</span>
          </button>

          <button
            onClick={() => setQuickFilter("PRED")}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            style={{
              backgroundColor: quickFilter === "PRED" ? "var(--teal-700)" : "var(--teal-050)",
              color: quickFilter === "PRED" ? "#ffffff" : "var(--teal-800)",
              border: `1px solid ${quickFilter === "PRED" ? "var(--teal-800)" : "var(--border-teal)"}`,
            }}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Has Predecessor</span>
          </button>
        </div>

        {/* Faceted Dropdown Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-5 border-t text-xs" style={{ borderColor: "var(--border-default)" }}>
          {/* Line Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-500)" }}>
              Railway Line
            </label>
            <select
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--bg-page)",
                border: "1px solid var(--border-default)",
                color: "var(--ink-800)",
              }}
            >
              <option value="ALL">All Lines</option>
              {lines.map((l) => (
                <option key={l} value={l}>
                  Line {l}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-500)" }}>
              Priority Tier
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--bg-page)",
                border: "1px solid var(--border-default)",
                color: "var(--ink-800)",
              }}
            >
              <option value="ALL">All Priorities</option>
              <option value="1">Priority 1 (Critical)</option>
              <option value="2">Priority 2 (High)</option>
              <option value="3">Priority 3 (Routine)</option>
            </select>
          </div>

          {/* Nature Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-500)" }}>
              Work Nature
            </label>
            <select
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--bg-page)",
                border: "1px solid var(--border-default)",
                color: "var(--ink-800)",
              }}
            >
              <option value="ALL">All Work Natures</option>
              <option value="Live">Live (2-Sector Live Buffer)</option>
              <option value="Non-live (Consist)">Non-live (Consist)</option>
              <option value="Non-live (Others)">Non-live (Others)</option>
            </select>
          </div>

          {/* Bound Filter */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-500)" }}>
              Direction Bound
            </label>
            <select
              value={boundFilter}
              onChange={(e) => setBoundFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--bg-page)",
                border: "1px solid var(--border-default)",
                color: "var(--ink-800)",
              }}
            >
              <option value="ALL">Both Directions (EB & WB)</option>
              <option value="EB">Eastbound (EB)</option>
              <option value="WB">Westbound (WB)</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            {hasActiveFilters ? (
              <button
                onClick={handleResetFilters}
                className="w-full px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                style={{ color: "var(--teal-700)", backgroundColor: "var(--teal-050)", border: "1px solid var(--border-teal)" }}
              >
                <RotateCcw size={13} />
                <span>Reset Filters</span>
              </button>
            ) : (
              <div className="w-full px-3 py-2 text-[11px] text-center" style={{ color: "var(--ink-400)" }}>
                No active filters
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spacious Activities Data Table */}
      <div
        className="rounded-2xl border overflow-hidden transition-all"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: "var(--bg-muted)", borderBottom: "1px solid var(--border-default)" }}>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-700)" }}>
                  Activity ID
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-700)" }}>
                  Contract
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-700)" }}>
                  Line & Bound
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-700)" }}>
                  Track Reach
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider text-center" style={{ color: "var(--ink-700)" }}>
                  Volume (Nights)
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider text-center" style={{ color: "var(--ink-700)" }}>
                  Priority
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-700)" }}>
                  Nature of Work
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-700)" }}>
                  Predecessor
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider" style={{ color: "var(--ink-700)" }}>
                  Schedule
                </th>
                <th className="py-4 px-5 font-bold text-[11px] uppercase tracking-wider text-right" style={{ color: "var(--ink-700)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-sm" style={{ color: "var(--ink-500)" }}>
                    No activities match the current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((act) => {
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
                      className="transition-colors cursor-pointer group hover:bg-slate-50/80"
                      style={{
                        backgroundColor: isSelected ? "var(--teal-050)" : "transparent",
                        borderLeft: isSelected ? "4px solid var(--teal-600)" : "4px solid transparent",
                        borderBottom: "1px solid var(--border-default)",
                      }}
                    >
                      {/* Activity ID */}
                      <td className="py-4 px-5 font-bold font-mono" style={{ color: "var(--ink-900)" }}>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                act.priority === 1
                                  ? "var(--status-red)"
                                  : act.line_code === "ALP"
                                  ? "var(--teal-600)"
                                  : "#10b981",
                            }}
                          ></span>
                          <span className="text-sm font-semibold">{act.activity_id}</span>
                        </div>
                      </td>

                      {/* Contract */}
                      <td className="py-4 px-5">
                        <span
                          className="px-2.5 py-1 rounded font-mono text-xs font-semibold"
                          style={{
                            backgroundColor: "var(--bg-muted)",
                            border: "1px solid var(--border-default)",
                            color: "var(--ink-800)",
                          }}
                        >
                          {act.contract_number}
                        </span>
                      </td>

                      {/* Line & Bound */}
                      <td className="py-4 px-5">
                        <span
                          className="font-bold font-mono text-xs"
                          style={{ color: act.line_code === "ALP" ? "var(--teal-700)" : "#059669" }}
                        >
                          {act.line_code}
                        </span>{" "}
                        &middot;{" "}
                        <span className="font-mono font-bold text-xs" style={{ color: "var(--orange-600)" }}>
                          {act.track_bound}
                        </span>
                      </td>

                      {/* Reach */}
                      <td className="py-4 px-5" style={{ color: "var(--ink-800)" }}>
                        <span className="font-semibold font-mono text-xs">
                          {act.station_from} → {act.station_to}
                        </span>
                        {crossesInterchange && (
                          <span
                            className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: "#f5f3ff",
                              border: "1px solid #ddd6fe",
                              color: "#6d28d9",
                            }}
                          >
                            Hub
                          </span>
                        )}
                      </td>

                      {/* Total Accesses (Editable) */}
                      <td className="py-4 px-5 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={editForm.total_accesses}
                            onChange={(e) =>
                              setEditForm({ ...editForm, total_accesses: Number(e.target.value) })
                            }
                            className="w-16 px-2 py-1.5 rounded text-center font-mono font-bold text-xs"
                            style={{
                              backgroundColor: "var(--bg-page)",
                              border: "2px solid var(--teal-600)",
                              color: "var(--teal-700)",
                            }}
                          />
                        ) : (
                          <span className="font-mono font-bold text-sm" style={{ color: "var(--teal-700)" }}>
                            {act.total_accesses}
                          </span>
                        )}
                      </td>

                      {/* Priority (Editable) */}
                      <td className="py-4 px-5 text-center">
                        {isEditing ? (
                          <select
                            value={editForm.priority}
                            onChange={(e) =>
                              setEditForm({ ...editForm, priority: Number(e.target.value) })
                            }
                            className="px-2 py-1.5 rounded font-mono text-xs"
                            style={{
                              backgroundColor: "var(--bg-page)",
                              border: "2px solid var(--teal-600)",
                              color: "var(--ink-900)",
                            }}
                          >
                            <option value={1}>P1</option>
                            <option value={2}>P2</option>
                            <option value={3}>P3</option>
                          </select>
                        ) : (
                          <span
                            className="px-3 py-1 rounded-full text-xs font-bold font-mono"
                            style={{
                              backgroundColor:
                                act.priority === 1
                                  ? "var(--status-red-bg)"
                                  : act.priority === 2
                                  ? "var(--teal-050)"
                                  : "var(--status-green-bg)",
                              border: `1px solid ${
                                act.priority === 1
                                  ? "var(--status-red-border)"
                                  : act.priority === 2
                                  ? "var(--border-teal)"
                                  : "var(--status-green-border)"
                              }`,
                              color:
                                act.priority === 1
                                  ? "var(--status-red)"
                                  : act.priority === 2
                                  ? "var(--teal-700)"
                                  : "var(--status-green)",
                            }}
                          >
                            P{act.priority}
                          </span>
                        )}
                      </td>

                      {/* Nature */}
                      <td className="py-4 px-5">
                        <span
                          className="text-xs font-medium inline-flex items-center gap-1.5"
                          style={{
                            color: act.nature_of_works === "Live" ? "var(--orange-600)" : "var(--ink-700)",
                            fontWeight: act.nature_of_works === "Live" ? 600 : 400,
                          }}
                        >
                          {act.nature_of_works === "Live" && <Zap className="w-3.5 h-3.5 text-amber-500" />}
                          <span>{act.nature_of_works}</span>
                        </span>
                      </td>

                      {/* Predecessor */}
                      <td className="py-4 px-5">
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
                            className="w-20 px-2 py-1.5 rounded text-xs font-mono uppercase"
                            style={{
                              backgroundColor: "var(--bg-page)",
                              border: "2px solid var(--teal-600)",
                              color: "var(--ink-900)",
                            }}
                          />
                        ) : act.predecessor_activity_id ? (
                          <span
                            className="px-2.5 py-1 rounded font-mono text-xs font-semibold flex items-center gap-1.5 w-fit"
                            style={{
                              backgroundColor: "var(--teal-050)",
                              border: "1px solid var(--border-teal)",
                              color: "var(--teal-800)",
                            }}
                          >
                            <span style={{ color: "var(--teal-600)" }}>FS+0:</span>
                            <span>{act.predecessor_activity_id}</span>
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--ink-400)" }}>
                            —
                          </span>
                        )}
                      </td>

                      {/* Scheduled Access */}
                      <td className="py-4 px-5">
                        {(() => {
                          const sched = getActivityAccessSummary(act.activity_id);
                          return sched ? (
                            <span className="badge badge--valid font-mono text-xs" title={`Scheduled shifts for ${act.activity_id}`}>
                              {sched}
                            </span>
                          ) : (
                            <span className="text-xs font-mono" style={{ color: "var(--ink-400)" }}>
                              —
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEditing(act.activity_id);
                              }}
                              className="p-1.5 rounded text-white cursor-pointer"
                              style={{ backgroundColor: "var(--status-green)" }}
                              title="Save changes to draft"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                              className="p-1.5 rounded cursor-pointer"
                              style={{ backgroundColor: "var(--bg-muted)", color: "var(--ink-700)" }}
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/schedule?activity=${act.activity_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all"
                              style={{
                                backgroundColor: "var(--bg-muted)",
                                border: "1px solid var(--border-default)",
                                color: "var(--teal-700)",
                              }}
                              title={`Open ${act.activity_id} in Master Schedule`}
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              <span>Gantt</span>
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectActivity(act.activity_id);
                              }}
                              className="p-1.5 rounded cursor-pointer transition-colors"
                              style={{
                                backgroundColor: isSelected ? "var(--teal-100)" : "transparent",
                                color: isSelected ? "var(--teal-800)" : "var(--ink-500)",
                              }}
                              title="Inspect 1D spatial footprint"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(act);
                              }}
                              className="p-1.5 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                              style={{ color: "var(--ink-500)" }}
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

        {/* Pagination & Summary Bar */}
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-t gap-3"
          style={{
            backgroundColor: "var(--bg-muted)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="text-xs" style={{ color: "var(--ink-600)" }}>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{" "}
            <strong>{Math.min(currentPage * pageSize, filteredActivities.length)}</strong> of{" "}
            <strong>{filteredActivities.length}</strong> total activities
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--ink-800)",
              }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1.5 text-xs font-mono font-medium" style={{ color: "var(--ink-700)" }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--ink-800)",
              }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
