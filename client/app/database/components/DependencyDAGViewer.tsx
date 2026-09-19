"use client";

import React, { useMemo, useState } from "react";
import { GitBranch, ShieldAlert, ShieldCheck, Scissors, ArrowRight } from "lucide-react";
import type { DAGReport, Activity } from "@/lib/types";

interface DependencyDAGViewerProps {
  dagReport: DAGReport;
  activities: Activity[];
  onSelectActivity?: (activityId: string) => void;
  onBreakCycle?: (cycle: string[]) => void;
}

export function DependencyDAGViewer({
  dagReport,
  activities,
  onSelectActivity,
  onBreakCycle,
}: DependencyDAGViewerProps) {
  const [filterMode, setFilterMode] = useState<"ALL" | "ROOT" | "DEPENDENT">("ALL");
  const [selectedContract, setSelectedContract] = useState<string>("ALL");

  const contracts = useMemo(() => {
    return Array.from(new Set(activities.map((a) => a.contract_number))).sort();
  }, [activities]);

  // Filter nodes based on user options
  const filteredNodes = useMemo(() => {
    return dagReport.nodes.filter((node) => {
      if (selectedContract !== "ALL" && node.contract_number !== selectedContract) {
        return false;
      }
      if (filterMode === "ROOT") {
        return !dagReport.edges.some((e) => e.to === node.id);
      }
      if (filterMode === "DEPENDENT") {
        return (
          dagReport.edges.some((e) => e.to === node.id) ||
          dagReport.edges.some((e) => e.from === node.id)
        );
      }
      return true;
    });
  }, [dagReport, filterMode, selectedContract]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Filter Console */}
      <div
        className="rounded-2xl border transition-all"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
          padding: "24px 28px",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              <GitBranch size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--ink-900)" }}>
                Predecessor DAG Dependency Structure
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
                Structural precedence constraints (FS+0) and real-time circular dependency cycle audit
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick filter segmented control */}
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
              className="px-3 py-2 text-xs rounded-lg font-mono cursor-pointer transition-all"
              style={{
                backgroundColor: "var(--bg-page)",
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
      </div>

      {/* 2. Cycle Detection Alert Banner */}
      {dagReport.has_cycles ? (
        <div
          className="p-5 rounded-2xl border space-y-4"
          style={{
            backgroundColor: "var(--status-red-bg)",
            borderColor: "var(--status-red-border)",
            color: "var(--status-red)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm font-bold">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span>CRITICAL ERROR: Circular Predecessor Dependency Detected! ({dagReport.cycle_count} cycle(s))</span>
            </div>
            {onBreakCycle && (
              <button
                onClick={() => onBreakCycle(dagReport.cycles[0])}
                className="btn btn--danger btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Scissors size={14} />
                <span>Auto-Break Cycle</span>
              </button>
            )}
          </div>
          <p className="text-xs">
            The optimization engine requires a strict Directed Acyclic Graph (DAG). Predecessor cycles make scheduling mathematically impossible.
          </p>
          <div
            className="p-3.5 rounded-xl border font-mono text-xs space-y-2"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--status-red-border)",
            }}
          >
            {dagReport.cycles.map((cycle, idx) => (
              <div key={idx} className="flex items-center gap-2 font-semibold">
                <span className="font-bold">Cycle #{idx + 1}:</span>
                <span className="px-2.5 py-1 rounded bg-rose-100 border border-rose-300">
                  {cycle.join(" ➔ ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{
            backgroundColor: "var(--status-green-bg)",
            borderColor: "var(--status-green-border)",
            color: "var(--status-green)",
          }}
        >
          <div className="flex items-center gap-2.5 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              <strong>Predecessor Graph Valid</strong> &middot; 0 circular dependencies detected across {dagReport.nodes.length} activities.
            </span>
          </div>
          <span className="font-mono font-semibold opacity-90">
            {dagReport.edges.length} Dependency Edges &middot; {dagReport.independent_activities_count} Independent
          </span>
        </div>
      )}

      {/* 3. Dependency Visual Tree / Node Cards */}
      <div
        className="rounded-2xl border transition-all"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 4px 20px -2px rgba(15, 25, 35, 0.04)",
          padding: "28px 32px",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNodes.map((node) => {
            const incoming = dagReport.edges.filter((e) => e.to === node.id);
            const outgoing = dagReport.edges.filter((e) => e.from === node.id);
            const isCycleNode = dagReport.cycles.some((c) => c.includes(node.id));

            return (
              <div
                key={node.id}
                onClick={() => onSelectActivity && onSelectActivity(node.id)}
                className="cursor-pointer p-5 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  border: isCycleNode ? "2px solid var(--status-red)" : "1px solid var(--border-default)",
                  backgroundColor: isCycleNode ? "var(--status-red-bg)" : "var(--bg-page)",
                }}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border-default)" }}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm" style={{ color: "var(--ink-900)" }}>
                      {node.id}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold"
                      style={{
                        backgroundColor: "var(--bg-muted)",
                        border: "1px solid var(--border-default)",
                        color: "var(--ink-700)",
                      }}
                    >
                      {node.contract_number}
                    </span>
                  </div>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono"
                    style={{
                      backgroundColor:
                        node.priority === 1
                          ? "var(--status-red-bg)"
                          : node.priority === 2
                          ? "var(--teal-050)"
                          : "var(--status-green-bg)",
                      border: `1px solid ${
                        node.priority === 1
                          ? "var(--status-red-border)"
                          : node.priority === 2
                          ? "var(--border-teal)"
                          : "var(--status-green-border)"
                      }`,
                      color:
                        node.priority === 1
                          ? "var(--status-red)"
                          : node.priority === 2
                          ? "var(--teal-700)"
                          : "var(--status-green)",
                    }}
                  >
                    Priority {node.priority}
                  </span>
                </div>

                {/* Body Details */}
                <div className="py-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between" style={{ color: "var(--ink-600)" }}>
                    <span>Reach:</span>
                    <span className="font-mono font-semibold" style={{ color: "var(--ink-900)" }}>
                      {node.station_from} → {node.station_to} ({node.line_code})
                    </span>
                  </div>
                  <div className="flex items-center justify-between" style={{ color: "var(--ink-600)" }}>
                    <span>Volume:</span>
                    <span className="font-mono font-bold" style={{ color: "var(--teal-700)" }}>
                      {node.total_accesses} night shifts
                    </span>
                  </div>
                </div>

                {/* Precedence Chain Footer */}
                <div className="pt-3 border-t text-xs font-mono flex items-center justify-between" style={{ borderColor: "var(--border-default)" }}>
                  <div>
                    {incoming.length > 0 ? (
                      <span
                        className="px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1"
                        style={{
                          backgroundColor: "var(--status-amber-bg)",
                          border: "1px solid var(--status-amber-border)",
                          color: "var(--orange-700)",
                        }}
                      >
                        FS+0: {incoming.map((e) => e.from).join(", ")}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: "var(--ink-400)" }}>
                        Root (No predecessor)
                      </span>
                    )}
                  </div>
                  <div>
                    {outgoing.length > 0 && (
                      <span
                        className="px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1"
                        style={{
                          backgroundColor: "#f5f3ff",
                          border: "1px solid #ddd6fe",
                          color: "#6d28d9",
                        }}
                      >
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
