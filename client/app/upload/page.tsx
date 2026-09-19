'use client';
import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRun, simulateRunProgress, solveScenarioRemote } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, FileText, UploadCloud } from 'lucide-react';
import type { Scenario } from '@/types/planning';
import { parseRailwayCSV } from '@/lib/csv-parser';

const REQUIRED_FILES = [
  '01_LINES.csv',
  '02_STATIONS.csv',
  '03_SECTORS.csv',
  '04_LOCATION_SUPPLY.csv',
  '05_BUFFER_LOCATION.csv',
  '06_PARAMETERS.csv',
  '07_PROJECT_DETAILS.csv',
  '08_ACTIVITY_DETAILS.csv',
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scenario, setScenario] = useState<Scenario>('A');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadedNames = uploadedFiles.map(file => file.name);
  const hasAllRequiredFiles = REQUIRED_FILES.every(fileName => uploadedNames.includes(fileName));

  const addFiles = (files: File[]) => {
    const csvFiles = files.filter(file => file.name.toLowerCase().endsWith('.csv'));
    const filesByName = new Map(uploadedFiles.map(file => [file.name, file]));
    csvFiles.forEach(file => filesByName.set(file.name, file));
    setUploadedFiles(Array.from(filesByName.values()));
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!hasAllRequiredFiles) {
      setUploadError('Upload all eight required CSV files before starting a planning run.');
      return;
    }
    setLoading(true);
    setStatus('Reading and validating uploaded CSV files...');
    try {
      const payload: Record<string, any[]> = {};

      for (const file of uploadedFiles) {
        const text = await file.text();
        const { table, records } = parseRailwayCSV(file.name, text);
        if (table && table !== 'unknown') {
          payload[table] = records;
        }
      }

      setStatus('Synchronizing railway network and activities to PostgreSQL...');
      const syncRes = await fetch('/api/database/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!syncRes.ok) {
        const err = await syncRes.text();
        throw new Error(`Database synchronization failed: ${err}`);
      }

      setStatus(`Executing CP-SAT solver for Scenario ${scenario}...`);
      const solveRes = await solveScenarioRemote(scenario, 30);
      if (!solveRes.feasible) {
        throw new Error('CP-SAT solver could not find a feasible schedule for the uploaded dataset.');
      }

      try {
        const storageKey = 'nebulax_scenario_solutions_v1';
        // Invalidate stale solution caches so schedule page fetches fresh timetable rows directly
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn('Could not clear stale solutions from localStorage', e);
      }

      setStatus('Schedule optimization complete! Loading Master Timetable...');
      router.push(`/schedule?scenario=${scenario}`);
    } catch (err: any) {
      setUploadError(err.message || 'The planning run could not be started. Please try again.');
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Planning Run</h1>
          <p className="page-subtitle">Upload input datasets and choose optimization scenario</p>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <span className="section-title">1. Required Input Files (8 CSVs)</span>
        </div>
        <div className="section-body">
          <div
            className="upload-dropzone"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            aria-label="Choose the eight required CSV files"
          >
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={event => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
            <UploadCloud size={36} style={{ margin: '0 auto 12px', color: 'var(--teal-600)' }} />
            <p style={{ fontWeight: 600, color: 'var(--ink-800)', marginBottom: 4 }}>
              Drag and drop the railway input CSV files here
            </p>
            <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>
              Or click to choose files. All 8 CSV files are required.
            </p>
          </div>

          <p className="upload-summary" aria-live="polite">
            {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'} selected. {hasAllRequiredFiles ? 'All required files are ready.' : 'Select the files listed below.'}
          </p>
          {uploadError && <p className="upload-error" role="alert">{uploadError}</p>}

          <div className="file-grid" style={{ marginTop: 16 }}>
            {REQUIRED_FILES.map(fileName => {
              const isPresent = uploadedNames.includes(fileName);
              return (
                <div
                  key={fileName}
                  className={`file-chip ${isPresent ? 'file-chip--accepted' : 'file-chip--missing'}`}
                >
                  {isPresent ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                  <span className="truncate">{fileName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <span className="section-title">2. Select Optimization Scenario</span>
        </div>
        <div className="section-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div
              className={`scenario-card ${scenario === 'A' ? 'selected' : ''}`}
              onClick={() => setScenario('A')}
            >
              <div className="scenario-letter">Scenario A</div>
              <div className="scenario-name">Strict Supply / Flexible Schedule</div>
              <div className="scenario-desc">
                Capacity limits are rigid; ECLO is forbidden. Focuses purely on minimising priority-weighted project completion overruns.
              </div>
            </div>

            <div
              className={`scenario-card ${scenario === 'B' ? 'selected' : ''}`}
              onClick={() => setScenario('B')}
            >
              <div className="scenario-letter">Scenario B</div>
              <div className="scenario-name">Strict Schedule / Flexible Supply</div>
              <div className="scenario-desc">
                Target completion dates are strictly binding. Access capacity expands via excess nights and ECLO windows to avoid late finishes.
              </div>
            </div>

            <div
              className={`scenario-card ${scenario === 'C' ? 'selected' : ''}`}
              onClick={() => setScenario('C')}
            >
              <div className="scenario-letter">Scenario C</div>
              <div className="scenario-name">Balanced Trade-off</div>
              <div className="scenario-desc">
                Balanced objective balancing delay penalties, excess possession nights, and continuous ECLO block usage.
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="section">
          <div className="section-body">
            <div className="status-bar">
              <div className="status-steps">
                <div className={`status-step ${status === 'queued' ? 'active' : status ? 'done' : ''}`}>
                  <div className={`status-step-dot ${status === 'queued' ? 'active' : status ? 'done' : ''}`} />
                  <span className={`status-step-label ${status === 'queued' ? 'active' : ''}`}>Queued</span>
                </div>
                <div className={`status-step ${status === 'optimizing' ? 'active' : status === 'validating' || status === 'ready' ? 'done' : ''}`}>
                  <div className={`status-step-dot ${status === 'optimizing' ? 'active' : status === 'validating' || status === 'ready' ? 'done' : ''}`} />
                  <span className={`status-step-label ${status === 'optimizing' ? 'active' : ''}`}>Optimizing</span>
                </div>
                <div className={`status-step ${status === 'validating' ? 'active' : status === 'ready' ? 'done' : ''}`}>
                  <div className={`status-step-dot ${status === 'validating' ? 'active' : status === 'ready' ? 'done' : ''}`} />
                  <span className={`status-step-label ${status === 'validating' ? 'active' : ''}`}>Validating</span>
                </div>
                <div className={`status-step ${status === 'ready' ? 'active done' : ''}`}>
                  <div className={`status-step-dot ${status === 'ready' ? 'done' : ''}`} />
                  <span className={`status-step-label ${status === 'ready' ? 'done' : ''}`}>Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button variant="secondary" onClick={() => router.push('/')} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleUpload} loading={loading} disabled={loading}>
          {loading ? `Solving: ${status}...` : 'Run Optimization & Validation'}
        </Button>
      </div>
    </div>
  );
}
