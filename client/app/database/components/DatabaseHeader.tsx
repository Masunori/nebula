"use client";

import React from "react";
import {
  Train,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Layers,
  Database,
  GitBranch,
  PlusCircle,
  RefreshCw,
  Compass,
} from "lucide-react";
import type { DatabaseOverview, TrackBound } from "@/lib/types";

interface DatabaseHeaderProps {
  overview: DatabaseOverview;
  activeTab: "topology" | "activities" | "dag" | "parameters" | "operations";
  setActiveTab: (tab: "topology" | "activities" | "dag" | "parameters" | "operations") => void;
  selectedBound: TrackBound;
  onToggleBound: () => void;
  onOpenCreateDrawer: () => void;
  onOpenOperationsModal: () => void;
}

export function DatabaseHeader({
  overview,
  activeTab,
  setActiveTab,
  selectedBound,
  onToggleBound,
  onOpenCreateDrawer,
  onOpenOperationsModal,
}: DatabaseHeaderProps) {
  const tabs = [
    { id: "topology", label: "Topology & Static Supply", icon: Train },
    { id: "activities", label: "Contracts & Workloads", icon: Layers },
    { id: "dag", label: "Predecessor DAG Graph", icon: GitBranch },
    { id: "parameters", label: "Rules & Parameters", icon: Calendar },
    { id: "operations", label: "Operations & Ingestion", icon: Database },
  ] as const;

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        {/* Top bar: Title & Quick Status Badges */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">NEBULAX</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-medium">
                  Database Studio
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  v2.0 (PostgreSQL Core)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Railway Infrastructure, Track Capacity & Safety Buffer Management Deck
              </p>
            </div>
          </div>

          {/* Quick Metrics & System Health Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Active Dataset Pill */}
            <div className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{overview.dataset_name}</span>
            </div>

            {/* Total Work Volume Pill */}
            <div className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center gap-1.5">
              <span className="text-slate-400">Work Volume:</span>
              <span className="font-semibold text-cyan-400 font-mono">
                {overview.total_work_volume} shifts
              </span>
            </div>

            {/* DAG Acyclicity Badge */}
            <div
              className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                overview.is_dag_valid
                  ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-300"
                  : "bg-rose-950/40 border-rose-700/50 text-rose-300 font-bold animate-pulse"
              }`}
            >
              {overview.is_dag_valid ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DAG Acyclic (0 Cycles)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>{overview.dag_cycle_count} DAG Cycle(s)</span>
                </>
              )}
            </div>

            {/* Bound Toggle Button */}
            <button
              onClick={onToggleBound}
              title="Click to toggle track direction"
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Track:</span>
              <span className="font-bold text-amber-400 font-mono">
                {selectedBound === "EB" ? "EB (Eastbound)" : "WB (Westbound)"}
              </span>
            </button>

            {/* [+ Add Activity] Action Button */}
            <button
              onClick={onOpenCreateDrawer}
              className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5 shadow-sm shadow-cyan-900/50 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Workload</span>
            </button>

            {/* [Upload / Flush] Operations Button */}
            <button
              onClick={onOpenOperationsModal}
              className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-300" />
              <span>Ingest / Flush</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-3.5 overflow-x-auto no-scrollbar border-t border-slate-800/80 pt-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
