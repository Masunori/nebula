export type LineCode = 'ALP' | 'BET';
export type Bound = 'EB' | 'WB';
export type Scenario = 'A' | 'B' | 'C';
export type RunStatus = 'queued' | 'optimizing' | 'validating' | 'ready' | 'failed';
export type ValidationState = 'valid' | 'invalid' | 'pending' | 'unvalidated';
export type AccessType = 'PM' | 'PC' | 'C';
export type NatureOfWorks = 'Live' | 'Non-live (Consist)' | 'Non-live (Others)';
export type ActivityType = 'Renewal' | 'Construction';
export type RevisionType = 'baseline' | 'draft' | 'approved';

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  // TODO: Future auth will populate this from session/JWT claims
}

export interface Contract {
  contractNumber: string;
  description: string;
  activityType: ActivityType;
  natureOfWorks: NatureOfWorks;
  priority: 1 | 2 | 3;
  contractCompletionDate: string;
  plannedCompletionDate: string;
  workfronts: number;
  accessType: AccessType;
  maxAccessPerWeek: number;
}

export interface Activity {
  activityId: string;
  contractNumber: string;
  activityType: ActivityType;
  startLocationId: string;
  endLocationId: string;
  totalAccesses: number;
  plannedStartDate: string;
  predecessorActivityId: string | null;
  activityPriority: 1 | 2 | 3;
}

export interface Location {
  locationId: string;
  locationKind: 'tunnel sector' | 'platform sector';
  lineCode: LineCode;
  bound: Bound;
  supplyCapacity: number;
}

export interface PlanningRun {
  runId: string;
  scenario: Scenario;
  revisionNumber: string; // e.g. "12", "12.1" for draft, "13" for approved
  revisionType: RevisionType;
  validationState: ValidationState;
  objectiveScore: number | null;
  hardViolationCount: number;
  createdBy: User; // TODO: will come from auth context
  updatedBy: User; // TODO: will come from auth context
  createdAt: string;
  updatedAt: string;
  status: RunStatus;
  parentRunId: string | null;
}

export interface TimetableRow {
  activityId: string;
  accessSeq: number;
  week: number; // CW number, e.g. 4 = CW4
  calendarWeek: string; // e.g. "CW04"
  eclo: boolean;
  accessNight: number;
  contractNumber: string;
  activityType: ActivityType;
  natureOfWorks: NatureOfWorks;
  accessType: AccessType;
  lineCode: LineCode;
  bound: Bound;
  locationId: string;
  coShareGroup: string | null;
  isDerived: boolean; // true = mirror/buffer closure row — not draggable
  derivedFrom: string | null; // activityId of the source work row
  derivedType: 'mirror' | 'buffer' | null;
  possessionType: AccessType;
  ecloNights: number;
  status: ValidationState;
  isCritical: boolean; // on the critical path
}

export interface DisruptionEvent {
  id: string;
  locationId: string;
  weekStart: number;
  weekEnd: number;
  newCapacity: number;
  originalCapacity: number;
  reason: string;
  createdAt: string;
  createdBy: User;
}

export interface ScheduleDownload {
  filename: string;
  content: string; // CSV content
}
