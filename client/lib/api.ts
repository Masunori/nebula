import type { PlanningRun, TimetableRow, DisruptionEvent, ScheduleDownload } from '@/types/planning';
import type { ValidationResult, ComparisonResult } from '@/types/validation';
import type { Scenario, RunStatus } from '@/types/planning';
import {
  PLANNING_RUNS,
  buildTimetableRows,
  buildValidationResult,
  buildComparisonResult,
  buildScheduleDownloads,
} from './mockPlanningData';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function listRuns(): Promise<PlanningRun[]> {
  await delay(400);
  return PLANNING_RUNS;
}

export async function createRun(params: {
  scenario: Scenario;
  files: File[];
}): Promise<PlanningRun> {
  await delay(800);
  const newRun: PlanningRun = {
    runId: `run-${Date.now()}`,
    scenario: params.scenario,
    revisionNumber: '1',
    revisionType: 'baseline',
    validationState: 'unvalidated',
    objectiveScore: null,
    hardViolationCount: 0,
    createdBy: { id: 'u1', name: 'Alice Ng', email: 'alice.ng@nebula.rail', initials: 'AN' },
    updatedBy: { id: 'u1', name: 'Alice Ng', email: 'alice.ng@nebula.rail', initials: 'AN' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'queued',
    parentRunId: null,
  };
  PLANNING_RUNS.unshift(newRun);
  return newRun;
}

export async function getRun(runId: string): Promise<PlanningRun | null> {
  await delay(200);
  return PLANNING_RUNS.find(r => r.runId === runId) ?? null;
}

export async function getTimetable(runId: string): Promise<TimetableRow[]> {
  await delay(600);
  return buildTimetableRows();
}

export async function getScheduleDownloads(runId: string): Promise<ScheduleDownload[]> {
  await delay(200);
  const run = PLANNING_RUNS.find(candidate => candidate.runId === runId);
  if (!run) throw new Error('Planning run not found.');
  return buildScheduleDownloads(run);
}

export async function createDraft(runId: string): Promise<PlanningRun> {
  await delay(400);
  const base = PLANNING_RUNS.find(r => r.runId === runId);
  return {
    ...(base ?? PLANNING_RUNS[0]),
    runId: `${runId}-draft`,
    revisionNumber: `${base?.revisionNumber ?? '1'}.1`,
    revisionType: 'draft',
    validationState: 'pending',
    status: 'ready',
  };
}

export async function updateDraft(
  runId: string,
  changes: Array<{ activityId: string; week: number; locationId: string; accessNight: number }>
): Promise<void> {
  await delay(200);
}

export async function validateDraft(runId: string): Promise<ValidationResult> {
  await delay(1200);
  return buildValidationResult(runId);
}

export async function approveDraft(runId: string): Promise<PlanningRun> {
  await delay(600);
  const base = PLANNING_RUNS.find(r => r.runId === runId);
  const baseRev = base?.revisionNumber ?? '1';
  const nextRev = String(Math.ceil(parseFloat(baseRev)) + 1);
  return {
    ...(base ?? PLANNING_RUNS[0]),
    runId: `${runId}-approved`,
    revisionNumber: nextRev,
    revisionType: 'approved',
    validationState: 'valid',
    status: 'ready',
    updatedAt: new Date().toISOString(),
  };
}

export async function reoptimizeRevision(runId: string, disruption?: DisruptionEvent): Promise<PlanningRun> {
  await delay(2000);
  const base = PLANNING_RUNS.find(r => r.runId === runId);
  return {
    ...(base ?? PLANNING_RUNS[0]),
    runId: `${runId}-reopt`,
    validationState: 'pending',
    status: 'optimizing',
    updatedAt: new Date().toISOString(),
  };
}

export async function getComparison(runId: string): Promise<ComparisonResult> {
  await delay(500);
  return buildComparisonResult(runId);
}

export async function simulateRunProgress(
  runId: string,
  onStatus: (status: RunStatus) => void
): Promise<void> {
  const stages: RunStatus[] = ['queued', 'optimizing', 'validating', 'ready'];
  for (const stage of stages) {
    const run = PLANNING_RUNS.find(candidate => candidate.runId === runId);
    if (run) {
      run.status = stage;
      run.updatedAt = new Date().toISOString();
      if (stage === 'ready') {
        run.validationState = 'valid';
        run.objectiveScore = 0;
      }
    }
    onStatus(stage);
    await delay(stage === 'optimizing' ? 2000 : 800);
  }
}
