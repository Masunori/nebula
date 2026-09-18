"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
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
  Wrench,
  Briefcase,
  Eye,
  ChevronDown,
  User,
  Check,
  CalendarClock,
} from "lucide-react";
import type { DatabaseOverview, TrackBound, PersonaMode } from "@/lib/types";
import { DESIGN_TOKENS } from "@/lib/design-tokens";

interface DatabaseHeaderProps {
  overview: DatabaseOverview;
  activeTab: "topology" | "activities" | "dag" | "parameters" | "operations";
  setActiveTab: (tab: "topology" | "activities" | "dag" | "parameters" | "operations") => void;
  selectedBound: TrackBound;
  onToggleBound: () => void;
  personaMode: PersonaMode;
  onSelectPersona: (mode: PersonaMode) => void;
  onOpenCreateDrawer: () => void;
  onOpenOperationsModal: () => void;
}

export function DatabaseHeader({
  overview,
  activeTab,
  setActiveTab,
  selectedBound,
  onToggleBound,
  personaMode,
  onSelectPersona,
  onOpenCreateDrawer,
  onOpenOperationsModal,
}: DatabaseHeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: "topology", label: "Network Graph", icon: Train },
    { id: "activities", label: "Workloads & Contracts", icon: Layers },
    { id: "dag", label: "Predecessor DAG", icon: GitBranch },
    { id: "parameters", label: "Rules & Horizon", icon: Calendar },
    { id: "operations", label: "Ingestion & Flush", icon: Database },
  ] as const;

  const personas = [
    {
      id: "ALL",
      label: "All Stakeholders",
      roleTitle: "Global Dispatcher",
      icon: Eye,
      color: "var(--ink-900)",
      desc: "Unrestricted master view across all railway lines & contracts",
    },
    {
      id: "MAINTAINER",
      label: "In-House Maintainer (P1)",
      roleTitle: "Track Maintenance Lead",
      icon: Wrench,
      color: "var(--status-red)",
      desc: "Top priority possession, 750V Live rail cutoffs & emergency work",
    },
    {
      id: "PLANNER",
      label: "Possession Scheduler",
      roleTitle: "Commercial Works Planner",
      icon: Briefcase,
      color: "var(--teal-700)",
      desc: "Contract deliverables (C001–C014), weekly caps & co-sharing",
    },
    {
      id: "AUDITOR",
      label: "Safety Auditor",
      roleTitle: "Safety Compliance Officer",
      icon: ShieldCheck,
      color: "var(--status-green)",
      desc: "Acyclic DAG enforcement, zero buffer overlap & bottlenecks",
    },
  ] as const;

  const currentPersona = personas.find((p) => p.id === personaMode) || personas[0];
  const CurrentIcon = currentPersona.icon;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-default)",
        padding: "16px 0 12px 0",
        position: "sticky",
        top: 56,
        zIndex: 25,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: Workspace Title, Metrics, Actions & Persona Dropdown */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Workspace Title & Description */}
          <div className="flex items-center gap-3">
            <div
              style={{
                padding: 8,
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--teal-50)",
                border: "1px solid var(--border-teal)",
                color: "var(--teal-700)",
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight" style={{ color: "var(--ink-900)" }}>
                  NEBULAX Database Studio
                </h1>
                <span className="badge badge--valid">Live Repository</span>
                <span className="text-[11px] font-mono" style={{ color: "var(--ink-500)" }}>
                  v2.0
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--ink-500)" }}>
                Railway Infrastructure, Track Capacity & Safety Envelope Management
              </p>
            </div>
          </div>

          {/* Quick Metrics, Action Buttons & User Account Dropdown */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Active Dataset Pill */}
            <div
              className="px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5"
              style={{
                backgroundColor: "var(--bg-muted)",
                border: "1px solid var(--border-default)",
                color: "var(--ink-700)",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--status-green)" }}></span>
              <span className="truncate max-w-[140px] sm:max-w-none">{overview.dataset_name}</span>
            </div>

            {/* Total Work Volume Pill */}
            <div
              className="px-2.5 py-1 rounded-md font-mono flex items-center gap-1.5"
              style={{
                backgroundColor: "var(--bg-muted)",
                border: "1px solid var(--border-default)",
                color: "var(--ink-700)",
              }}
            >
              <span style={{ color: "var(--ink-500)" }}>Shifts:</span>
              <strong style={{ color: "var(--teal-700)" }}>{overview.total_work_volume}</strong>
            </div>

            {/* DAG Acyclicity Badge */}
            <div
              className="px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5"
              style={{
                backgroundColor: overview.is_dag_valid ? "var(--status-green-bg)" : "var(--status-red-bg)",
                border: `1px solid ${overview.is_dag_valid ? "var(--status-green-border)" : "var(--status-red-border)"}`,
                color: overview.is_dag_valid ? "var(--status-green)" : "var(--status-red)",
              }}
            >
              {overview.is_dag_valid ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">0 Cycles</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{overview.dag_cycle_count} Cycle(s)</span>
                </>
              )}
            </div>

            {/* Track Bound Toggle Button */}
            <button
              onClick={onToggleBound}
              title="Toggle active track direction"
              className="btn btn--secondary btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Compass size={13} style={{ color: "var(--orange-500)" }} />
              <span>Track:</span>
              <strong className="font-mono" style={{ color: "var(--orange-500)" }}>{selectedBound}</strong>
            </button>

            {/* Link to Master Schedule */}
            <Link
              href="/schedule"
              className="btn btn--secondary btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Open full possession schedule & Gantt timeline"
            >
              <CalendarClock size={13} style={{ color: "var(--teal-700)" }} />
              <span>Master Schedule</span>
            </Link>

            {/* [+ New Workload] Action */}
            <button
              onClick={onOpenCreateDrawer}
              className="btn btn--secondary btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <PlusCircle size={13} />
              <span>+ Workload</span>
            </button>

            {/* [Ingest / Flush] Action */}
            <button
              onClick={onOpenOperationsModal}
              className="btn btn--primary btn--sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={13} />
              <span>Ingest / Flush</span>
            </button>

            {/* Enterprise User Account Role Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="btn btn--secondary btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <CurrentIcon size={14} style={{ color: currentPersona.color }} />
                <span className="hidden sm:inline font-semibold">{currentPersona.label}</span>
                <ChevronDown size={12} style={{ color: "var(--ink-500)" }} />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div
                  className="dialog-box"
                  style={{
                    position: "absolute",
                    right: 0,
                    marginTop: 8,
                    width: 280,
                    padding: 8,
                    zIndex: 60,
                    boxShadow: "var(--shadow-lg)",
                  }}
                >
                  <div style={{ padding: "6px 8px 8px 8px", borderBottom: "1px solid var(--border-default)", marginBottom: 6 }}>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-500)", fontWeight: 600 }}>
                      Current Role View
                    </p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-900)" }}>{currentPersona.roleTitle}</p>
                  </div>

                  {personas.map((p) => {
                    const Icon = p.icon;
                    const isSelected = personaMode === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectPersona(p.id as PersonaMode);
                          setUserMenuOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          textAlign: "left",
                          backgroundColor: isSelected ? "var(--teal-50)" : "transparent",
                          border: isSelected ? "1px solid var(--border-teal)" : "1px solid transparent",
                          cursor: "pointer",
                          marginBottom: 4,
                        }}
                      >
                        <Icon size={16} style={{ color: p.color, marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-900)" }}>{p.label}</span>
                            {isSelected && <Check size={14} style={{ color: "var(--teal-700)" }} />}
                          </div>
                          <p style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2, lineHeight: 1.3 }}>{p.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation Row */}
        <div style={{ marginTop: 12, overflowX: "auto" }} className="no-scrollbar">
          <div className="seg-control" style={{ display: "inline-flex", width: "auto" }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`seg-btn${isActive ? " active" : ""}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12 }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
