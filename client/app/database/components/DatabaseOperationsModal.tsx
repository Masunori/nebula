"use client";

import React, { useState } from "react";
import {
  X,
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import type { ValidationReport } from "@/lib/types";

interface DatabaseOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidateUpload: (tier: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => ValidationReport;
  onFlushDatabase: () => void;
  onLoadDataset: (datasetName: string) => void;
}

export function DatabaseOperationsModal({
  isOpen,
  onClose,
  onValidateUpload,
  onFlushDatabase,
  onLoadDataset,
}: DatabaseOperationsModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"upload" | "partial" | "presets" | "flush">("presets");
  const [selectedPreset, setSelectedPreset] = useState<"DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3">("DEFAULT");
  const [validationResult, setValidationResult] = useState<ValidationReport | null>(null);
  const [flushConfirm, setFlushConfirm] = useState(false);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const runDryRun = (tier: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => {
    setSelectedPreset(tier);
    const report = onValidateUpload(tier);
    setValidationResult(report);
  };

  const handleApplyPreset = () => {
    if (selectedPreset === "DEFAULT") {
      onLoadDataset("Default Baseline (init_data/)");
    } else if (selectedPreset === "TIER_1") {
      onLoadDataset("Synthetic Tier 1 (3 Lines / 30 Stations)");
    } else if (selectedPreset === "TIER_2") {
      onLoadDataset("Synthetic Tier 2 (5 Lines / 50 Stations / 80 Activities)");
    } else if (selectedPreset === "TIER_3") {
      onLoadDataset("Synthetic Tier 3 (Fault Injected - DAG Cycle Active)");
    }
    setAppliedMessage(`Successfully loaded ${selectedPreset} dataset into memory!`);
    setTimeout(() => {
      setAppliedMessage(null);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Database Operations & Ingestion Center</h2>
              <p className="text-xs text-slate-400">
                Full 8-CSV ingestion, surgical single-file replacement, synthetic benchmarks, and flush
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

        {/* Modal Navigation Subtabs */}
        <div className="flex border-b border-slate-800 px-5 gap-2 text-xs pt-2">
          <button
            onClick={() => setActiveSubTab("presets")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all cursor-pointer ${
              activeSubTab === "presets"
                ? "border-cyan-400 text-cyan-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Dataset Switcher & Benchmarks
          </button>
          <button
            onClick={() => setActiveSubTab("upload")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all cursor-pointer ${
              activeSubTab === "upload"
                ? "border-cyan-400 text-cyan-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Full 8-CSV Upload
          </button>
          <button
            onClick={() => setActiveSubTab("partial")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all cursor-pointer ${
              activeSubTab === "partial"
                ? "border-cyan-400 text-cyan-300 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Partial / Granular File Swap
          </button>
          <button
            onClick={() => setActiveSubTab("flush")}
            className={`pb-2.5 px-3 font-medium border-b-2 transition-all cursor-pointer ${
              activeSubTab === "flush"
                ? "border-rose-500 text-rose-300 font-bold"
                : "border-transparent text-slate-400 hover:text-rose-400"
            }`}
          >
            Flush Database
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {appliedMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{appliedMessage}</span>
            </div>
          )}

          {/* Subtab 1: Presets & Benchmarks */}
          {activeSubTab === "presets" && (
            <div className="space-y-4">
              <p className="text-slate-400">
                Select a benchmark dataset to test scalability and validation safeguards:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Default Baseline */}
                <div
                  onClick={() => runDryRun("DEFAULT")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedPreset === "DEFAULT"
                      ? "bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/50"
                      : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5">
                    <strong className="text-white text-xs">Default Official Baseline</strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                      Standard
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    2 Lines (ALP, BET), 20 Stations, 14 Contracts, 54 Activities. Clean DAG with 0 cycles.
                  </p>
                </div>

                {/* Tier 1 */}
                <div
                  onClick={() => runDryRun("TIER_1")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedPreset === "TIER_1"
                      ? "bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/50"
                      : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5">
                    <strong className="text-white text-xs">Synthetic Tier 1</strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Medium Scale
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    3 Lines (ALP, BET, GAM), 30 Stations, 20 Contracts, 80 Activities.
                  </p>
                </div>

                {/* Tier 2 */}
                <div
                  onClick={() => runDryRun("TIER_2")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedPreset === "TIER_2"
                      ? "bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/50"
                      : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5">
                    <strong className="text-white text-xs">Synthetic Tier 2</strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                      Large Scale
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    5 Lines (A..E), 50 Stations, 30 Contracts, 150 Activities. Stress-tested network layout.
                  </p>
                </div>

                {/* Tier 3 (Fault Injected) */}
                <div
                  onClick={() => runDryRun("TIER_3")}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedPreset === "TIER_3"
                      ? "bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/50"
                      : "bg-slate-950/80 border-slate-800 hover:border-rose-900"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5">
                    <strong className="text-rose-300 text-xs flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Tier 3 (Fault Injected)
                    </strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-bold">
                      Safety Audit
                    </span>
                  </div>
                  <p className="text-rose-300/80 text-[11px]">
                    Injects deliberate circular dependency loop (A004 ↔ A003) and sector over-capacity.
                  </p>
                </div>
              </div>

              {/* Pre-Flight Scorecard Preview */}
              {validationResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">Pre-Flight Dry Run Scorecard:</span>
                    <span className="text-emerald-400 font-mono">✓ Schema Validated</span>
                  </div>

                  {validationResult.warnings.length > 0 && (
                    <div className="space-y-1">
                      {validationResult.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded bg-amber-950/60 border border-amber-800 text-amber-200 text-[11px] flex items-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleApplyPreset}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Load {selectedPreset} Into Database</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subtab 2: Full 8-CSV Upload Dropzone */}
          {activeSubTab === "upload" && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl bg-slate-950/50 flex flex-col items-center justify-center text-center space-y-2 cursor-pointer transition-colors">
                <FolderOpen className="w-8 h-8 text-cyan-400" />
                <p className="text-slate-200 font-medium text-xs">
                  Drag and drop a folder containing all 8 CSV files here
                </p>
                <p className="text-[11px] text-slate-500">
                  01_LINES, 02_STATIONS, 03_SECTORS, 04_LOCATION_SUPPLY, 05_BUFFER_LOCATION, 06_PARAMETERS, 07_PROJECT_DETAILS, 08_ACTIVITY_DETAILS
                </p>
                <label className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium text-xs cursor-pointer">
                  Browse Files
                  <input type="file" multiple className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* Subtab 3: Partial Granular Replacement */}
          {activeSubTab === "partial" && (
            <div className="space-y-3">
              <p className="text-slate-400">
                Surgically replace specific entities without wiping the underlying network topology:
              </p>
              <div className="space-y-2">
                {[
                  { file: "07_PROJECT_DETAILS.csv", desc: "Update contract descriptions, workfronts, and access caps" },
                  { file: "08_ACTIVITY_DETAILS.csv", desc: "Refresh activity work packages, dates, and predecessors" },
                  { file: "05_BUFFER_LOCATION.csv", desc: "Update safety buffer sector policies" },
                  { file: "06_PARAMETERS.csv", desc: "Update horizon start date and planning weeks" },
                ].map((item) => (
                  <div
                    key={item.file}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <strong className="text-white font-mono text-xs">{item.file}</strong>
                      <p className="text-slate-400 text-[11px]">{item.desc}</p>
                    </div>
                    <label className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] cursor-pointer">
                      Replace File
                      <input type="file" className="hidden" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtab 4: Flush Database */}
          {activeSubTab === "flush" && (
            <div className="p-6 rounded-xl bg-rose-950/30 border border-rose-900/60 space-y-4">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Caution: Flush All Database Records</span>
              </div>
              <p className="text-slate-300 text-xs">
                Flushing will truncate all 8 tables (`lines`, `stations`, `sectors`, `location_supply`, `buffer_rules`, `system_parameters`, `contracts`, `activities`).
              </p>
              <div className="pt-2">
                {!flushConfirm ? (
                  <button
                    onClick={() => setFlushConfirm(true)}
                    className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Initiate Database Flush</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        onFlushDatabase();
                        setFlushConfirm(false);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 cursor-pointer animate-pulse"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Confirm & Permanently Flush</span>
                    </button>
                    <button
                      onClick={() => setFlushConfirm(false)}
                      className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
