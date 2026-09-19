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
  Check,
  CalendarClock,
  Activity as ActivityIcon,
  HardDrive,
} from "lucide-react";
import type { DatabaseOverview, TrackBound, PersonaMode } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { DatabaseStatusBadge } from "@/components/ui/DatabaseStatusBadge";

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
      color: "var(--ink-700)",
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
    <>
      {/* 1. Standard RailSync Run Header Container */}
      <div className="run-header" style={{ marginBottom: "var(--space-4)" }}>
        <div className="run-header-meta">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="chip chip--pc" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Database size={13} /> Database Studio
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                PostgreSQL Live · Horizon CW01–CW30 2027
              </span>
            </div>
            <h1 className="page-title">Railway Network & Possession Database</h1>
            <p className="page-subtitle">
              Dual-track network topology, spatial safety buffer envelopes, and commercial contract workloads
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <DatabaseStatusBadge />

            {/* Track Bound Toggle */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Compass size={14} style={{ color: "var(--orange-500)" }} />}
              onClick={onToggleBound}
              title="Toggle active track direction (Eastbound / Westbound)"
            >
              Track:{" "}
              <span style={{ color: "var(--orange-600)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                {selectedBound}
              </span>
            </Button>

            {/* Role Persona Switcher */}
            <div className="relative" ref={menuRef}>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CurrentIcon size={14} style={{ color: currentPersona.color }} />}
                rightIcon={<ChevronDown size={13} style={{ color: "var(--ink-500)" }} />}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                title="Filter view by railway operational role"
              >
                {currentPersona.label}
              </Button>

              {userMenuOpen && (
                <div
                  className="dialog-box"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 6px)",
                    width: 320,
                    padding: 8,
                    zIndex: 60,
                    boxShadow: "var(--shadow-lg)",
                  }}
                >
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-default)", marginBottom: 6 }}>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-500)", fontWeight: 700 }}>
                      Current Role View
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-900)", marginTop: 2 }}>
                      {currentPersona.roleTitle}
                    </p>
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
                          padding: "8px 12px",
                          borderRadius: "var(--radius-md)",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          textAlign: "left",
                          backgroundColor: isSelected ? "var(--teal-050)" : "transparent",
                          border: isSelected ? "1px solid var(--border-teal)" : "1px solid transparent",
                          cursor: "pointer",
                          marginBottom: 3,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Icon size={15} style={{ color: p.color, marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-900)" }}>{p.label}</span>
                            {isSelected && <Check size={13} style={{ color: "var(--teal-700)" }} />}
                          </div>
                          <p style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 1, lineHeight: 1.3 }}>{p.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Master Schedule Link */}
            <Link href="/schedule">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CalendarClock size={14} style={{ color: "var(--teal-700)" }} />}
                title="View master possession schedule timetable"
              >
                Master Schedule
              </Button>
            </Link>

            {/* Ingest / Flush Modal Trigger */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={onOpenOperationsModal}
              title="Ingest CSV datasets or flush tables"
            >
              Ingest / Flush
            </Button>

            {/* + New Workload Drawer Trigger */}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PlusCircle size={14} />}
              onClick={onOpenCreateDrawer}
              title="Add a new workload activity"
            >
              + Workload
            </Button>
          </div>
        </div>

        {/* Studio Navigation Tabs inside Run Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-default)" }}>
          <div className="seg-control" role="tablist" aria-label="Database Studio Sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`seg-btn${isActive ? " active" : ""}`}
                  role="tab"
                  aria-selected={isActive}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Standard RailSync Operational Telemetry Bar */}
      <div
        className="ops-summary"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: "var(--space-6)",
        }}
      >
        <div className="ops-summary-item">
          <div className="ops-summary-label">
            <HardDrive size={13} /> Active Dataset
          </div>
          <div className="ops-summary-value">
            <span style={{ color: "var(--teal-600)" }}>●</span>{" "}
            <span className="font-mono">{overview.dataset_name}</span>{" "}
            <span style={{ fontSize: 12, color: "var(--ink-500)", fontWeight: "normal" }}>
              ({overview.lines_count ?? overview.line_count ?? 2} Lines · {overview.stations_count ?? 20} Stations)
            </span>
          </div>
        </div>

        <div className="ops-summary-item">
          <div className="ops-summary-label">
            <ActivityIcon size={13} /> Workload Volume
          </div>
          <div className="ops-summary-value font-mono">
            {overview.total_work_volume}{" "}
            <span style={{ fontSize: 12, color: "var(--ink-500)", fontWeight: "normal" }}>
              shifts across {overview.activities_count} activities
            </span>
          </div>
        </div>

        <div className="ops-summary-item">
          <div className="ops-summary-label">
            {overview.is_dag_valid ? (
              <ShieldCheck size={13} style={{ color: "var(--status-green)" }} />
            ) : (
              <ShieldAlert size={13} style={{ color: "var(--status-red)" }} />
            )}
            Predecessor Graph
          </div>
          <div className={`ops-summary-value ${!overview.is_dag_valid ? "critical" : ""}`}>
            {overview.is_dag_valid ? (
              <span style={{ color: "var(--status-green)" }}>✓ Acyclic (0 Cycles)</span>
            ) : (
              <span style={{ color: "var(--status-red)" }}>⚠ {overview.dag_cycle_count} Cycle(s) Detected</span>
            )}
          </div>
        </div>

        <div className="ops-summary-item">
          <div className="ops-summary-label">
            <Compass size={13} /> Active Direction
          </div>
          <div
            className="ops-summary-value"
            style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            onClick={onToggleBound}
            title="Click to toggle track bound"
          >
            <span style={{ color: "var(--orange-600)", fontFamily: "var(--font-mono)" }}>
              {selectedBound === "EB" ? "Eastbound (EB)" : "Westbound (WB)"}
            </span>
            <span className="chip chip--rule" style={{ cursor: "pointer" }}>Toggle ⇄</span>
          </div>
        </div>
      </div>
    </>
  );
}
