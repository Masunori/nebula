'use client';

import React, { useMemo, useState } from 'react';
import type { Scenario } from '@/types/planning';
import {
  Cpu,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  Hash,
  Copy,
  Check,
} from 'lucide-react';

export interface ScheduleTelemetryBarProps {
  scenario: Scenario;
  scenarioName?: string;
  engineName?: string;
  solvedTimestamp?: string | null; // ISO 8601 string
  wallTimeSeconds?: number | null;
  feasibilityStatus?: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN';
  hardViolationsCount?: number;
  softPenaltyScore?: number | null;
  scoreBreakdown?: {
    overrunDays?: number;
    excessNights?: number;
    ecloNights?: number;
    priorityWeightedScore?: number;
  };
  onRecalculate: () => void;
  isRecalculating?: boolean;
}

export function ScheduleTelemetryBar({
  scenario,
  scenarioName,
  engineName = 'Google OR-Tools CP-SAT',
  solvedTimestamp,
  wallTimeSeconds,
  feasibilityStatus = 'FEASIBLE',
  hardViolationsCount = 0,
  softPenaltyScore,
  scoreBreakdown,
  onRecalculate,
  isRecalculating = false,
}: ScheduleTelemetryBarProps) {
  const [copiedIso, setCopiedIso] = useState(false);

  // Fallback timestamp if not provided: current ISO
  const isoString = useMemo(() => {
    return solvedTimestamp || new Date().toISOString();
  }, [solvedTimestamp]);

  // Format timestamps for local vs UTC audit trails
  const { localFormatted, utcFormatted } = useMemo(() => {
    try {
      const d = new Date(isoString);
      const local = d.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const utc = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      return { localFormatted: local, utcFormatted: utc };
    } catch {
      return { localFormatted: isoString, utcFormatted: isoString };
    }
  }, [isoString]);

  const handleCopyIso = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(isoString);
      setCopiedIso(true);
      setTimeout(() => setCopiedIso(false), 2000);
    }
  };

  const scenarioClass =
    scenario === 'A'
      ? 'badge--scenario-a'
      : scenario === 'B'
      ? 'badge--scenario-b'
      : 'badge--scenario-c';

  const isFeasible = feasibilityStatus === 'FEASIBLE' || feasibilityStatus === 'OPTIMAL';

  return (
    <div className="telemetry-bar-wrapper">
      <div className="telemetry-bar" role="region" aria-label="Schedule Telemetry Bar">
        {/* 1. Scenario Tag */}
        <div className="telemetry-chip telemetry-chip--scenario" title={`Active Scenario ${scenario}`}>
          <span className={`badge ${scenarioClass}`}>
            Scenario {scenario}
          </span>
          {scenarioName && (
            <span className="telemetry-subtext truncate max-w-[140px]">
              {scenarioName}
            </span>
          )}
        </div>

        {/* 2. Engine Telemetry */}
        <div className="telemetry-chip" title="Discrete-event Constraint Programming Engine">
          <Cpu size={14} className="text-teal-600 flex-shrink-0" />
          <span className="telemetry-chip-label">Engine:</span>
          <span className="telemetry-chip-val font-medium">{engineName}</span>
        </div>

        {/* 3. Solved Timestamp (ISO & Local Versioning) */}
        <div
          className="telemetry-chip telemetry-chip--interactive"
          title={`Click to copy version ISO timestamp: ${isoString}`}
          onClick={handleCopyIso}
        >
          <Calendar size={13} className="text-ink-500 flex-shrink-0" />
          <span className="telemetry-chip-label">Solved:</span>
          <span className="telemetry-chip-val font-mono">{localFormatted}</span>
          <span className="telemetry-chip-version" title="Audit Trail ISO UTC">
            {utcFormatted.split(' ')[1]}
          </span>
          <button
            type="button"
            className="copy-iso-btn"
            aria-label="Copy ISO timestamp to clipboard"
          >
            {copiedIso ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
          </button>
        </div>

        {/* 4. Wall Time */}
        <div className="telemetry-chip" title="Total solver execution wall clock time">
          <Clock size={13} className="text-ink-500 flex-shrink-0" />
          <span className="telemetry-chip-label">Wall Time:</span>
          <span className="telemetry-chip-val font-mono">
            {wallTimeSeconds !== null && wallTimeSeconds !== undefined
              ? `${wallTimeSeconds.toFixed(2)}s`
              : '—'}
          </span>
        </div>

        {/* 5. Feasibility Status */}
        <div
          className={`telemetry-chip ${
            isFeasible ? 'telemetry-chip--status-valid' : 'telemetry-chip--status-invalid'
          }`}
          title={
            isFeasible
              ? 'All 8 hard constraints certified with 0 violations'
              : `${hardViolationsCount} hard constraint violations detected`
          }
        >
          {isFeasible ? (
            <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
          )}
          <span className="telemetry-chip-label">Feasibility:</span>
          <span className="telemetry-chip-val font-bold">
            {feasibilityStatus}
            {isFeasible ? ' (0 Hard)' : ` (${hardViolationsCount} Violations)`}
          </span>
        </div>

        {/* 6. Soft Penalty Score */}
        <div
          className="telemetry-chip telemetry-chip--highlight"
          title={
            scoreBreakdown
              ? `Overrun: ${scoreBreakdown.overrunDays ?? 0}d | Excess: ${
                  scoreBreakdown.excessNights ?? 0
                }n | ECLO: ${scoreBreakdown.ecloNights ?? 0}n`
              : 'Calculated soft objective penalty score'
          }
        >
          <Hash size={13} className="text-teal-600 flex-shrink-0" />
          <span className="telemetry-chip-label">Penalty Score:</span>
          <span className="telemetry-chip-val font-mono font-bold">
            {softPenaltyScore !== null && softPenaltyScore !== undefined
              ? softPenaltyScore.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
              : '0.0'}
          </span>
        </div>

        {/* 7. Recalculate Action Button */}
        <div className="telemetry-actions ml-auto">
          <button
            type="button"
            className="btn btn--sm btn--primary telemetry-recalc-btn"
            onClick={onRecalculate}
            disabled={isRecalculating}
            title="Recalculate schedule with CP-SAT or tune parameters"
          >
            <RotateCcw
              size={13}
              className={`recalc-icon ${isRecalculating ? 'spin' : ''}`}
            />
            <span>{isRecalculating ? 'Solving...' : 'Recalculate Schedule'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
