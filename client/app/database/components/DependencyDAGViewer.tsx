"use client";

import React, { useState } from "react";
import {
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Filter,
  AlertTriangle,
  Scissors,
  CheckCircle2,
} from "lucide-react";
import type { DAGReport, Activity } from "@/lib/types";
import { DESIGN_TOKENS } from "@/lib/design-tokens";

interface DependencyDAGViewerProps {
  dagReport: DAGReport;
  activities: Activity[];
  onSelectActivity?: (id: string) => void;
  onBreakCycle?: (cycleNodes: string[]) => void;
}

export function DependencyDAGViewer({
  dagReport,
  activities,
  onSelectActivity,
  onBreakCycle,
}: DependencyDAGViewerProps) {
  const [selectedContract, setSelectedContract] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<"ALL" | "DEPENDENT" | "ROOT">("ALL");

  const contracts = Array.from(new Set(activities.map((a) => a.contract_number))).sort();

  const filteredNodes = dagReport.nodes.filter((n) => {
    const matchesContract = selectedContract === "ALL" || n.contract_number === selectedContract;
    const incoming = dagReport.edges.filter((e) => e.to === n.id);
    const outgoing = dagReport.edges.filter((e) => e.from === n.id);

    let matchesFilter = true;
    if (filterMode === "DEPENDENT") matchesFilter = incoming.length > 0 || outgoing.length > 0;
    else if (filterMode === "ROOT") matchesFilter = incoming.length === 0;

    return matchesContract && matchesFilter;
  });

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div
        className="section"
        style={{
          padding: "12px 16px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
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
            <GitBranch size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)" }}>Predecessor DAG Dependency Structure</h2>
            <p style={{ fontSize: 12, color: "var(--ink-500)" }}>
              Structural precedence constraints ($FS+0$) and real-time circular dependency cycle audit
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick filter chips */}
          <div className="seg-control">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`seg-btn${filterMode === "ALL" ? " active" : ""}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode("DEPENDENT")}
              className={`seg-btn${filterMode === "DEPENDENT" ? " active" : ""}`}
            >
              In Chains
            </button>
            <button
              onClick={() => setFilterMode("ROOT")}
              className={`seg-btn${filterMode === "ROOT" ? " active" : ""}`}
            >
              Roots
            </button>
          </div>

          {/* Contract Filter */}
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-md font-mono cursor-pointer"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--ink-900)",
            }}
          >
            <option value="ALL">All Contracts ({contracts.length})</option>
            {contracts.map((c) => (
              <option key={c} value={c}>
                Contract {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cycle Detection Alert Banner */}
      {dagReport.has_cycles ? (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
              <span>CRITICAL ERROR: Circular Predecessor Dependency Detected! ({dagReport.cycle_count} cycle(s))</span>
            </div>
            {onBreakCycle && (
              <button
                onClick={() => onBreakCycle(dagReport.cycles[0])}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-950 transition-colors cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Auto-Break Cycle</span>
              </button>
            )}
          </div>
          <p className="text-xs text-rose-300">
            The optimization engine requires a strict Directed Acyclic Graph (DAG). Predecessor cycles make scheduling mathematically impossible.
          </p>
          <div className="p-3 bg-rose-950/90 rounded-lg border border-rose-900 font-mono text-xs space-y-1.5">
            {dagReport.cycles.map((cycle, idx) => (
              <div key={idx} className="flex items-center gap-2 text-rose-200 font-semibold">
                <span className="text-rose-400">Cycle #{idx + 1}:</span>
                <span className="bg-rose-900/60 px-2 py-0.5 rounded border border-rose-700/60">
                  {cycle.join(" ➔ ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Predecessor Graph Valid</strong> &middot; 0 circular dependencies detected across {dagReport.nodes.length} activities.
            </span>
          </div>
          <span className="text-emerald-400/80 font-mono">
            {dagReport.edges.length} Dependency Edges &middot; {dagReport.independent_activities_count} Independent
          </span>
        </div>
      )}

      {/* Dependency Visual Tree / Node Cards */}
      <div className="section" style={{ padding: 16, maxHeight: 520, overflowY: "auto" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNodes.map((node) => {
            const incoming = dagReport.edges.filter((e) => e.to === node.id);
            const outgoing = dagReport.edges.filter((e) => e.from === node.id);
            const isCycleNode = dagReport.cycles.some((c) => c.includes(node.id));

            return (
              <div
                key={node.id}
                onClick={() => onSelectActivity && onSelectActivity(node.id)}
                className="cursor-pointer"
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  border: isCycleNode ? "2px solid var(--status-red)" : "1px solid var(--border-default)",
                  backgroundColor: isCycleNode ? "rgba(225, 29, 72, 0.08)" : "var(--bg-surface)",
                  boxShadow: "var(--shadow-xs)",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Node Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--border-default)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="font-mono font-bold text-xs" style={{ color: "var(--ink-900)" }}>{node.id}</span>
                    <span className="chip chip--contract font-mono text-[10px]">
                      {node.contract_number}
                    </span>
                  </div>
                  <span
                    className={`badge font-mono text-[10px] ${
                      node.priority === 1
                        ? "badge--invalid"
                        : node.priority === 2
                        ? "badge--pending"
                        : "badge--neutral"
                    }`}
                  >
                    Priority {node.priority}
                  </span>
                </div>

                {/* Body Details */}
                <div className="py-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Reach:</span>
                    <span className="font-mono text-slate-300">
                      {node.station_from} → {node.station_to} ({node.line_code})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Volume:</span>
                    <span className="font-mono text-cyan-400 font-semibold">{node.total_accesses} night shifts</span>
                  </div>
                </div>

                {/* Precedence Chain Footer */}
                <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono flex items-center justify-between">
                  <div>
                    {incoming.length > 0 ? (
                      <span className="text-amber-400 flex items-center gap-1 font-semibold">
                        Predecessor: {incoming.map((e) => e.from).join(", ")}
                      </span>
                    ) : (
                      <span className="text-slate-500">Root (No predecessor)</span>
                    )}
                  </div>
                  <div>
                    {outgoing.length > 0 && (
                      <span className="text-purple-400 flex items-center gap-1 font-semibold">
                        Unlocks ({outgoing.length}) <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
