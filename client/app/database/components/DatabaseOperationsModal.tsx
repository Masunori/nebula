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
  FileSpreadsheet,
  Check,
} from "lucide-react";
import type { ValidationReport } from "@/lib/types";

interface DatabaseOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidateUpload: (tier: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => ValidationReport;
  onFlushDatabase: () => void;
  onLoadPreset: (preset: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => void;
  onIngestFiles: (files: FileList | File[]) => Promise<{ count: number; tables: string[]; errors: string[] }>;
}

export function DatabaseOperationsModal({
  isOpen,
  onClose,
  onValidateUpload,
  onFlushDatabase,
  onLoadPreset,
  onIngestFiles,
}: DatabaseOperationsModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"presets" | "upload" | "partial" | "flush">("presets");
  const [selectedPreset, setSelectedPreset] = useState<"DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3">("DEFAULT");
  const [validationResult, setValidationResult] = useState<ValidationReport | null>(null);
  const [flushConfirm, setFlushConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ingestedSummary, setIngestedSummary] = useState<{ count: number; tables: string[]; errors: string[] } | null>(
    null
  );

  if (!isOpen) return null;

  const runDryRun = (tier: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => {
    setSelectedPreset(tier);
    const report = onValidateUpload(tier);
    setValidationResult(report);
  };

  const handleApplyPreset = () => {
    setIsProcessing(true);
    onLoadPreset(selectedPreset);
    setStatusMessage(`Successfully loaded ${selectedPreset} dataset into memory and PostgreSQL!`);
    setIsProcessing(false);
    setTimeout(() => {
      setStatusMessage(null);
      onClose();
    }, 1200);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage("Parsing CSV files and updating database tables...");
    const res = await onIngestFiles(e.target.files);
    setIngestedSummary(res);
    setIsProcessing(false);
    if (res.errors.length === 0) {
      setStatusMessage(`Ingested ${res.count} records across: ${res.tables.join(", ")}`);
    } else {
      setStatusMessage(`Ingested ${res.count} records with ${res.errors.length} warnings.`);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage("Parsing dropped CSV files and updating database tables...");
    const res = await onIngestFiles(e.dataTransfer.files);
    setIngestedSummary(res);
    setIsProcessing(false);
    if (res.errors.length === 0) {
      setStatusMessage(`Ingested ${res.count} records across: ${res.tables.join(", ")}`);
    } else {
      setStatusMessage(`Ingested ${res.count} records with ${res.errors.length} warnings.`);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog-box"
        style={{ maxWidth: 680, width: "100%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="dialog-header" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                padding: 6,
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--teal-50)",
                border: "1px solid var(--border-teal)",
                color: "var(--teal-700)",
              }}
            >
              <UploadCloud size={20} />
            </div>
            <div>
              <h2 className="dialog-title" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)" }}>
                Database Operations & Ingestion Center
              </h2>
              <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
                Load official datasets, ingest custom CSVs, swap individual work packages, or flush records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn--ghost btn--icon"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Subtabs */}
        <div style={{ padding: "8px 20px 12px 20px", borderBottom: "1px solid var(--border-default)" }}>
          <div className="seg-control" style={{ width: "100%" }}>
            <button
              onClick={() => setActiveSubTab("presets")}
              className={`seg-btn${activeSubTab === "presets" ? " active" : ""}`}
            >
              Benchmark Datasets
            </button>
            <button
              onClick={() => setActiveSubTab("upload")}
              className={`seg-btn${activeSubTab === "upload" ? " active" : ""}`}
            >
              Upload 8-CSV Files
            </button>
            <button
              onClick={() => setActiveSubTab("partial")}
              className={`seg-btn${activeSubTab === "partial" ? " active" : ""}`}
            >
              Surgical Swap
            </button>
            <button
              onClick={() => setActiveSubTab("flush")}
              className={`seg-btn${activeSubTab === "flush" ? " active" : ""}`}
            >
              Flush Database
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-4 text-xs">
          {statusMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-emerald-200 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Subtab 1: Presets & Benchmarks */}
          {activeSubTab === "presets" && (
            <div className="space-y-4">
              <p className="text-slate-400">
                Select an official or stress-tested synthetic dataset to load into the active database:
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
                    <strong className="text-white text-xs">Official Default Baseline</strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                      Official
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    2 Lines (ALP, BET), 20 Stations, 14 Contracts, 54 Activities. Clean DAG (0 cycles).
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
                    <strong className="text-white text-xs">Synthetic Tier 1 (Scaled)</strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                      3 Lines
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    3 Lines (ALP, BET, GAM), 30 Stations, 16 Contracts, 80 Activities.
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
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-bold font-mono">
                      Safety Audit
                    </span>
                  </div>
                  <p className="text-rose-300/80 text-[11px]">
                    Injects deliberate circular dependency loop (A004 ↔ A003) to test solver safeguards.
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
                    <strong className="text-white text-xs">Synthetic Tier 2 (Stress)</strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                      5 Lines
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    5 Lines, 50 Stations, 20 Contracts, 120 Activities.
                  </p>
                </div>
              </div>

              {/* Pre-Flight Scorecard Preview */}
              {validationResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">Pre-Flight Dry Run Check:</span>
                    <span className="text-emerald-400 font-mono">✓ Ready for Database Load</span>
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
                    disabled={isProcessing}
                    onClick={handleApplyPreset}
                    className="btn btn--primary"
                    style={{ width: "100%", justifyContent: "center", gap: 8, marginTop: 8 }}
                  >
                    <span>Load {selectedPreset} Into Active Database</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subtab 2: Full 8-CSV Upload Dropzone */}
          {activeSubTab === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="upload-dropzone"
                style={{ padding: "32px 16px" }}
              >
                <FolderOpen className="upload-icon" size={36} />
                <p className="upload-title" style={{ fontSize: 13, fontWeight: 600 }}>
                  Drag and drop your railway CSV files here
                </p>
                <p className="upload-hint" style={{ fontSize: 11, maxWidth: 440 }}>
                  Supports all 8 files: 01_LINES, 02_STATIONS, 03_SECTORS, 04_LOCATION_SUPPLY, 05_BUFFER_LOCATION, 06_PARAMETERS, 07_PROJECT_DETAILS, 08_ACTIVITY_DETAILS
                </p>
                <label className="btn btn--primary btn--sm" style={{ marginTop: 8, cursor: "pointer" }}>
                  Select CSV Files
                  <input
                    type="file"
                    multiple
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {ingestedSummary && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Total Records Ingested:</span>
                    <strong className="text-cyan-400">{ingestedSummary.count}</strong>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ingestedSummary.tables.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                  { file: "07_PROJECT_DETAILS.csv", desc: "Update contract terms, workfronts, and access caps" },
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
                    <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] cursor-pointer border border-slate-700 transition-colors">
                      Replace File
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
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
                Flushing will completely truncate all 8 database tables (`lines`, `stations`, `sectors`, `location_supply`, `buffer_rules`, `system_parameters`, `contracts`, `activities`).
              </p>
              <div className="pt-2">
                {!flushConfirm ? (
                  <button
                    onClick={() => setFlushConfirm(true)}
                    className="btn btn--danger"
                  >
                    <Trash2 size={15} />
                    <span>Initiate Database Flush</span>
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      onClick={() => {
                        onFlushDatabase();
                        setFlushConfirm(false);
                        setStatusMessage("Database successfully flushed. All records cleared.");
                        setTimeout(() => {
                          setStatusMessage(null);
                          onClose();
                        }, 1000);
                      }}
                      className="btn btn--danger"
                    >
                      <Trash2 size={15} />
                      <span>Confirm & Permanently Flush</span>
                    </button>
                    <button
                      onClick={() => setFlushConfirm(false)}
                      className="btn btn--secondary"
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
