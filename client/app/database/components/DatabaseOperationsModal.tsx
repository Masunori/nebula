"use client";

import React, { useState } from "react";
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Trash2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import type { ValidationReport } from "@/lib/types";

interface DatabaseOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidateUpload: (datasetType: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => ValidationReport;
  onFlushDatabase: () => Promise<void>;
  onLoadPreset: (preset: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => Promise<void>;
  onIngestFiles: (files: File[] | FileList) => Promise<{ count: number; tables: string[]; errors: string[] }>;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [flushConfirm, setFlushConfirm] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationReport | null>(null);
  const [ingestedSummary, setIngestedSummary] = useState<{ count: number; tables: string[]; errors: string[] } | null>(null);

  if (!isOpen) return null;

  // Run validation dry-run via store
  const runDryRun = (presetKey: "DEFAULT" | "TIER_1" | "TIER_2" | "TIER_3") => {
    setSelectedPreset(presetKey);
    const report = onValidateUpload(presetKey);
    setValidationResult(report);
  };

  const handleApplyPreset = async () => {
    setIsProcessing(true);
    setStatusMessage(`Applying ${selectedPreset} dataset into active database...`);
    await onLoadPreset(selectedPreset);
    setIsProcessing(false);
    setStatusMessage(`Successfully loaded ${selectedPreset} into database!`);
    setTimeout(() => {
      setStatusMessage(null);
      onClose();
    }, 1200);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessing(true);
    setStatusMessage("Ingesting and parsing uploaded CSV files...");
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
        className="dialog-box rounded-2xl border"
        style={{
          maxWidth: 780,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          boxShadow: "0 20px 40px -10px rgba(15, 25, 35, 0.16)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="dialog-header" style={{ padding: "20px 28px", borderBottom: "1px solid var(--border-default)" }}>
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
              <UploadCloud size={22} />
            </div>
            <div>
              <h2 className="dialog-title text-base font-bold" style={{ color: "var(--ink-900)" }}>
                Database Operations & Ingestion Center
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>
                Load official datasets, ingest custom CSVs, swap individual work packages, or flush records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Subtabs */}
        <div style={{ padding: "12px 28px", borderBottom: "1px solid var(--border-default)", backgroundColor: "var(--bg-page)" }}>
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
        <div className="p-7 space-y-6 text-xs">
          {statusMessage && (
            <div
              className="p-4 rounded-xl border flex items-center gap-2.5 animate-in fade-in"
              style={{
                backgroundColor: "var(--status-green-bg)",
                borderColor: "var(--status-green-border)",
                color: "var(--status-green)",
              }}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="font-medium text-xs">{statusMessage}</span>
            </div>
          )}

          {/* Subtab 1: Presets & Benchmarks */}
          {activeSubTab === "presets" && (
            <div className="space-y-5">
              <p className="text-xs" style={{ color: "var(--ink-600)" }}>
                Select an official or stress-tested synthetic dataset to load into the active database:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Default Baseline */}
                <div
                  onClick={() => runDryRun("DEFAULT")}
                  className="p-4 rounded-xl border transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedPreset === "DEFAULT" ? "var(--teal-050)" : "var(--bg-page)",
                    borderColor: selectedPreset === "DEFAULT" ? "var(--teal-600)" : "var(--border-default)",
                    boxShadow: selectedPreset === "DEFAULT" ? "0 4px 12px rgba(13, 148, 136, 0.12)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between pb-2">
                    <strong className="text-xs font-bold" style={{ color: "var(--ink-900)" }}>
                      Official Default Baseline
                    </strong>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
                      style={{
                        backgroundColor: "var(--teal-100)",
                        color: "var(--teal-800)",
                        border: "1px solid var(--border-teal)",
                      }}
                    >
                      Official
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--ink-500)" }}>
                    2 Lines (ALP, BET), 20 Stations, 14 Contracts, 54 Activities. Clean DAG (0 cycles).
                  </p>
                </div>

                {/* Tier 1 */}
                <div
                  onClick={() => runDryRun("TIER_1")}
                  className="p-4 rounded-xl border transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedPreset === "TIER_1" ? "var(--teal-050)" : "var(--bg-page)",
                    borderColor: selectedPreset === "TIER_1" ? "var(--teal-600)" : "var(--border-default)",
                    boxShadow: selectedPreset === "TIER_1" ? "0 4px 12px rgba(13, 148, 136, 0.12)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between pb-2">
                    <strong className="text-xs font-bold" style={{ color: "var(--ink-900)" }}>
                      Synthetic Tier 1 (Scaled)
                    </strong>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
                      style={{
                        backgroundColor: "var(--bg-muted)",
                        color: "var(--ink-700)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      3 Lines
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--ink-500)" }}>
                    3 Lines (ALP, BET, GAM), 30 Stations, 16 Contracts, 80 Activities.
                  </p>
                </div>

                {/* Tier 3 (Fault Injected) */}
                <div
                  onClick={() => runDryRun("TIER_3")}
                  className="p-4 rounded-xl border transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedPreset === "TIER_3" ? "var(--status-red-bg)" : "var(--bg-page)",
                    borderColor: selectedPreset === "TIER_3" ? "var(--status-red-border)" : "var(--border-default)",
                    boxShadow: selectedPreset === "TIER_3" ? "0 4px 12px rgba(225, 29, 72, 0.12)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between pb-2">
                    <strong className="text-xs font-bold flex items-center gap-1.5 text-rose-700">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Tier 3 (Fault Injected)
                    </strong>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-700 font-bold font-mono">
                      Safety Audit
                    </span>
                  </div>
                  <p className="text-rose-600/90 text-[11px]">
                    Injects deliberate circular dependency loop (A004 ↔ A003) to test solver safeguards.
                  </p>
                </div>

                {/* Tier 2 */}
                <div
                  onClick={() => runDryRun("TIER_2")}
                  className="p-4 rounded-xl border transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedPreset === "TIER_2" ? "var(--teal-050)" : "var(--bg-page)",
                    borderColor: selectedPreset === "TIER_2" ? "var(--teal-600)" : "var(--border-default)",
                    boxShadow: selectedPreset === "TIER_2" ? "0 4px 12px rgba(13, 148, 136, 0.12)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between pb-2">
                    <strong className="text-xs font-bold" style={{ color: "var(--ink-900)" }}>
                      Synthetic Tier 2 (Stress)
                    </strong>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
                      style={{
                        backgroundColor: "var(--status-green-bg)",
                        color: "var(--status-green)",
                        border: "1px solid var(--status-green-border)",
                      }}
                    >
                      5 Lines
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--ink-500)" }}>
                    5 Lines (ALP, BET, GAM, DEL, EPS), 50 Stations, 20 Contracts, 100+ Activities.
                  </p>
                </div>
              </div>

              {/* Pre-Flight Scorecard Preview */}
              {validationResult && (
                <div
                  className="p-5 rounded-xl border space-y-3"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold" style={{ color: "var(--ink-900)" }}>
                      Pre-Flight Dry Run Check:
                    </span>
                    <span className="font-mono font-semibold" style={{ color: validationResult.is_valid ? "var(--teal-700)" : "var(--status-red)" }}>
                      {validationResult.is_valid ? "✓ Ready for Database Load" : "⚠ Validation Issues Found"}
                    </span>
                  </div>

                  {validationResult.warnings && validationResult.warnings.length > 0 && (
                    <div className="space-y-1.5">
                      {validationResult.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border text-xs flex items-center gap-2"
                          style={{
                            backgroundColor: "var(--status-amber-bg)",
                            borderColor: "var(--status-amber-border)",
                            color: "var(--orange-800)",
                          }}
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    disabled={isProcessing}
                    onClick={handleApplyPreset}
                    className="btn btn--primary"
                    style={{ width: "100%", justifyContent: "center", gap: 8, padding: "10px 18px", marginTop: 8 }}
                  >
                    <span>Load {selectedPreset} Into Active Database</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subtab 2: Full 8-CSV Upload Dropzone */}
          {activeSubTab === "upload" && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="upload-dropzone rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-page)",
                  borderColor: "var(--border-default)",
                }}
              >
                <FolderOpen className="mx-auto mb-3" size={40} style={{ color: "var(--teal-600)" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--ink-900)" }}>
                  Drag and drop your railway CSV files here
                </p>
                <p className="text-xs mt-1.5 max-w-md mx-auto" style={{ color: "var(--ink-500)" }}>
                  Supports all 8 files: 01_LINES, 02_STATIONS, 03_SECTORS, 04_LOCATION_SUPPLY, 05_BUFFER_LOCATION, 06_PARAMETERS, 07_PROJECT_DETAILS, 08_ACTIVITY_DETAILS
                </p>
                <label className="btn btn--primary btn--sm inline-flex items-center gap-2 mt-4 cursor-pointer">
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
                <div
                  className="p-4 rounded-xl border space-y-2"
                  style={{
                    backgroundColor: "var(--bg-page)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span style={{ color: "var(--ink-500)" }}>Total Records Ingested:</span>
                    <strong style={{ color: "var(--teal-700)" }}>{ingestedSummary.count}</strong>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {ingestedSummary.tables.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded font-mono text-xs font-semibold"
                        style={{
                          backgroundColor: "var(--bg-muted)",
                          border: "1px solid var(--border-default)",
                          color: "var(--ink-800)",
                        }}
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
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--ink-600)" }}>
                Surgically replace specific entities without wiping the underlying network topology:
              </p>
              <div className="space-y-3">
                {[
                  { file: "07_PROJECT_DETAILS.csv", desc: "Update contract terms, workfronts, and access caps" },
                  { file: "08_ACTIVITY_DETAILS.csv", desc: "Refresh activity work packages, dates, and predecessors" },
                  { file: "05_BUFFER_LOCATION.csv", desc: "Update safety buffer sector policies" },
                  { file: "06_PARAMETERS.csv", desc: "Update horizon start date and planning weeks" },
                ].map((item) => (
                  <div
                    key={item.file}
                    className="p-4 rounded-xl border flex items-center justify-between transition-all"
                    style={{
                      backgroundColor: "var(--bg-page)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <div>
                      <strong className="font-mono text-xs font-bold" style={{ color: "var(--ink-900)" }}>
                        {item.file}
                      </strong>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-500)" }}>
                        {item.desc}
                      </p>
                    </div>
                    <label className="btn btn--secondary btn--sm cursor-pointer">
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
            <div
              className="p-6 rounded-2xl border space-y-4"
              style={{
                backgroundColor: "var(--status-red-bg)",
                borderColor: "var(--status-red-border)",
              }}
            >
              <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--status-red)" }}>
                <AlertTriangle className="w-5 h-5" />
                <span>Caution: Flush All Database Records</span>
              </div>
              <p className="text-xs" style={{ color: "var(--ink-700)" }}>
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
                  <div className="flex items-center gap-3">
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
