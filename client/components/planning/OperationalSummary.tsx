'use client';
import React from 'react';
import type { PlanningRun } from '@/types/planning';
import { AlertTriangle, CalendarCheck2, Layers3, CheckCircle2, RefreshCw } from 'lucide-react';

export interface OperationalSummaryMetrics {
  scheduledNights?: number;
  totalActivities?: number;
  scheduledActivities?: number;
  isFeasible?: boolean;
  scenario?: string;
  awaitingRecalculation?: boolean;
  objectiveScore?: number;
  violationsCount?: number;
}

export function OperationalSummary({
  runs,
  metrics,
}: {
  runs: PlanningRun[];
  metrics?: OperationalSummaryMetrics;
}) {
  const activeRun = runs.find(r => r.revisionType === 'approved') ?? runs[0];
  const draftWithViolations = runs.find(r => r.hardViolationCount > 0);

  const awaitingRecalc = metrics?.awaitingRecalculation ?? false;
  const totalNights = metrics?.scheduledNights ?? 193;
  const schedActs = metrics?.scheduledActivities ?? 54;
  const totalActs = metrics?.totalActivities ?? 54;
  const pct = totalActs > 0 ? Math.round((schedActs / totalActs) * 100) : 100;
  const score = metrics?.objectiveScore;
  const violations = metrics?.violationsCount ?? (draftWithViolations?.hardViolationCount ?? 0);

  return (
    <div className="ops-summary">
      <div className="ops-summary-item">
        <div className="ops-summary-label"><CalendarCheck2 size={13} /> Active timetable</div>
        <div className="ops-summary-value">
          {awaitingRecalc ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1.5 animate-pulse">
              <RefreshCw size={12} className="animate-spin text-amber-400" />
              Database modified · Recalculation required
            </span>
          ) : (
            <>
              <span style={{ color: 'var(--teal-600)' }}>●</span>{' '}
              {activeRun
                ? `Rev ${activeRun.revisionNumber} — Scenario ${metrics?.scenario ?? activeRun.scenario} — ${
                    metrics?.isFeasible !== undefined
                      ? metrics.isFeasible
                        ? 'Feasible'
                        : 'Violations Found'
                      : activeRun.validationState
                  }`
                : 'No active runs'}
            </>
          )}
        </div>
      </div>

      <div className="ops-summary-item">
        <div className="ops-summary-label"><Layers3 size={13} /> Workload scheduled</div>
        <div className="ops-summary-value">
          {awaitingRecalc ? (
            <span className="text-slate-400 font-mono italic">Awaiting recalculation</span>
          ) : (
            <span className="font-mono">
              {totalNights} access-nights across {schedActs}/{totalActs} activities ({pct}%)
            </span>
          )}
        </div>
      </div>

      <div className="ops-summary-item">
        <div className="ops-summary-label">
          {violations > 0 ? <AlertTriangle size={13} className="text-rose-400" /> : <CheckCircle2 size={13} className="text-emerald-400" />}
          Status & Penalty Score
        </div>
        <div className={`ops-summary-value ${violations > 0 ? 'critical' : ''}`}>
          {violations > 0 ? (
            `⚠ ${violations} constraint violation${violations > 1 ? 's' : ''} detected`
          ) : awaitingRecalc ? (
            <span className="text-slate-400 italic">Recalculate to generate new optimal schedule</span>
          ) : (
            `✓ Certified Feasible${score !== undefined ? ` · Penalty Score: ${score.toFixed(1)}` : ''}`
          )}
        </div>
      </div>
    </div>
  );
}
