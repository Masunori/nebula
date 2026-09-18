"use client";

import React, { useState } from "react";
import { Edit3, CheckCircle, Trash2, Rocket, Eye, X, ArrowRight } from "lucide-react";
import type { StagedChange } from "@/lib/types";

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

  const handleCommit = () => {
    onCommit();
    setCommitSuccess(true);
    setTimeout(() => {
      setCommitSuccess(false);
    }, 4000);
  };

  return (
    <>
      {/* Persistent Bottom Staging Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4 animate-in slide-in-from-bottom-5">
        <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/60 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {commitSuccess ? (
            <div className="flex items-center gap-2.5 text-emerald-300 font-medium">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>
                <strong>Database Committed!</strong> Handing off parameters and workload models to the Optimization Solver Engine...
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-white">Uncommitted Working Copy</strong>
                  <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-700 text-amber-300 font-mono font-bold">
                    {stagedChanges.length} staged change{stagedChanges.length > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
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
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Review Diff</span>
              </button>

              <button
                onClick={onDiscard}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700 text-slate-300 hover:text-rose-300 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>

              <button
                onClick={handleCommit}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-cyan-950 cursor-pointer transition-all"
              >
                <Rocket className="w-4 h-4" />
                <span>Commit & Trigger Solver 🚀</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review Diff Modal */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Review Staged Database Modifications</h3>
              </div>
              <button
                onClick={() => setShowDiffModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
              {stagedChanges.map((change) => (
                <div
                  key={change.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">{change.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                      {change.action} &middot; {change.entity_type}
                    </span>
                  </div>
                  <pre className="p-2 bg-slate-900 rounded text-[11px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(change.new_value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  setShowDiffModal(false);
                  handleCommit();
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Confirm Commit & Run Engine</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
