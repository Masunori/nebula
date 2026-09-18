"use client";

import React, { useState } from "react";
import { Edit3, CheckCircle, Trash2, Rocket, Eye, X, ArrowRight, Layers, Sliders } from "lucide-react";
import type { StagedChange } from "@/lib/types";
import { DESIGN_TOKENS } from "@/lib/design-tokens";

interface StagedChangesBarProps {
  stagedChanges: StagedChange[];
  onCommit: () => void;
  onDiscard: () => void;
}

export function StagedChangesBar({
  stagedChanges,
  onCommit,
  onDiscard,
}: StagedChangesBarProps) {
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);

  if (stagedChanges.length === 0 && !commitSuccess) return null;

  const actCount = stagedChanges.filter((c) => c.entity_type === "ACTIVITY").length;
  const paramCount = stagedChanges.filter(
    (c) => c.entity_type === "PARAMETER" || c.entity_type === "BUFFER_RULE"
  ).length;

  const handleCommit = () => {
    onCommit();
    setCommitSuccess(true);
    setTimeout(() => {
      setCommitSuccess(false);
    }, 4500);
  };

  return (
    <>
      {/* Persistent Bottom Staging Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4 animate-in slide-in-from-bottom-5">
        <div
          className="section"
          style={{
            padding: 16,
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-xl)",
            border: "1px solid var(--orange-500)",
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {commitSuccess ? (
            <div className="flex items-center gap-2.5" style={{ color: "var(--teal-700)", fontWeight: 500 }}>
              <CheckCircle size={20} style={{ color: "var(--status-green)" }} />
              <span>
                <strong>Database Transaction Committed!</strong> Handing off parameters and workload models to the Optimization Solver Engine...
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  padding: 8,
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  color: "var(--orange-500)",
                }}
              >
                <Edit3 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <strong style={{ color: "var(--ink-900)" }}>Uncommitted Working Copy</strong>
                  <span className="badge badge--pending font-mono">
                    {stagedChanges.length} staged change{stagedChanges.length > 1 ? "s" : ""}
                  </span>
                  {actCount > 0 && (
                    <span className="chip chip--contract font-mono text-[10px] flex items-center gap-1">
                      <Layers size={10} />
                      <span>{actCount} activities</span>
                    </span>
                  )}
                  {paramCount > 0 && (
                    <span className="chip chip--alp font-mono text-[10px] flex items-center gap-1">
                      <Sliders size={10} />
                      <span>{paramCount} rules/params</span>
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2 }}>
                  Modifications are staged in local draft. Commit to write to PostgreSQL and trigger solver engine.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!commitSuccess && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowDiffModal(true)}
                className="btn btn--secondary btn--sm"
              >
                <Eye size={14} />
                <span>Review Diff</span>
              </button>

              <button
                onClick={onDiscard}
                className="btn btn--danger btn--sm"
              >
                <Trash2 size={14} />
                <span>Discard</span>
              </button>

              <button
                onClick={handleCommit}
                className="btn btn--primary btn--sm"
              >
                <Rocket size={14} />
                <span>Commit & Trigger Solver 🚀</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review Diff Modal */}
      {showDiffModal && (
        <div className="dialog-backdrop" onClick={() => setShowDiffModal(false)}>
          <div
            className="dialog-box"
            style={{ maxWidth: 640, width: "100%", maxHeight: "80vh", overflowY: "auto", padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header">
              <div className="flex items-center gap-2">
                <Edit3 size={18} style={{ color: "var(--teal-700)" }} />
                <h3 className="dialog-title">Review Staged Database Modifications</h3>
              </div>
              <button
                onClick={() => setShowDiffModal(false)}
                className="btn btn--ghost btn--icon"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pt-3">
              {stagedChanges.map((change) => (
                <div
                  key={change.id}
                  style={{
                    padding: 12,
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-muted)",
                    border: "1px solid var(--border-default)",
                  }}
                  className="space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: "var(--teal-700)" }}>{change.title}</span>
                    <span className="badge badge--pending text-[10px]">
                      {change.action} &middot; {change.entity_type}
                    </span>
                  </div>
                  <pre
                    style={{
                      padding: 8,
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      fontSize: 11,
                      color: "var(--ink-700)",
                    }}
                    className="overflow-x-auto"
                  >
                    {JSON.stringify(change.new_value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>

            <div className="dialog-footer" style={{ marginTop: 16 }}>
              <button
                onClick={() => setShowDiffModal(false)}
                className="btn btn--secondary btn--sm"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  setShowDiffModal(false);
                  handleCommit();
                }}
                className="btn btn--primary btn--sm"
              >
                <Rocket size={14} />
                <span>Confirm Commit & Run Engine</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
