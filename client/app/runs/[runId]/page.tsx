'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getRun, getScheduleDownloads, getTimetable, validateDraft } from '@/lib/api';
import type { PlanningRun, TimetableRow } from '@/types/planning';
import type { ValidationResult } from '@/types/validation';
import { filterTimetableRows, getUniqueWeeks, type TimetableFilters as FiltersType } from '@/lib/timetable';
import { TimetableFilters } from '@/components/timetable/TimetableFilters';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { ValidationLog } from '@/components/validation/ValidationLog';
import { TimetableView } from '@/components/timetable/TimetableView';
import { RunStatusBadge } from '@/components/planning/RunStatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { Download, Edit2, GitCompare } from 'lucide-react';

export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<PlanningRun | null>(null);
  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [valResult, setValResult] = useState<ValidationResult | null>(null);
  const [hlKey, setHlKey] = useState<string | null>(null);

  const [filters, setFilters] = useState<FiltersType>({
    weeks: [],
    lines: [],
    bounds: [],
    contracts: [],
    activityTypes: [],
    validationStates: [],
    search: '',
  });

  useEffect(() => {
    Promise.all([getRun(runId), getTimetable(runId), validateDraft(runId)]).then(([r, t, v]) => {
      setRun(r);
      setRows(t);
      setValResult(v);
    });
  }, [runId]);

  const availableWeeks = useMemo(() => getUniqueWeeks(rows), [rows]);
  const filteredRows = useMemo(() => filterTimetableRows(rows, filters), [rows, filters]);

  const handleDownloadCsv = async (filename: string) => {
    const downloads = await getScheduleDownloads(runId);
    const download = downloads.find(file => file.filename === filename);
    if (!download) return;

    const blob = new Blob([download.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = download.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!run || !valResult) return <LoadingSpinner />;

  return (
    <div className="page-wrap">
      <div className="run-header">
        <div className="run-header-meta">
          <div>
            <h1 className="page-title">Planning Run: {run.runId}</h1>
            <p className="page-subtitle">
              Scenario {run.scenario} · {run.revisionType === 'draft' ? `Draft ${run.revisionNumber}` : `Revision ${run.revisionNumber}`}
            </p>
          </div>
          <RunStatusBadge status={run.status} validation={run.validationState} />
        </div>
        <div className="run-header-actions">
          <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={() => handleDownloadCsv('SCHEDULE_ACCESS.csv')}>
            SCHEDULE_ACCESS.csv
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={() => handleDownloadCsv('SCHEDULE_OCCUPANCY.csv')}>
            SCHEDULE_OCCUPANCY.csv
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download size={14} />} onClick={() => handleDownloadCsv('RESULTS.csv')}>
            RESULTS.csv
          </Button>
          <Link href={`/runs/${run.runId}/compare`}>
            <Button variant="secondary" size="sm" leftIcon={<GitCompare size={14} />}>
              Compare
            </Button>
          </Link>
          <Link href={`/runs/${run.runId}/edit`}>
            <Button variant="primary" size="sm" leftIcon={<Edit2 size={14} />}>
              Edit Draft
            </Button>
          </Link>
        </div>
      </div>

      <div className="run-layout">
        <div className="run-main section" style={{ display: 'flex', flexDirection: 'column' }}>
          <TimetableFilters
            filters={filters}
            onChange={setFilters}
            availableWeeks={availableWeeks}
          />
          <div style={{ flex: 1, minHeight: 480 }}>
            <TimetableView rows={filteredRows} highlightCellKey={hlKey} />
          </div>
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
    </div>
  );
}

