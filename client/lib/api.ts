import type {
  PlanningRun,
  TimetableRow,
  DisruptionEvent,
  ScheduleDownload,
  Scenario,
  RunStatus,
  NatureOfWorks,
  AccessType,
  ActivityType,
  LineCode,
  Bound,
} from '@/types/planning';
import type { ValidationResult, ComparisonResult } from '@/types/validation';
import {
  PLANNING_RUNS,
  ACTIVITIES,
  CONTRACTS,
  buildTimetableRows,
  buildValidationResult,
  buildComparisonResult,
  buildScheduleDownloads,
  getActivityAccessWeeks,
  getActivityAccessSummary,
} from './mockPlanningData';

export { getActivityAccessWeeks, getActivityAccessSummary };

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const CONTRACT_MAP = new Map(CONTRACTS.map((c) => [c.contractNumber, c]));
const ACTIVITY_MAP = new Map(ACTIVITIES.map((a) => [a.activityId, a]));

export function parseSolverCsvToTimetableRows(accCsv: string, occCsv?: string): TimetableRow[] {
  const occMap = new Map<string, { locationId: string; coShareGroup: string }>();
  if (occCsv) {
    const lines = occCsv.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((s) => s.trim());
      if (parts.length >= 3) {
        const [aid, w, loc, group] = parts;
        occMap.set(`${aid}:${w}`, { locationId: loc, coShareGroup: group || '' });
      }
    }
  }

  const rows: TimetableRow[] = [];
  const lines = accCsv.trim().split('\n');
  if (lines.length <= 1) return [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim());
    if (parts.length < 5) continue;
    const [aid, seqStr, weekStr, ecloStr, nightStr] = parts;
    const accessSeq = parseInt(seqStr, 10);
    const week = parseInt(weekStr, 10);
    const eclo = ecloStr === '1' || ecloStr.toLowerCase() === 'true';
    const accessNight = parseInt(nightStr, 10) || 1;

    const occ = occMap.get(`${aid}:${week}`);
    const locationId = occ?.locationId || 'SEC:ALP:S01_S02:EB';
    const coShareGroup = occ?.coShareGroup || `b${accessNight}`;

    const act = ACTIVITY_MAP.get(aid);
    const contract = act ? CONTRACT_MAP.get(act.contractNumber) : null;
    const natureOfWorks = (contract?.natureOfWorks ?? 'Standard') as NatureOfWorks;
    const accessType = (contract?.accessType ?? 'Possession') as AccessType;
    const activityType = (act?.activityType ?? 'Renewal') as ActivityType;

    const locParts = locationId.split(':');
    const lineCode = (locParts[1] ?? 'ALP') as LineCode;
    const bound = (locParts[locParts.length - 1] ?? 'EB') as Bound;

    rows.push({
      activityId: aid,
      accessSeq,
      week,
      calendarWeek: `CW${String(week).padStart(2, '0')}`,
      eclo,
      accessNight,
      contractNumber: act?.contractNumber ?? 'C001',
      activityType,
      natureOfWorks,
      accessType,
      lineCode,
      bound,
      locationId,
      coShareGroup,
      isDerived: false,
      derivedFrom: null,
      derivedType: null,
      possessionType: accessType,
      ecloNights: eclo ? 1 : 0,
      status: 'valid',
      isCritical: (act?.predecessorActivityId !== null && act?.predecessorActivityId !== undefined) || act?.activityPriority === 1,
    });
  }

  return rows;
}

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

export async function getTimetable(runId: string, scenario: Scenario = 'A'): Promise<TimetableRow[]> {
  try {
    const res = await fetch(`/api/solver/download?file=SCHEDULE_ACCESS.csv&scenario=${scenario}`);
    if (res.ok) {
      const accCsv = await res.text();
      let occCsv = '';
      try {
        const occRes = await fetch(`/api/solver/download?file=SCHEDULE_OCCUPANCY.csv&scenario=${scenario}`);
        if (occRes.ok) occCsv = await occRes.text();
      } catch {}
      const parsed = parseSolverCsvToTimetableRows(accCsv, occCsv);
      if (parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Fallback to baseline timetable rows:', err);
  }
  await delay(200);
  return buildTimetableRows();
}

export async function getScheduleDownloads(runId: string): Promise<ScheduleDownload[]> {
  const run = PLANNING_RUNS.find(candidate => candidate.runId === runId);
  const scenario = run?.scenario || 'A';

  try {
    const files = ['SCHEDULE_ACCESS.csv', 'SCHEDULE_OCCUPANCY.csv', 'RESULTS.csv'];
    const results = await Promise.all(
      files.map(async filename => {
        const res = await fetch(`/api/solver/download?file=${filename}&scenario=${scenario}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const content = await res.text();
        return { filename, content };
      })
    );
    return results;
  } catch (err) {
    // Fallback to local mock generator if server is unavailable
    if (!run) throw new Error('Planning run not found.');
    return buildScheduleDownloads(run);
  }
}

export async function solveScenarioRemote(scenario: Scenario, maxTimeSeconds: number = 30): Promise<any> {
  const res = await fetch('/api/solver/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, max_time_seconds: maxTimeSeconds, sync_db: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Solver error: ${err}`);
  }
  return res.json();
}

export async function validateScheduleRemote(
  scenario: Scenario,
  accessRows?: any[],
  occupancyRows?: any[],
  resultsRows?: any[]
): Promise<any> {
  const res = await fetch('/api/solver/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario,
      access_rows: accessRows,
      occupancy_rows: occupancyRows,
      results_rows: resultsRows,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Validator error: ${err}`);
  }
  return res.json();
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
  return buildValidationResult(runId, PLANNING_RUNS.find(run => run.runId === runId));
}

export async function approveDraft(runId: string): Promise<PlanningRun> {
  await delay(600);
  const base = PLANNING_RUNS.find(r => r.runId === runId);
  if (!base) throw new Error('Planning run not found.');
  const baseRev = base?.revisionNumber ?? '1';
  const nextRev = String(Math.ceil(parseFloat(baseRev)) + 1);
  const approvedRun: PlanningRun = {
    ...base,
    runId: `${runId}-approved`,
    revisionNumber: nextRev,
    revisionType: 'approved',
    validationState: 'valid',
    status: 'ready',
    updatedAt: new Date().toISOString(),
  };
  PLANNING_RUNS.unshift(approvedRun);
  return approvedRun;
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
