'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRun, getTimetable, validateDraft, approveDraft } from '@/lib/api';
import type { PlanningRun, TimetableRow } from '@/types/planning';
import type { ValidationResult } from '@/types/validation';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { ValidationLog } from '@/components/validation/ValidationLog';
import { DraftEditor } from '@/components/timetable/DraftEditor';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ArrowLeft, CheckCheck } from 'lucide-react';
import Link from 'next/link';

export default function DraftEditPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const [run, setRun] = useState<PlanningRun | null>(null);
  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [valResult, setValResult] = useState<ValidationResult | null>(null);
  const [hlKey, setHlKey] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    Promise.all([getRun(runId), getTimetable(runId), validateDraft(runId)]).then(([r, t, v]) => {
      setRun(r);
      setRows(t);
      setValResult(v);
    });
  }, [runId]);

  const handleApprove = async () => {
    setApproving(true);
    const approvedRun = await approveDraft(runId);
    setApproving(false);
    setShowApproveModal(false);
    router.push(`/runs/${approvedRun.runId}`);
  };

  if (!run || !valResult) return <LoadingSpinner />;

  return (
    <div className="page-wrap">
      <div className="run-header">
        <div className="run-header-meta">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Link href={`/runs/${runId}`} className="btn btn--ghost btn--sm">
                <ArrowLeft size={14} /> Back to Run
              </Link>
            </div>
            <h1 className="page-title">Interactive Draft Editor</h1>
            <p className="page-subtitle">
              Working on Draft {run.revisionNumber} (Scenario {run.scenario}) · Drag an activity onto a timetable cell, then validate the draft
            </p>
          </div>
        </div>
        <div className="run-header-actions">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<CheckCheck size={14} />}
            onClick={() => setShowApproveModal(true)}
          >
            Approve Draft as Baseline
          </Button>
        </div>
      </div>

      <div className="run-layout">
        <div className="run-main section" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          <DraftEditor runId={runId} rows={rows} highlightCellKey={hlKey} onValidated={setValResult} />
        </div>
        <div className="run-sidebar">
          <ValidationPanel
            result={valResult}
            onRevalidate={async () => setValResult(await validateDraft(runId))}
          />
        </div>
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-header">
          <span className="section-title">Timetable Checks</span>
        </div>
        <div className="section-body">
          <ValidationLog
            entries={valResult.validationLog}
            onSelectEntry={e => setHlKey(e.timetableCellKey)}
            selectedEntryId={hlKey}
          />
        </div>
      </div>

      {/* Approval confirmation dialog */}
      <Dialog
        open={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Draft Revision"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleApprove} loading={approving}>
              Confirm Approval
            </Button>
          </div>
        }
      >
        <p style={{ color: 'var(--ink-700)', lineHeight: 1.6 }}>
          This will promote the current draft (Draft {run.revisionNumber}) into an approved baseline revision.
          All contractors and controllers will view this as the active timetable.
        </p>
      </Dialog>
    </div>
  );
}

