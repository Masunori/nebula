'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getComparison } from '@/lib/api';
import type { ComparisonResult } from '@/types/validation';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function ComparePage() {
  const params = useParams();
  const runId = params.runId as string;
  const [comp, setComp] = useState<ComparisonResult | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  useEffect(() => {
    getComparison(runId).then(res => {
      setComp(res);
      if (res.hasConflict) {
        setShowConflictModal(true);
      }
    });
  }, [runId]);

  if (!comp) return <LoadingSpinner />;

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Link href={`/runs/${runId}`} className="btn btn--ghost btn--sm">
              <ArrowLeft size={14} /> Back to Run
            </Link>
          </div>
          <h1 className="page-title">Revision Comparison</h1>
          <p className="page-subtitle">
            Comparing Engine Baseline (Rev {comp.baselineRevision}) vs Planner Draft (Rev {comp.draftRevision})
          </p>
        </div>
      </div>

      {/* Revision History Nodes */}
      <div className="section" style={{ padding: '16px 24px', marginBottom: 24 }}>
        <div className="rev-timeline">
          <div className="rev-node">
            <div className="rev-node-top">
              <div className="rev-node-dot approved" />
              <div className="rev-connector" />
            </div>
            <span className="rev-label">Rev {comp.baselineRevision}</span>
            <span className="rev-sublabel">Engine baseline · Validated</span>
          </div>
          <div className="rev-node">
            <div className="rev-node-top">
              <div className="rev-connector" />
              <div className="rev-node-dot draft" />
              <div className="rev-connector" />
            </div>
            <span className="rev-label">Draft {comp.draftRevision}</span>
            <span className="rev-sublabel">Planner draft · {comp.draftFeasible ? 'Feasible' : 'Invalid'}</span>
          </div>
          <div className="rev-node">
            <div className="rev-node-top">
              <div className="rev-connector" />
              <div className="rev-node-dot" />
            </div>
            <span className="rev-label">Rev 13</span>
            <span className="rev-sublabel">Pending approval</span>
          </div>
        </div>
      </div>

      {/* Metrics side-by-side */}
      <div className="compare-grid">
        <div className="section compare-col" style={{ padding: 20 }}>
          <div className="compare-col-label baseline">
            Engine Baseline (Rev {comp.baselineRevision})
          </div>
          <div className="metric-row">
            <span className="metric-label">Feasibility</span>
            <Badge variant={comp.baselineFeasible ? 'valid' : 'invalid'}>
              {comp.baselineFeasible ? 'Feasible' : 'Invalid'}
            </Badge>
          </div>
          <div className="metric-row">
            <span className="metric-label">Objective Score</span>
            <span className="metric-value">{comp.baselineScore?.toLocaleString() ?? '——'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Hard Violations</span>
            <span className="metric-value">0</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Overrun Days</span>
            <span className="metric-value">0</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">ECLO Nights</span>
            <span className="metric-value">0</span>
          </div>
        </div>

        <div className="section compare-col" style={{ padding: 20 }}>
          <div className="compare-col-label draft">
            Planner Draft (Rev {comp.draftRevision})
          </div>
          <div className="metric-row">
            <span className="metric-label">Feasibility</span>
            <Badge variant={comp.draftFeasible ? 'valid' : 'invalid'}>
              {comp.draftFeasible ? 'Feasible' : 'Invalid'}
            </Badge>
          </div>
          <div className="metric-row">
            <span className="metric-label">Objective Score</span>
            <span className="metric-value">{comp.draftScore?.toLocaleString() ?? '——'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Hard Violations Delta</span>
            <span className="metric-value" style={{ color: comp.hardViolationDelta > 0 ? 'var(--status-red)' : 'inherit' }}>
              +{comp.hardViolationDelta}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total Overrun Delta</span>
            <span className="metric-value">+{comp.overrunDelta} days</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">ECLO Nights Delta</span>
            <span className="metric-value">+{comp.ecloDelta}</span>
          </div>
        </div>
      </div>

      {/* Changed Activities Table */}
      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-header">
          <span className="section-title">Changed Activities ({comp.changedActivities.length})</span>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Contract</th>
                <th>Previous Placement</th>
                <th>New Placement</th>
                <th>Operational Impact</th>
                <th>Validation</th>
              </tr>
            </thead>
            <tbody>
              {comp.changedActivities.map(act => (
                <tr key={act.activityId}>
                  <td className="font-mono" style={{ fontWeight: 600 }}>{act.activityId}</td>
                  <td>{act.contractNumber}</td>
                  <td>
                    <span className="diff-old">{act.previousCalendarWeek}</span> · {act.previousLocation}
                  </td>
                  <td>
                    <span className="diff-new">{act.newCalendarWeek}</span> · {act.newLocation}
                  </td>
                  <td>{act.impact}</td>
                  <td>
                    <Badge variant={act.validationResult === 'violation' ? 'invalid' : 'valid'}>
                      {act.validationResult}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optimistic locking conflict dialog */}
      <Dialog
        open={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        title="Concurrent Edit Warning"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowConflictModal(false)}>
              Keep My Draft
            </Button>
            <Button variant="primary" onClick={() => setShowConflictModal(false)}>
              Review Published Rev {comp.newerRevision}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={24} style={{ color: 'var(--status-amber)', flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, color: 'var(--ink-900)', marginBottom: 4 }}>
              Another planner ({comp.conflictPublishedBy ?? 'James Osei'}) published Revision {comp.newerRevision} while you were drafting.
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-600)' }}>
              Your draft is currently based on Revision {comp.baselineRevision}. You can review their latest approved changes or proceed with your separate draft.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
