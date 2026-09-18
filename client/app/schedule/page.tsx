'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { listRuns, getRun, getScheduleDownloads, getTimetable, validateDraft } from '@/lib/api';
import type { PlanningRun, TimetableRow, Scenario } from '@/types/planning';
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
import { Download, Edit2, GitCompare, CalendarClock } from 'lucide-react';

function ScheduleContent() {
  const searchParams = useSearchParams();
  const initialActivity = searchParams.get('activity') || '';

  const [runs, setRuns] = useState<PlanningRun[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario>('A');
  const [activeRun, setActiveRun] = useState<PlanningRun | null>(null);
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
    search: initialActivity,
  });

  // Load all available runs
  useEffect(() => {
    listRuns().then(allRuns => {
      setRuns(allRuns);
      const matched = allRuns.find(r => r.scenario === selectedScenario) || allRuns[0];
      if (matched) setActiveRun(matched);
    });
  }, [selectedScenario]);

  // Load timetable and validation whenever activeRun changes
  useEffect(() => {
    if (!activeRun) return;
    Promise.all([
      getTimetable(activeRun.runId),
      validateDraft(activeRun.runId),
    ]).then(([t, v]) => {
      setRows(t);
      setValResult(v);
    });
  }, [activeRun]);

  // If initialActivity query parameter changes, sync with search filter
  useEffect(() => {
    if (initialActivity) {
      setFilters(prev => ({ ...prev, search: initialActivity }));
    }
  }, [initialActivity]);

  const availableWeeks = useMemo(() => getUniqueWeeks(rows), [rows]);
  const filteredRows = useMemo(() => filterTimetableRows(rows, filters), [rows, filters]);

  const handleDownloadCsv = async (filename: string) => {
    if (!activeRun) return;
    const downloads = await getScheduleDownloads(activeRun.runId);
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

  const handleScenarioChange = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    const matched = runs.find(r => r.scenario === scenario);
    if (matched) setActiveRun(matched);
  };

  if (!activeRun || !valResult) {
    return (
      <div className="page-wrap" style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-wrap">
      {/* Top Banner & Scenario Switcher */}
      <div className="run-header">
        <div className="run-header-meta">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="chip chip--pc" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CalendarClock size={13} /> Master Schedule
              </span>
              <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Horizon CW01–CW30 2027</span>
            </div>
            <h1 className="page-title">Railway Possession Schedule & Timetable</h1>
            <p className="page-subtitle">
              Active Run: <span className="font-mono">{activeRun.runId}</span> · {activeRun.revisionType === 'draft' ? `Draft ${activeRun.revisionNumber}` : `Revision ${activeRun.revisionNumber}`} (Scenario {activeRun.scenario})
            </p>
          </div>
          <RunStatusBadge status={activeRun.status} validation={activeRun.validationState} />
        </div>

        {/* Scenario Switcher Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="seg-control" role="tablist" aria-label="Scenario Selector">
            <button
              className={`seg-btn${selectedScenario === 'A' ? ' active' : ''}`}
              onClick={() => handleScenarioChange('A')}
              role="tab"
              aria-selected={selectedScenario === 'A'}
            >
              Scenario A
            </button>
            <button
              className={`seg-btn${selectedScenario === 'B' ? ' active' : ''}`}
              onClick={() => handleScenarioChange('B')}
              role="tab"
              aria-selected={selectedScenario === 'B'}
            >
              Scenario B
            </button>
            <button
              className={`seg-btn${selectedScenario === 'C' ? ' active' : ''}`}
              onClick={() => handleScenarioChange('C')}
              role="tab"
              aria-selected={selectedScenario === 'C'}
            >
              Scenario C
            </button>
          </div>

          <div className="run-header-actions">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={() => handleDownloadCsv('SCHEDULE_ACCESS.csv')}
              title="Download access shifts schedule"
            >
              SCHEDULE_ACCESS.csv
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={() => handleDownloadCsv('SCHEDULE_OCCUPANCY.csv')}
              title="Download track occupancy & buffer schedule"
            >
              SCHEDULE_OCCUPANCY.csv
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={() => handleDownloadCsv('RESULTS.csv')}
              title="Download contract completion dates & overruns"
            >
              RESULTS.csv
            </Button>
            <Link href={`/runs/${activeRun.runId}/compare`}>
              <Button variant="secondary" size="sm" leftIcon={<GitCompare size={14} />}>
                Compare
              </Button>
            </Link>
            <Link href={`/runs/${activeRun.runId}/edit`}>
              <Button variant="primary" size="sm" leftIcon={<Edit2 size={14} />}>
                Edit Draft
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Schedule & Sidebar Layout */}
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
            onRevalidate={async () => {
              if (activeRun) setValResult(await validateDraft(activeRun.runId));
            }}
          />
        </div>
      </div>

      {/* Timetable Integrity Checks Log */}
      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-header">
          <span className="section-title">Schedule Safety & Buffer Validation Checks</span>
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

export default function MasterSchedulePage() {
  return (
    <React.Suspense fallback={<div className="page-wrap" style={{ padding: 40 }}><LoadingSpinner /></div>}>
      <ScheduleContent />
    </React.Suspense>
  );
}
