"use client";

import React, { useState } from "react";
import { GitBranch, ShieldCheck, ShieldAlert, ArrowRight, Filter, AlertTriangle } from "lucide-react";
import type { DAGReport, Activity } from "@/lib/types";

interface DependencyDAGViewerProps {
  dagReport: DAGReport;
  activities: Activity[];
  onSelectActivity?: (id: string) => void;
}

export function DependencyDAGViewer({
  dagReport,
  activities,
  onSelectActivity,
}: DependencyDAGViewerProps) {
  const [selectedContract, setSelectedContract] = useState<string>("ALL");

  const contracts = Array.from(new Set(activities.map((a) => a.contract_number))).sort();

  const filteredNodes = dagReport.nodes.filter(
    (n) => selectedContract === "ALL" || n.contract_number === selectedContract
  );

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  const filteredEdges = dagReport.edges.filter(
    (e) => filteredNodeIds.has(e.from) || filteredNodeIds.has(e.to)
  );

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Predecessor DAG Dependency Structure</h2>
            <p className="text-xs text-slate-400">
              Structural precedence constraints ($FS+0$) and real-time circular dependency cycle audit
            </p>
          </div>
        </div>

        {/* Contract Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Filter Contract:</span>
          <select
            value={selectedContract}
            onChange={(e) => setSelectedContract(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
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
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
            <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            <span>CRITICAL ERROR: Circular Predecessor Dependency Detected! ({dagReport.cycle_count} cycles)</span>
          </div>
          <p className="text-xs text-rose-300">
            The optimization engine requires a strict Directed Acyclic Graph (DAG). Circular loops make the schedule mathematically infeasible.
          </p>
          <div className="p-3 bg-rose-950/80 rounded-lg border border-rose-900 font-mono text-xs space-y-1">
            {dagReport.cycles.map((cycle, idx) => (
              <div key={idx} className="flex items-center gap-2 text-rose-200 font-semibold">
                <span className="text-rose-400">Cycle #{idx + 1}:</span>
                <span>{cycle.join(" → ")}</span>
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
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 space-y-4 max-h-[500px] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNodes.map((node) => {
            const incoming = dagReport.edges.filter((e) => e.to === node.id);
            const outgoing = dagReport.edges.filter((e) => e.from === node.id);
            const isCycleNode = dagReport.cycles.some((c) => c.includes(node.id));

            return (
              <div
                key={node.id}
                onClick={() => onSelectActivity && onSelectActivity(node.id)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                  isCycleNode
                    ? "bg-rose-950/40 border-rose-600 shadow-md shadow-rose-950 text-rose-100 ring-1 ring-rose-500"
                    : "bg-slate-800/80 border-slate-700 hover:border-cyan-500 hover:bg-slate-800 text-slate-200"
                }`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-white">{node.id}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-900 border border-slate-700 text-slate-400">
                      {node.contract_number}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                      node.priority === 1
                        ? "bg-rose-900/50 text-rose-300 border border-rose-700"
                        : node.priority === 2
                        ? "bg-cyan-900/50 text-cyan-300 border border-cyan-700"
                        : "bg-slate-700 text-slate-300"
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
                      <span className="text-amber-400 flex items-center gap-1">
                        Predecessor: {incoming.map((e) => e.from).join(", ")}
                      </span>
                    ) : (
                      <span className="text-slate-500">Root (No predecessor)</span>
                    )}
                  </div>
                  <div>
                    {outgoing.length > 0 && (
                      <span className="text-purple-400 flex items-center gap-1">
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
