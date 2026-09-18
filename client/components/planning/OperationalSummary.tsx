'use client';
import React from 'react';
import type { PlanningRun } from '@/types/planning';
import { AlertTriangle, CalendarCheck2, Layers3 } from 'lucide-react';

export function OperationalSummary({ runs }: { runs: PlanningRun[] }) {
  const activeRun = runs.find(r => r.revisionType === 'approved') ?? runs[0];
  const draftWithViolations = runs.find(r => r.hardViolationCount > 0);

  return (
    <div className="ops-summary">
      <div className="ops-summary-item">
        <div className="ops-summary-label"><CalendarCheck2 size={13} /> Active timetable</div>
        <div className="ops-summary-value">
          <span style={{ color: 'var(--teal-600)' }}>●</span>{' '}
          {activeRun ? `Rev ${activeRun.revisionNumber} — Scenario ${activeRun.scenario} — ${activeRun.validationState}` : 'No active runs'}
        </div>
      </div>
      <div className="ops-summary-item">
        <div className="ops-summary-label"><Layers3 size={13} /> Workload scheduled</div>
        <div className="ops-summary-value">193 access-nights across 55 activities (100%)</div>
      </div>
      <div className="ops-summary-item">
        <div className="ops-summary-label"><AlertTriangle size={13} /> Critical issue</div>
        <div className="ops-summary-value critical">
          {draftWithViolations
            ? `⚠ ${draftWithViolations.hardViolationCount} hard violations in draft Rev ${draftWithViolations.revisionNumber}`
            : '✓ All revisions within constraint bounds'}
        </div>
      </div>
    </div>
  );
}
