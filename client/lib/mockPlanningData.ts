/**
 * Mock planning data layer.
 * All fixtures are anchored to the real PS1 CSV inputs:
 *   01_LINES.csv, 02_STATIONS.csv, 03_SECTORS.csv, 04_LOCATION_SUPPLY.csv,
 *   06_PARAMETERS.csv (horizon: CW01–CW30, 2027-01-04),
 *   07_PROJECT_DETAILS.csv (14 contracts), 08_ACTIVITY_DETAILS.csv (55 activities)
 *
 * Week numbers are 1-indexed CW numbers (CW01 = 2027-01-04).
 * Access sequences are from the sample SCHEDULE_ACCESS.csv.
 *
 * NOTE: This file is the ONLY place that constructs mock data.
 *       lib/api.ts calls these functions; UI components must not import
 *       this file directly. When the FastAPI backend is ready, api.ts
 *       replaces the calls here with fetch() calls — no UI changes needed.
 */

import type {
  User,
  Contract,
  Activity,
  PlanningRun,
  TimetableRow,
  LineCode,
  Bound,
  NatureOfWorks,
  AccessType,
  ActivityType,
  ScheduleDownload,
} from '@/types/planning';
import type {
  ValidationResult,
  ValidationLogEntry,
  ComparisonResult,
} from '@/types/validation';

// ─── Horizon helpers ─────────────────────────────────────────────────────────

const HORIZON_START = new Date('2027-01-04');

export function getCwLabel(week: number): string {
  return `CW${String(week).padStart(2, '0')}`;
}

export function getWeekStartDate(week: number): string {
  const d = new Date(HORIZON_START);
  d.setDate(d.getDate() + (week - 1) * 7);
  return d.toISOString().slice(0, 10);
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const USERS: User[] = [
  { id: 'u1', name: 'Alice Ng', email: 'alice.ng@nebula.rail', initials: 'AN' },
  { id: 'u2', name: 'James Osei', email: 'james.osei@nebula.rail', initials: 'JO' },
  { id: 'u3', name: 'Priya Sharma', email: 'priya.sharma@nebula.rail', initials: 'PS' },
];

// ─── Contracts (all 14 from 07_PROJECT_DETAILS.csv) ──────────────────────────

export const CONTRACTS: Contract[] = [
  { contractNumber:'C001', description:'Renewal programme 1',              activityType:'Renewal',      natureOfWorks:'Non-live (Consist)', priority:3, contractCompletionDate:'2027-08-01', plannedCompletionDate:'2027-06-13', workfronts:2, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C002', description:'Renewal programme 2',              activityType:'Renewal',      natureOfWorks:'Non-live (Consist)', priority:2, contractCompletionDate:'2027-08-08', plannedCompletionDate:'2027-07-04', workfronts:1, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C003', description:'Construction programme 3',         activityType:'Construction', natureOfWorks:'Non-live (Others)',  priority:1, contractCompletionDate:'2027-07-18', plannedCompletionDate:'2027-07-04', workfronts:1, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C004', description:'Renewal programme 4',              activityType:'Renewal',      natureOfWorks:'Non-live (Consist)', priority:1, contractCompletionDate:'2027-08-08', plannedCompletionDate:'2027-07-25', workfronts:1, accessType:'PC', maxAccessPerWeek:3 },
  { contractNumber:'C005', description:'Renewal programme 5',              activityType:'Renewal',      natureOfWorks:'Non-live (Consist)', priority:3, contractCompletionDate:'2027-08-22', plannedCompletionDate:'2027-03-21', workfronts:2, accessType:'PC', maxAccessPerWeek:3 },
  { contractNumber:'C006', description:'Construction programme 6',         activityType:'Construction', natureOfWorks:'Non-live (Others)',  priority:3, contractCompletionDate:'2027-08-15', plannedCompletionDate:'2027-07-04', workfronts:1, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C007', description:'Renewal programme 7',              activityType:'Renewal',      natureOfWorks:'Non-live (Consist)', priority:1, contractCompletionDate:'2027-07-25', plannedCompletionDate:'2027-07-11', workfronts:1, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C008', description:'Renewal programme 8',              activityType:'Renewal',      natureOfWorks:'Non-live (Consist)', priority:3, contractCompletionDate:'2027-08-22', plannedCompletionDate:'2027-07-18', workfronts:1, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C009', description:'Construction programme 9',         activityType:'Construction', natureOfWorks:'Non-live (Others)',  priority:3, contractCompletionDate:'2027-07-25', plannedCompletionDate:'2027-06-27', workfronts:1, accessType:'PC', maxAccessPerWeek:3 },
  { contractNumber:'C010', description:'Construction programme 10',        activityType:'Construction', natureOfWorks:'Non-live (Others)',  priority:3, contractCompletionDate:'2027-07-25', plannedCompletionDate:'2027-05-16', workfronts:2, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C011', description:'Renewal programme 11',             activityType:'Renewal',      natureOfWorks:'Non-live (Consist)', priority:2, contractCompletionDate:'2027-08-15', plannedCompletionDate:'2027-07-11', workfronts:1, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C012', description:'Construction programme 12',        activityType:'Construction', natureOfWorks:'Non-live (Others)',  priority:1, contractCompletionDate:'2027-07-25', plannedCompletionDate:'2027-07-11', workfronts:1, accessType:'C',  maxAccessPerWeek:3 },
  { contractNumber:'C013', description:'Live-rail renewal programme 13',   activityType:'Renewal',      natureOfWorks:'Live',              priority:2, contractCompletionDate:'2027-08-01', plannedCompletionDate:'2027-05-30', workfronts:1, accessType:'PC', maxAccessPerWeek:2 },
  { contractNumber:'C014', description:'Live-rail construction programme 14', activityType:'Construction', natureOfWorks:'Live',           priority:3, contractCompletionDate:'2027-08-15', plannedCompletionDate:'2027-07-18', workfronts:1, accessType:'PM', maxAccessPerWeek:2 },
];

// ─── Activities (all 55 from 08_ACTIVITY_DETAILS.csv) ────────────────────────

export const ACTIVITIES: Activity[] = [
  { activityId:'A001', contractNumber:'C001', activityType:'Renewal',      startLocationId:'SEC:BET:S15_S16:EB', endLocationId:'SEC:BET:S16_S17:EB', totalAccesses:2, plannedStartDate:'2027-05-24', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A002', contractNumber:'C001', activityType:'Renewal',      startLocationId:'SEC:BET:S11_S12:WB', endLocationId:'SEC:BET:S12_S13:WB', totalAccesses:1, plannedStartDate:'2027-01-04', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A003', contractNumber:'C001', activityType:'Renewal',      startLocationId:'SEC:BET:H01_H02:EB', endLocationId:'SEC:BET:S15_S16:EB', totalAccesses:5, plannedStartDate:'2027-03-15', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A004', contractNumber:'C001', activityType:'Renewal',      startLocationId:'SEC:ALP:S03_S04:EB', endLocationId:'SEC:ALP:S04_H01:EB', totalAccesses:3, plannedStartDate:'2027-04-12', predecessorActivityId:'A003', activityPriority:2 },
  { activityId:'A006', contractNumber:'C001', activityType:'Renewal',      startLocationId:'SEC:ALP:S03_S04:WB', endLocationId:'SEC:ALP:H01_H02:WB', totalAccesses:2, plannedStartDate:'2027-01-11', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A007', contractNumber:'C001', activityType:'Renewal',      startLocationId:'SEC:BET:H01_H02:EB', endLocationId:'SEC:BET:H01_H02:EB', totalAccesses:7, plannedStartDate:'2027-04-12', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A008', contractNumber:'C002', activityType:'Renewal',      startLocationId:'SEC:BET:S17_S18:EB', endLocationId:'SEC:BET:S17_S18:EB', totalAccesses:5, plannedStartDate:'2027-04-19', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A009', contractNumber:'C002', activityType:'Renewal',      startLocationId:'SEC:ALP:S05_S06:EB', endLocationId:'SEC:ALP:S05_S06:EB', totalAccesses:7, plannedStartDate:'2027-01-11', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A011', contractNumber:'C002', activityType:'Renewal',      startLocationId:'SEC:BET:S15_S16:EB', endLocationId:'SEC:BET:S16_S17:EB', totalAccesses:2, plannedStartDate:'2027-04-12', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A012', contractNumber:'C002', activityType:'Renewal',      startLocationId:'SEC:BET:H01_H02:WB', endLocationId:'SEC:BET:H02_S15:WB', totalAccesses:7, plannedStartDate:'2027-01-11', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A013', contractNumber:'C002', activityType:'Renewal',      startLocationId:'SEC:ALP:S05_S06:WB', endLocationId:'SEC:ALP:S05_S06:WB', totalAccesses:5, plannedStartDate:'2027-05-24', predecessorActivityId:'A012', activityPriority:2 },
  { activityId:'A014', contractNumber:'C003', activityType:'Construction', startLocationId:'SEC:ALP:S07_S08:EB', endLocationId:'SEC:ALP:S07_S08:EB', totalAccesses:7, plannedStartDate:'2027-03-29', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A017', contractNumber:'C003', activityType:'Construction', startLocationId:'SEC:BET:H01_H02:EB', endLocationId:'SEC:BET:S15_S16:EB', totalAccesses:7, plannedStartDate:'2027-04-26', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A019', contractNumber:'C003', activityType:'Construction', startLocationId:'SEC:BET:S16_S17:EB', endLocationId:'SEC:BET:S16_S17:EB', totalAccesses:2, plannedStartDate:'2027-03-15', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A020', contractNumber:'C003', activityType:'Construction', startLocationId:'SEC:ALP:S04_H01:WB', endLocationId:'SEC:ALP:H02_S05:WB', totalAccesses:2, plannedStartDate:'2027-03-29', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A021', contractNumber:'C004', activityType:'Renewal',      startLocationId:'SEC:BET:S11_S12:WB', endLocationId:'SEC:BET:S12_S13:WB', totalAccesses:3, plannedStartDate:'2027-01-18', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A023', contractNumber:'C004', activityType:'Renewal',      startLocationId:'SEC:ALP:S03_S04:WB', endLocationId:'SEC:ALP:S03_S04:WB', totalAccesses:7, plannedStartDate:'2027-05-24', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A025', contractNumber:'C004', activityType:'Renewal',      startLocationId:'SEC:ALP:S01_S02:EB', endLocationId:'SEC:ALP:S02_S03:EB', totalAccesses:7, plannedStartDate:'2027-02-22', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A028', contractNumber:'C005', activityType:'Renewal',      startLocationId:'SEC:ALP:S03_S04:EB', endLocationId:'SEC:ALP:S04_H01:EB', totalAccesses:2, plannedStartDate:'2027-03-01', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A031', contractNumber:'C005', activityType:'Renewal',      startLocationId:'SEC:ALP:S06_S07:WB', endLocationId:'SEC:ALP:S07_S08:WB', totalAccesses:2, plannedStartDate:'2027-01-04', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A035', contractNumber:'C006', activityType:'Construction', startLocationId:'SEC:ALP:S02_S03:WB', endLocationId:'SEC:ALP:S03_S04:WB', totalAccesses:3, plannedStartDate:'2027-01-04', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A036', contractNumber:'C006', activityType:'Construction', startLocationId:'SEC:BET:S14_H01:EB', endLocationId:'SEC:BET:S14_H01:EB', totalAccesses:7, plannedStartDate:'2027-05-31', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A037', contractNumber:'C006', activityType:'Construction', startLocationId:'SEC:BET:S15_S16:EB', endLocationId:'SEC:BET:S16_S17:EB', totalAccesses:2, plannedStartDate:'2027-02-22', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A038', contractNumber:'C006', activityType:'Construction', startLocationId:'SEC:BET:S17_S18:EB', endLocationId:'SEC:BET:S17_S18:EB', totalAccesses:3, plannedStartDate:'2027-01-18', predecessorActivityId:'A037', activityPriority:3 },
  { activityId:'A039', contractNumber:'C006', activityType:'Construction', startLocationId:'SEC:BET:S11_S12:WB', endLocationId:'SEC:BET:S13_S14:WB', totalAccesses:7, plannedStartDate:'2027-02-22', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A040', contractNumber:'C007', activityType:'Renewal',      startLocationId:'SEC:BET:H01_H02:EB', endLocationId:'SEC:BET:S15_S16:EB', totalAccesses:7, plannedStartDate:'2027-03-29', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A041', contractNumber:'C007', activityType:'Renewal',      startLocationId:'SEC:BET:S15_S16:EB', endLocationId:'SEC:BET:S15_S16:EB', totalAccesses:2, plannedStartDate:'2027-03-15', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A042', contractNumber:'C007', activityType:'Renewal',      startLocationId:'SEC:BET:S15_S16:EB', endLocationId:'SEC:BET:S17_S18:EB', totalAccesses:3, plannedStartDate:'2027-06-07', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A043', contractNumber:'C007', activityType:'Renewal',      startLocationId:'SEC:BET:H02_S15:EB', endLocationId:'SEC:BET:S16_S17:EB', totalAccesses:2, plannedStartDate:'2027-03-29', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A046', contractNumber:'C007', activityType:'Renewal',      startLocationId:'SEC:ALP:S05_S06:WB', endLocationId:'SEC:ALP:S05_S06:WB', totalAccesses:5, plannedStartDate:'2027-03-01', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A047', contractNumber:'C008', activityType:'Renewal',      startLocationId:'SEC:ALP:H02_S05:EB', endLocationId:'SEC:ALP:S05_S06:EB', totalAccesses:2, plannedStartDate:'2027-03-29', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A048', contractNumber:'C008', activityType:'Renewal',      startLocationId:'SEC:BET:S13_S14:EB', endLocationId:'SEC:BET:S13_S14:EB', totalAccesses:3, plannedStartDate:'2027-01-04', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A049', contractNumber:'C008', activityType:'Renewal',      startLocationId:'SEC:BET:H02_S15:WB', endLocationId:'SEC:BET:S15_S16:WB', totalAccesses:5, plannedStartDate:'2027-02-22', predecessorActivityId:'A048', activityPriority:2 },
  { activityId:'A050', contractNumber:'C008', activityType:'Renewal',      startLocationId:'SEC:ALP:S03_S04:WB', endLocationId:'SEC:ALP:S04_H01:WB', totalAccesses:2, plannedStartDate:'2027-04-26', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A051', contractNumber:'C008', activityType:'Renewal',      startLocationId:'SEC:BET:S17_S18:WB', endLocationId:'SEC:BET:S17_S18:WB', totalAccesses:2, plannedStartDate:'2027-06-28', predecessorActivityId:'A050', activityPriority:1 },
  { activityId:'A054', contractNumber:'C009', activityType:'Construction', startLocationId:'SEC:ALP:S04_H01:EB', endLocationId:'SEC:ALP:H02_S05:EB', totalAccesses:2, plannedStartDate:'2027-04-26', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A055', contractNumber:'C009', activityType:'Construction', startLocationId:'SEC:BET:S13_S14:EB', endLocationId:'SEC:BET:H01_H02:EB', totalAccesses:1, plannedStartDate:'2027-04-19', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A056', contractNumber:'C009', activityType:'Construction', startLocationId:'SEC:ALP:H02_S05:WB', endLocationId:'SEC:ALP:S06_S07:WB', totalAccesses:2, plannedStartDate:'2027-05-03', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A057', contractNumber:'C009', activityType:'Construction', startLocationId:'SEC:BET:H02_S15:EB', endLocationId:'SEC:BET:S15_S16:EB', totalAccesses:7, plannedStartDate:'2027-04-12', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A058', contractNumber:'C010', activityType:'Construction', startLocationId:'SEC:ALP:S03_S04:WB', endLocationId:'SEC:ALP:H01_H02:WB', totalAccesses:7, plannedStartDate:'2027-01-11', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A059', contractNumber:'C010', activityType:'Construction', startLocationId:'SEC:ALP:S06_S07:WB', endLocationId:'SEC:ALP:S07_S08:WB', totalAccesses:7, plannedStartDate:'2027-04-05', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A060', contractNumber:'C010', activityType:'Construction', startLocationId:'SEC:BET:H02_S15:EB', endLocationId:'SEC:BET:S15_S16:EB', totalAccesses:3, plannedStartDate:'2027-03-29', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A061', contractNumber:'C010', activityType:'Construction', startLocationId:'SEC:BET:H01_H02:EB', endLocationId:'SEC:BET:H02_S15:EB', totalAccesses:7, plannedStartDate:'2027-01-25', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A063', contractNumber:'C010', activityType:'Construction', startLocationId:'SEC:BET:S14_H01:EB', endLocationId:'SEC:BET:H01_H02:EB', totalAccesses:1, plannedStartDate:'2027-02-01', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A064', contractNumber:'C010', activityType:'Construction', startLocationId:'SEC:BET:S15_S16:WB', endLocationId:'SEC:BET:S15_S16:WB', totalAccesses:1, plannedStartDate:'2027-04-19', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A065', contractNumber:'C011', activityType:'Renewal',      startLocationId:'SEC:BET:S12_S13:WB', endLocationId:'SEC:BET:S12_S13:WB', totalAccesses:1, plannedStartDate:'2027-05-10', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A066', contractNumber:'C011', activityType:'Renewal',      startLocationId:'SEC:ALP:S02_S03:WB', endLocationId:'SEC:ALP:S04_H01:WB', totalAccesses:1, plannedStartDate:'2027-06-21', predecessorActivityId:'A065', activityPriority:3 },
  { activityId:'A069', contractNumber:'C011', activityType:'Renewal',      startLocationId:'SEC:ALP:S03_S04:WB', endLocationId:'SEC:ALP:H01_H02:WB', totalAccesses:2, plannedStartDate:'2027-03-01', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A070', contractNumber:'C011', activityType:'Renewal',      startLocationId:'SEC:ALP:S03_S04:WB', endLocationId:'SEC:ALP:S04_H01:WB', totalAccesses:5, plannedStartDate:'2027-03-15', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A071', contractNumber:'C011', activityType:'Renewal',      startLocationId:'SEC:BET:S15_S16:EB', endLocationId:'SEC:BET:S16_S17:EB', totalAccesses:1, plannedStartDate:'2027-04-12', predecessorActivityId:null, activityPriority:1 },
  { activityId:'A072', contractNumber:'C012', activityType:'Construction', startLocationId:'SEC:ALP:S04_H01:EB', endLocationId:'SEC:ALP:H01_H02:EB', totalAccesses:1, plannedStartDate:'2027-06-07', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A073', contractNumber:'C012', activityType:'Construction', startLocationId:'SEC:BET:H01_H02:EB', endLocationId:'SEC:BET:H02_S15:EB', totalAccesses:1, plannedStartDate:'2027-05-31', predecessorActivityId:null, activityPriority:3 },
  { activityId:'A074', contractNumber:'C013', activityType:'Renewal',      startLocationId:'SEC:ALP:H01_H02:EB', endLocationId:'SEC:ALP:H01_H02:EB', totalAccesses:1, plannedStartDate:'2027-05-10', predecessorActivityId:null, activityPriority:2 },
  { activityId:'A075', contractNumber:'C014', activityType:'Construction', startLocationId:'SEC:BET:H01_H02:WB', endLocationId:'SEC:BET:H01_H02:WB', totalAccesses:1, plannedStartDate:'2027-06-14', predecessorActivityId:null, activityPriority:3 },
];

// ─── Contract lookup map ──────────────────────────────────────────────────────

const CONTRACT_MAP = new Map(CONTRACTS.map(c => [c.contractNumber, c]));
const ACTIVITY_MAP = new Map(ACTIVITIES.map(a => [a.activityId, a]));

// ─── Planning Runs ────────────────────────────────────────────────────────────

export const PLANNING_RUNS: PlanningRun[] = [
  {
    runId: 'run-001',
    scenario: 'A',
    revisionNumber: '12',
    revisionType: 'approved',
    validationState: 'valid',
    objectiveScore: 18470.6,
    hardViolationCount: 0,
    createdBy: USERS[0],
    updatedBy: USERS[0],
    createdAt: '2027-01-10T09:15:00Z',
    updatedAt: '2027-01-10T11:42:00Z',
    status: 'ready',
    parentRunId: null,
  },
  {
    runId: 'run-002',
    scenario: 'B',
    revisionNumber: '12.1',
    revisionType: 'draft',
    validationState: 'pending',
    objectiveScore: null,
    hardViolationCount: 2,
    createdBy: USERS[1],
    updatedBy: USERS[1],
    createdAt: '2027-01-11T14:00:00Z',
    updatedAt: '2027-01-11T14:00:00Z',
    status: 'ready',
    parentRunId: 'run-001',
  },
  {
    runId: 'run-003',
    scenario: 'C',
    revisionNumber: '11',
    revisionType: 'baseline',
    validationState: 'valid',
    objectiveScore: 3240.0,
    hardViolationCount: 0,
    createdBy: USERS[2],
    updatedBy: USERS[2],
    createdAt: '2026-12-28T08:00:00Z',
    updatedAt: '2026-12-28T10:30:00Z',
    status: 'ready',
    parentRunId: null,
  },
];

// ─── Location ID parser ───────────────────────────────────────────────────────

function parseLocation(locationId: string): { lineCode: LineCode; bound: Bound } {
  // e.g. "SEC:ALP:S01_S02:EB" or "PLAT:BET:H01:WB"
  const parts = locationId.split(':');
  const lineCode = (parts[1] ?? 'ALP') as LineCode;
  const bound = (parts[parts.length - 1] ?? 'EB') as Bound;
  return { lineCode, bound };
}

// ─── Raw access schedule (from sample SCHEDULE_ACCESS.csv) ───────────────────

interface RawAccess {
  activityId: string;
  accessSeq: number;
  week: number;
  eclo: boolean;
  accessNight: number;
}

const RAW_ACCESSES: RawAccess[] = [
  { activityId:'A001', accessSeq:1,  week:22, eclo:false, accessNight:3 },
  { activityId:'A001', accessSeq:2,  week:23, eclo:false, accessNight:3 },
  { activityId:'A002', accessSeq:1,  week:18, eclo:false, accessNight:1 },
  { activityId:'A003', accessSeq:1,  week:11, eclo:false, accessNight:1 },
  { activityId:'A003', accessSeq:2,  week:12, eclo:false, accessNight:1 },
  { activityId:'A003', accessSeq:3,  week:13, eclo:false, accessNight:1 },
  { activityId:'A003', accessSeq:4,  week:14, eclo:false, accessNight:1 },
  { activityId:'A003', accessSeq:5,  week:16, eclo:false, accessNight:3 },
  { activityId:'A004', accessSeq:1,  week:21, eclo:false, accessNight:3 },
  { activityId:'A004', accessSeq:2,  week:22, eclo:false, accessNight:2 },
  { activityId:'A004', accessSeq:3,  week:23, eclo:false, accessNight:3 },
  { activityId:'A006', accessSeq:1,  week:4,  eclo:false, accessNight:1 },
  { activityId:'A006', accessSeq:2,  week:5,  eclo:false, accessNight:1 },
  { activityId:'A007', accessSeq:1,  week:15, eclo:false, accessNight:2 },
  { activityId:'A007', accessSeq:2,  week:16, eclo:false, accessNight:1 },
  { activityId:'A007', accessSeq:3,  week:17, eclo:false, accessNight:1 },
  { activityId:'A007', accessSeq:4,  week:18, eclo:false, accessNight:1 },
  { activityId:'A007', accessSeq:5,  week:19, eclo:false, accessNight:3 },
  { activityId:'A007', accessSeq:6,  week:20, eclo:false, accessNight:1 },
  { activityId:'A007', accessSeq:7,  week:22, eclo:false, accessNight:3 },
  { activityId:'A008', accessSeq:1,  week:17, eclo:false, accessNight:3 },
  { activityId:'A008', accessSeq:2,  week:18, eclo:false, accessNight:3 },
  { activityId:'A008', accessSeq:3,  week:19, eclo:false, accessNight:1 },
  { activityId:'A008', accessSeq:4,  week:20, eclo:false, accessNight:3 },
  { activityId:'A008', accessSeq:5,  week:21, eclo:false, accessNight:3 },
  { activityId:'A009', accessSeq:1,  week:17, eclo:false, accessNight:2 },
  { activityId:'A009', accessSeq:2,  week:18, eclo:false, accessNight:2 },
  { activityId:'A009', accessSeq:3,  week:20, eclo:false, accessNight:2 },
  { activityId:'A009', accessSeq:4,  week:22, eclo:false, accessNight:1 },
  { activityId:'A009', accessSeq:5,  week:23, eclo:false, accessNight:2 },
  { activityId:'A009', accessSeq:6,  week:25, eclo:false, accessNight:3 },
  { activityId:'A009', accessSeq:7,  week:26, eclo:false, accessNight:1 },
  { activityId:'A011', accessSeq:1,  week:16, eclo:false, accessNight:3 },
  { activityId:'A011', accessSeq:2,  week:23, eclo:false, accessNight:3 },
  { activityId:'A012', accessSeq:1,  week:2,  eclo:false, accessNight:1 },
  { activityId:'A012', accessSeq:2,  week:3,  eclo:false, accessNight:1 },
  { activityId:'A012', accessSeq:3,  week:4,  eclo:false, accessNight:1 },
  { activityId:'A012', accessSeq:4,  week:16, eclo:false, accessNight:1 },
  { activityId:'A012', accessSeq:5,  week:17, eclo:false, accessNight:1 },
  { activityId:'A012', accessSeq:6,  week:18, eclo:false, accessNight:1 },
  { activityId:'A012', accessSeq:7,  week:20, eclo:false, accessNight:1 },
  { activityId:'A013', accessSeq:1,  week:22, eclo:false, accessNight:3 },
  { activityId:'A013', accessSeq:2,  week:23, eclo:false, accessNight:1 },
  { activityId:'A013', accessSeq:3,  week:24, eclo:false, accessNight:3 },
  { activityId:'A013', accessSeq:4,  week:25, eclo:false, accessNight:1 },
  { activityId:'A013', accessSeq:5,  week:26, eclo:false, accessNight:3 },
  { activityId:'A014', accessSeq:1,  week:13, eclo:false, accessNight:3 },
  { activityId:'A014', accessSeq:2,  week:14, eclo:false, accessNight:3 },
  { activityId:'A014', accessSeq:3,  week:15, eclo:false, accessNight:2 },
  { activityId:'A014', accessSeq:4,  week:16, eclo:false, accessNight:1 },
  { activityId:'A014', accessSeq:5,  week:17, eclo:false, accessNight:2 },
  { activityId:'A014', accessSeq:6,  week:18, eclo:false, accessNight:2 },
  { activityId:'A014', accessSeq:7,  week:19, eclo:false, accessNight:1 },
  { activityId:'A017', accessSeq:1,  week:17, eclo:false, accessNight:1 },
  { activityId:'A017', accessSeq:2,  week:18, eclo:false, accessNight:1 },
  { activityId:'A017', accessSeq:3,  week:20, eclo:false, accessNight:1 },
  { activityId:'A017', accessSeq:4,  week:22, eclo:false, accessNight:2 },
  { activityId:'A017', accessSeq:5,  week:24, eclo:false, accessNight:3 },
  { activityId:'A017', accessSeq:6,  week:25, eclo:false, accessNight:2 },
  { activityId:'A017', accessSeq:7,  week:26, eclo:false, accessNight:3 },
  { activityId:'A019', accessSeq:1,  week:13, eclo:false, accessNight:2 },
  { activityId:'A019', accessSeq:2,  week:14, eclo:false, accessNight:1 },
  { activityId:'A020', accessSeq:1,  week:13, eclo:false, accessNight:1 },
  { activityId:'A020', accessSeq:2,  week:14, eclo:false, accessNight:2 },
  { activityId:'A021', accessSeq:1,  week:15, eclo:false, accessNight:1 },
  { activityId:'A021', accessSeq:2,  week:16, eclo:false, accessNight:1 },
  { activityId:'A021', accessSeq:3,  week:17, eclo:false, accessNight:1 },
  { activityId:'A023', accessSeq:1,  week:22, eclo:false, accessNight:1 },
  { activityId:'A023', accessSeq:2,  week:23, eclo:false, accessNight:1 },
  { activityId:'A023', accessSeq:3,  week:24, eclo:false, accessNight:3 },
  { activityId:'A023', accessSeq:4,  week:25, eclo:false, accessNight:1 },
  { activityId:'A023', accessSeq:5,  week:26, eclo:false, accessNight:1 },
  { activityId:'A023', accessSeq:6,  week:27, eclo:false, accessNight:3 },
  { activityId:'A023', accessSeq:7,  week:28, eclo:false, accessNight:1 },
  { activityId:'A025', accessSeq:1,  week:8,  eclo:false, accessNight:1 },
  { activityId:'A025', accessSeq:2,  week:10, eclo:false, accessNight:1 },
  { activityId:'A025', accessSeq:3,  week:12, eclo:false, accessNight:1 },
  { activityId:'A025', accessSeq:4,  week:13, eclo:false, accessNight:1 },
  { activityId:'A025', accessSeq:5,  week:14, eclo:false, accessNight:1 },
  { activityId:'A025', accessSeq:6,  week:20, eclo:false, accessNight:1 },
  { activityId:'A025', accessSeq:7,  week:21, eclo:false, accessNight:3 },
  { activityId:'A028', accessSeq:1,  week:9,  eclo:false, accessNight:1 },
  { activityId:'A028', accessSeq:2,  week:11, eclo:false, accessNight:1 },
  { activityId:'A031', accessSeq:1,  week:10, eclo:false, accessNight:1 },
  { activityId:'A031', accessSeq:2,  week:11, eclo:false, accessNight:1 },
  { activityId:'A035', accessSeq:1,  week:1,  eclo:false, accessNight:1 },
  { activityId:'A035', accessSeq:2,  week:26, eclo:false, accessNight:2 },
  { activityId:'A035', accessSeq:3,  week:27, eclo:false, accessNight:3 },
  { activityId:'A036', accessSeq:1,  week:22, eclo:false, accessNight:1 },
  { activityId:'A036', accessSeq:2,  week:23, eclo:false, accessNight:3 },
  { activityId:'A036', accessSeq:3,  week:24, eclo:false, accessNight:1 },
  { activityId:'A036', accessSeq:4,  week:25, eclo:false, accessNight:1 },
  { activityId:'A036', accessSeq:5,  week:26, eclo:false, accessNight:1 },
  { activityId:'A036', accessSeq:6,  week:27, eclo:false, accessNight:2 },
  { activityId:'A036', accessSeq:7,  week:28, eclo:false, accessNight:1 },
  { activityId:'A037', accessSeq:1,  week:8,  eclo:false, accessNight:1 },
  { activityId:'A037', accessSeq:2,  week:9,  eclo:false, accessNight:1 },
  { activityId:'A038', accessSeq:1,  week:10, eclo:false, accessNight:1 },
  { activityId:'A038', accessSeq:2,  week:11, eclo:false, accessNight:2 },
  { activityId:'A038', accessSeq:3,  week:27, eclo:false, accessNight:1 },
  { activityId:'A039', accessSeq:1,  week:12, eclo:false, accessNight:1 },
  { activityId:'A039', accessSeq:2,  week:13, eclo:false, accessNight:1 },
  { activityId:'A039', accessSeq:3,  week:14, eclo:false, accessNight:1 },
  { activityId:'A039', accessSeq:4,  week:15, eclo:false, accessNight:1 },
  { activityId:'A039', accessSeq:5,  week:16, eclo:false, accessNight:1 },
  { activityId:'A039', accessSeq:6,  week:17, eclo:false, accessNight:1 },
  { activityId:'A039', accessSeq:7,  week:18, eclo:false, accessNight:1 },
  { activityId:'A040', accessSeq:1,  week:13, eclo:false, accessNight:1 },
  { activityId:'A040', accessSeq:2,  week:14, eclo:false, accessNight:1 },
  { activityId:'A040', accessSeq:3,  week:16, eclo:false, accessNight:1 },
  { activityId:'A040', accessSeq:4,  week:17, eclo:false, accessNight:3 },
  { activityId:'A040', accessSeq:5,  week:20, eclo:false, accessNight:1 },
  { activityId:'A040', accessSeq:6,  week:22, eclo:false, accessNight:3 },
  { activityId:'A040', accessSeq:7,  week:25, eclo:false, accessNight:3 },
  { activityId:'A041', accessSeq:1,  week:11, eclo:false, accessNight:2 },
  { activityId:'A041', accessSeq:2,  week:12, eclo:false, accessNight:2 },
  { activityId:'A042', accessSeq:1,  week:23, eclo:false, accessNight:1 },
  { activityId:'A042', accessSeq:2,  week:24, eclo:false, accessNight:1 },
  { activityId:'A042', accessSeq:3,  week:25, eclo:false, accessNight:1 },
  { activityId:'A043', accessSeq:1,  week:24, eclo:false, accessNight:3 },
  { activityId:'A043', accessSeq:2,  week:26, eclo:false, accessNight:2 },
  { activityId:'A046', accessSeq:1,  week:9,  eclo:false, accessNight:1 },
  { activityId:'A046', accessSeq:2,  week:10, eclo:false, accessNight:1 },
  { activityId:'A046', accessSeq:3,  week:11, eclo:false, accessNight:1 },
  { activityId:'A046', accessSeq:4,  week:12, eclo:false, accessNight:1 },
  { activityId:'A046', accessSeq:5,  week:25, eclo:false, accessNight:2 },
  { activityId:'A047', accessSeq:1,  week:27, eclo:false, accessNight:3 },
  { activityId:'A047', accessSeq:2,  week:28, eclo:false, accessNight:1 },
  { activityId:'A048', accessSeq:1,  week:1,  eclo:false, accessNight:1 },
  { activityId:'A048', accessSeq:2,  week:2,  eclo:false, accessNight:1 },
  { activityId:'A048', accessSeq:3,  week:3,  eclo:false, accessNight:1 },
  { activityId:'A049', accessSeq:1,  week:8,  eclo:false, accessNight:1 },
  { activityId:'A049', accessSeq:2,  week:10, eclo:false, accessNight:1 },
  { activityId:'A049', accessSeq:3,  week:16, eclo:false, accessNight:1 },
  { activityId:'A049', accessSeq:4,  week:18, eclo:false, accessNight:2 },
  { activityId:'A049', accessSeq:5,  week:20, eclo:false, accessNight:1 },
  { activityId:'A050', accessSeq:1,  week:17, eclo:false, accessNight:1 },
  { activityId:'A050', accessSeq:2,  week:18, eclo:false, accessNight:1 },
  { activityId:'A051', accessSeq:1,  week:26, eclo:false, accessNight:1 },
  { activityId:'A051', accessSeq:2,  week:27, eclo:false, accessNight:1 },
  { activityId:'A054', accessSeq:1,  week:17, eclo:false, accessNight:2 },
  { activityId:'A054', accessSeq:2,  week:18, eclo:false, accessNight:1 },
  { activityId:'A055', accessSeq:1,  week:24, eclo:false, accessNight:1 },
  { activityId:'A056', accessSeq:1,  week:23, eclo:false, accessNight:3 },
  { activityId:'A056', accessSeq:2,  week:25, eclo:false, accessNight:3 },
  { activityId:'A057', accessSeq:1,  week:15, eclo:false, accessNight:1 },
  { activityId:'A057', accessSeq:2,  week:16, eclo:false, accessNight:1 },
  { activityId:'A057', accessSeq:3,  week:17, eclo:false, accessNight:1 },
  { activityId:'A057', accessSeq:4,  week:18, eclo:false, accessNight:3 },
  { activityId:'A057', accessSeq:5,  week:20, eclo:false, accessNight:1 },
  { activityId:'A057', accessSeq:6,  week:23, eclo:false, accessNight:1 },
  { activityId:'A057', accessSeq:7,  week:25, eclo:false, accessNight:1 },
  { activityId:'A058', accessSeq:1,  week:2,  eclo:false, accessNight:1 },
  { activityId:'A058', accessSeq:2,  week:3,  eclo:false, accessNight:1 },
  { activityId:'A058', accessSeq:3,  week:6,  eclo:false, accessNight:3 },
  { activityId:'A058', accessSeq:4,  week:7,  eclo:false, accessNight:1 },
  { activityId:'A058', accessSeq:5,  week:8,  eclo:false, accessNight:1 },
  { activityId:'A058', accessSeq:6,  week:9,  eclo:false, accessNight:1 },
  { activityId:'A058', accessSeq:7,  week:10, eclo:false, accessNight:1 },
  { activityId:'A059', accessSeq:1,  week:14, eclo:false, accessNight:1 },
  { activityId:'A059', accessSeq:2,  week:15, eclo:false, accessNight:3 },
  { activityId:'A059', accessSeq:3,  week:16, eclo:false, accessNight:1 },
  { activityId:'A059', accessSeq:4,  week:17, eclo:false, accessNight:1 },
  { activityId:'A059', accessSeq:5,  week:18, eclo:false, accessNight:1 },
  { activityId:'A059', accessSeq:6,  week:19, eclo:false, accessNight:3 },
  { activityId:'A059', accessSeq:7,  week:20, eclo:false, accessNight:1 },
  { activityId:'A060', accessSeq:1,  week:13, eclo:false, accessNight:3 },
  { activityId:'A060', accessSeq:2,  week:14, eclo:false, accessNight:1 },
  { activityId:'A060', accessSeq:3,  week:19, eclo:false, accessNight:3 },
  { activityId:'A061', accessSeq:1,  week:4,  eclo:false, accessNight:1 },
  { activityId:'A061', accessSeq:2,  week:5,  eclo:false, accessNight:1 },
  { activityId:'A061', accessSeq:3,  week:6,  eclo:false, accessNight:3 },
  { activityId:'A061', accessSeq:4,  week:7,  eclo:false, accessNight:1 },
  { activityId:'A061', accessSeq:5,  week:8,  eclo:false, accessNight:1 },
  { activityId:'A061', accessSeq:6,  week:9,  eclo:false, accessNight:1 },
  { activityId:'A061', accessSeq:7,  week:10, eclo:false, accessNight:1 },
  { activityId:'A063', accessSeq:1,  week:5,  eclo:false, accessNight:1 },
  { activityId:'A064', accessSeq:1,  week:17, eclo:false, accessNight:3 },
  { activityId:'A065', accessSeq:1,  week:20, eclo:false, accessNight:2 },
  { activityId:'A066', accessSeq:1,  week:25, eclo:false, accessNight:1 },
  { activityId:'A069', accessSeq:1,  week:11, eclo:false, accessNight:1 },
  { activityId:'A069', accessSeq:2,  week:12, eclo:false, accessNight:1 },
  { activityId:'A070', accessSeq:1,  week:15, eclo:false, accessNight:1 },
  { activityId:'A070', accessSeq:2,  week:16, eclo:false, accessNight:1 },
  { activityId:'A070', accessSeq:3,  week:20, eclo:false, accessNight:1 },
  { activityId:'A070', accessSeq:4,  week:26, eclo:false, accessNight:2 },
  { activityId:'A070', accessSeq:5,  week:27, eclo:false, accessNight:1 },
  { activityId:'A071', accessSeq:1,  week:27, eclo:false, accessNight:3 },
  { activityId:'A072', accessSeq:1,  week:26, eclo:false, accessNight:1 },
  { activityId:'A073', accessSeq:1,  week:25, eclo:false, accessNight:1 },
  { activityId:'A074', accessSeq:1,  week:21, eclo:false, accessNight:2 }, // Live activity — triggers mirror closures
  { activityId:'A075', accessSeq:1,  week:29, eclo:false, accessNight:2 }, // Live activity — triggers mirror closures
];

// ─── Build timetable rows ─────────────────────────────────────────────────────

export function buildTimetableRows(): TimetableRow[] {
  const rows: TimetableRow[] = [];

  for (const access of RAW_ACCESSES) {
    const activity = ACTIVITY_MAP.get(access.activityId);
    if (!activity) continue;
    const contract = CONTRACT_MAP.get(activity.contractNumber);
    if (!contract) continue;

    const { lineCode, bound } = parseLocation(activity.startLocationId);
    const natureOfWorks: NatureOfWorks = contract.natureOfWorks;
    const accessType: AccessType = contract.accessType;
    const activityType: ActivityType = activity.activityType;

    const workRow: TimetableRow = {
      activityId: activity.activityId,
      accessSeq: access.accessSeq,
      week: access.week,
      calendarWeek: getCwLabel(access.week),
      eclo: access.eclo,
      accessNight: access.accessNight,
      contractNumber: activity.contractNumber,
      activityType,
      natureOfWorks,
      accessType,
      lineCode,
      bound,
      locationId: activity.startLocationId,
      coShareGroup: `b${access.accessNight}`,
      isDerived: false,
      derivedFrom: null,
      derivedType: null,
      possessionType: accessType,
      ecloNights: access.eclo ? 1 : 0,
      status: 'valid',
      isCritical: activity.predecessorActivityId !== null || activity.activityPriority === 1,
    };
    rows.push(workRow);

    // ── Derive mirror/buffer closures ──────────────────────────────────────
    // NOTE: In production, these are calculated authoritatively by the backend
    // validator. The client derives them here for display purposes only.

    if (natureOfWorks === 'Live') {
      // Live: mirror closure on opposite bound of same sector + cross-line interchange
      const oppBound: Bound = bound === 'EB' ? 'WB' : 'EB';
      const mirrorLocSameLine = activity.startLocationId.replace(`:${bound}`, `:${oppBound}`);

      // Mirror on opposite bound (same line)
      rows.push({
        ...workRow,
        activityId: activity.activityId,
        accessSeq: access.accessSeq,
        bound: oppBound,
        locationId: mirrorLocSameLine,
        isDerived: true,
        derivedFrom: activity.activityId,
        derivedType: 'mirror',
        coShareGroup: null,
        status: 'valid',
      });

      // Cross-line closure at interchange (H01_H02)
      if (activity.startLocationId.includes('H01_H02')) {
        const otherLine: LineCode = lineCode === 'ALP' ? 'BET' : 'ALP';
        const crossLineEB = `SEC:${otherLine}:H01_H02:EB`;
        const crossLineWB = `SEC:${otherLine}:H01_H02:WB`;
        rows.push({
          ...workRow,
          lineCode: otherLine,
          bound: 'EB',
          locationId: crossLineEB,
          isDerived: true,
          derivedFrom: activity.activityId,
          derivedType: 'mirror',
          coShareGroup: null,
          status: 'valid',
        });
        rows.push({
          ...workRow,
          lineCode: otherLine,
          bound: 'WB',
          locationId: crossLineWB,
          isDerived: true,
          derivedFrom: activity.activityId,
          derivedType: 'mirror',
          coShareGroup: null,
          status: 'valid',
        });
      }
    } else if (natureOfWorks === 'Non-live (Consist)') {
      // Non-live Consist: 1-sector buffer, same bound only
      // Simplified: mark adjacent sector as buffer (display only)
      const bufferLoc = activity.startLocationId; // In production, the adjacent sector is computed server-side
      rows.push({
        ...workRow,
        locationId: bufferLoc,
        isDerived: true,
        derivedFrom: activity.activityId,
        derivedType: 'buffer',
        coShareGroup: null,
        status: 'valid',
        // We skip actually computing adjacent sector IDs here for the MVP display.
        // The backend validator is authoritative for buffer placement.
      });
    }
    // Non-live Others: no buffer → no derived rows
  }

  return rows;
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildScheduleDownloads(run: PlanningRun): ScheduleDownload[] {
  const workRows = buildTimetableRows().filter(row => !row.isDerived);
  const accessRows = Array.from(
    new Map(workRows.map(row => [`${row.activityId}:${row.accessSeq}`, row])).values()
  );

  const accessCsv = [
    'activity_id,access_seq,week,eclo,access_night',
    ...accessRows.map(row => [
      row.activityId,
      row.accessSeq,
      row.week,
      row.eclo ? 1 : 0,
      row.accessNight,
    ].map(escapeCsv).join(',')),
  ].join('\n');

  const occupancyCsv = [
    'activity_id,week,location_id,co_share_group',
    ...workRows.map(row => [
      row.activityId,
      row.week,
      row.locationId,
      row.coShareGroup ?? '',
    ].map(escapeCsv).join(',')),
  ].join('\n');

  const resultsCsv = [
    'scenario,contract_number,simulated_completion_date,overrun_days',
    ...CONTRACTS.map(contract => {
      const contractRows = workRows.filter(row => row.contractNumber === contract.contractNumber);
      const lastWeek = Math.max(...contractRows.map(row => row.week));
      const completionDate = getWeekStartDate(lastWeek);
      const overrunDays = Math.max(
        0,
        Math.round((
          new Date(`${completionDate}T00:00:00Z`).getTime()
          - new Date(`${contract.plannedCompletionDate}T00:00:00Z`).getTime()
        ) / 86_400_000)
      );

      return [run.scenario, contract.contractNumber, completionDate, overrunDays]
        .map(escapeCsv)
        .join(',');
    }),
  ].join('\n');

  return [
    { filename: 'SCHEDULE_ACCESS.csv', content: accessCsv },
    { filename: 'SCHEDULE_OCCUPANCY.csv', content: occupancyCsv },
    { filename: 'RESULTS.csv', content: resultsCsv },
  ];
}

// ─── Validation result ────────────────────────────────────────────────────────

export function buildValidationResult(runId: string): ValidationResult {
  const isInvalid = runId === 'run-002';
  const timestamp = new Date().toISOString();

  const log: ValidationLogEntry[] = [
    {
      id: 'v1',
      severity: isInvalid ? 'error' : 'ok',
      rule: 'closure',
      week: 4,
      calendarWeek: 'CW04',
      locationId: 'SEC:BET:H01_H02:WB',
      activityId: 'A012',
      contractNumber: 'C002',
      message: isInvalid
        ? 'The planned work overlaps another worksite’s required safety buffer.'
        : 'The required safety buffer is clear.',
      timetableCellKey: 'A012:4:SEC:BET:H01_H02:WB',
    },
    {
      id: 'v2',
      severity: isInvalid ? 'error' : 'warning',
      rule: 'mirror',
      week: 21,
      calendarWeek: 'CW21',
      locationId: 'SEC:ALP:H01_H02:WB',
      activityId: 'A074',
      contractNumber: 'C013',
      message: isInvalid
        ? 'Live rail work requires the opposite track to be closed as well.'
        : 'Live rail work includes the required opposite-track closure.',
      timetableCellKey: 'A074:21:SEC:ALP:H01_H02:WB',
    },
    {
      id: 'v3',
      severity: 'warning',
      rule: 'capacity',
      week: 21,
      calendarWeek: 'CW21',
      locationId: 'SEC:ALP:H01_H02:EB',
      activityId: 'A074',
      contractNumber: 'C013',
      message: 'This location is fully booked. No further access can be added this week.',
      timetableCellKey: 'A074:21:SEC:ALP:H01_H02:EB',
    },
    {
      id: 'v4',
      severity: 'ok',
      rule: 'predecessor',
      week: 21,
      calendarWeek: 'CW21',
      locationId: 'SEC:ALP:S03_S04:EB',
      activityId: 'A004',
      contractNumber: 'C001',
      message: 'This activity starts after the work it depends on has been completed.',
      timetableCellKey: 'A004:21:SEC:ALP:S03_S04:EB',
    },
    {
      id: 'v5',
      severity: isInvalid ? 'error' : 'ok',
      rule: 'weekly_allocation',
      week: 16,
      calendarWeek: 'CW16',
      locationId: 'SEC:BET:H01_H02:EB',
      activityId: 'A007',
      contractNumber: 'C001',
      message: isInvalid
        ? 'This contract uses more access nights than it is allowed this week.'
        : 'This contract stays within its weekly access limit.',
      timetableCellKey: 'A007:16:SEC:BET:H01_H02:EB',
    },
    {
      id: 'v6',
      severity: isInvalid ? 'error' : 'ok',
      rule: 'workfront',
      week: 17,
      calendarWeek: 'CW17',
      locationId: 'SEC:BET:H01_H02:EB',
      activityId: 'A007',
      contractNumber: 'C001',
      message: isInvalid
        ? 'Too many teams are scheduled to work at the same time.'
        : 'The number of teams working at the same time is within the limit.',
      timetableCellKey: 'A007:17:SEC:BET:H01_H02:EB',
    },
  ];

  const hardViolations = isInvalid
    ? log.filter(e => e.severity === 'error').map(e => ({
        rule: e.rule,
        severity: 'hard' as const,
        detail: e.message,
      }))
    : [];

  return {
    runId,
    revisionNumber: runId === 'run-001' ? '12' : runId === 'run-002' ? '12.1' : '11',
    scenario: runId === 'run-001' ? 'A' : runId === 'run-002' ? 'B' : 'C',
    feasible: !isInvalid,
    hardViolations,
    softScores: {
      scenario: runId === 'run-001' ? 'A' : runId === 'run-002' ? 'B' : 'C',
      overrunDaysTotal: isInvalid ? 126 : 0,
      contractsOverrunning: isInvalid ? 7 : 0,
      earlinessTotal: 0,
      excessAccessNightsTotal: isInvalid ? 4 : 0,
      ecloNightsTotal: 0,
      priorityOverrun: isInvalid ? { '1': 147, '2': 98, '3': 133 } : { '1': 0, '2': 0, '3': 0 },
      priorityWeightedScore: isInvalid ? 18470.6 : (runId === 'run-003' ? 3240.0 : 0),
    },
    validationLog: log,
    validatedAt: timestamp,
    capacityHotspots: [
      { locationId: 'SEC:ALP:H01_H02:EB', week: 21, calendarWeek: 'CW21', usedCapacity: 1, maxCapacity: 1 },
      { locationId: 'SEC:BET:H01_H02:EB', week: 15, calendarWeek: 'CW15', usedCapacity: 1, maxCapacity: 1 },
      { locationId: 'SEC:ALP:S04_H01:EB', week: 21, calendarWeek: 'CW21', usedCapacity: 2, maxCapacity: 2 },
    ],
    nightsScheduled: 193,
    ecloNights: 0,
  };
}

// ─── Comparison result ────────────────────────────────────────────────────────

export function buildComparisonResult(runId: string): ComparisonResult {
  return {
    runId,
    baselineRevision: '12',
    draftRevision: '12.1',
    baselineScore: 18470.6,
    draftScore: null,
    scoreDelta: null,
    baselineFeasible: true,
    draftFeasible: false,
    hardViolationDelta: 2,
    movedActivityCount: 3,
    ecloDelta: 0,
    overrunDelta: 126,
    changedActivities: [
      {
        activityId: 'A074',
        contractNumber: 'C013',
        activityType: 'Renewal',
        previousWeek: 21,
        previousCalendarWeek: 'CW21',
        previousLocation: 'SEC:ALP:H01_H02:EB',
        newWeek: 4,
        newCalendarWeek: 'CW04',
        newLocation: 'SEC:ALP:H01_H02:EB',
        impact: 'Live activity moved to CW04 — mirror closure conflicts with A007 at SEC:BET:H01_H02:WB',
        validationResult: 'violation',
      },
      {
        activityId: 'A007',
        contractNumber: 'C001',
        activityType: 'Renewal',
        previousWeek: 16,
        previousCalendarWeek: 'CW16',
        previousLocation: 'SEC:BET:H01_H02:EB',
        newWeek: 16,
        newCalendarWeek: 'CW16',
        newLocation: 'SEC:BET:H01_H02:EB',
        impact: 'Weekly allocation now 4/3 for C001 in CW16 — violation',
        validationResult: 'violation',
      },
      {
        activityId: 'A012',
        contractNumber: 'C002',
        activityType: 'Renewal',
        previousWeek: 4,
        previousCalendarWeek: 'CW04',
        previousLocation: 'SEC:BET:H01_H02:WB',
        newWeek: 4,
        newCalendarWeek: 'CW04',
        newLocation: 'SEC:BET:H01_H02:WB',
        impact: 'Enters closure zone created by A074 — hard violation',
        validationResult: 'violation',
      },
    ],
    hasConflict: runId === 'run-002',
    newerRevision: runId === 'run-002' ? '12.2' : null,
    conflictPublishedBy: runId === 'run-002' ? 'James Osei' : null,
  };
}
