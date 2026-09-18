export type ViolationRule =
  | 'closure'
  | 'mirror'
  | 'capacity'
  | 'predecessor'
  | 'weekly_allocation'
  | 'workfront'
  | 'eclo'
  | 'planned_date';

export type ViolationSeverity = 'hard' | 'soft' | 'info';

export interface HardViolation {
  rule: ViolationRule;
  severity: 'hard';
  detail: string;
}

export interface ValidationLogEntry {
  id: string;
  severity: 'error' | 'warning' | 'ok'; // error=hard violation, warning=soft/amber, ok=improvement
  rule: ViolationRule;
  week: number;
  calendarWeek: string;
  locationId: string;
  activityId: string;
  contractNumber: string;
  message: string;
  /** Links to the timetable cell so clicking scrolls + highlights it */
  timetableCellKey: string; // `${activityId}:${week}:${locationId}`
}

export interface SoftScores {
  scenario: string;
  overrunDaysTotal: number;
  contractsOverrunning: number;
  earlinessTotal: number;
  excessAccessNightsTotal: number;
  ecloNightsTotal: number;
  priorityOverrun: Record<string, number>; // { '1': 147, '2': 98, '3': 133 }
  priorityWeightedScore: number;
}

export interface ValidationResult {
  runId: string;
  revisionNumber: string;
  scenario: string;
  feasible: boolean;
  hardViolations: HardViolation[];
  softScores: SoftScores;
  validationLog: ValidationLogEntry[];
  validatedAt: string;
  capacityHotspots: Array<{
    locationId: string;
    week: number;
    calendarWeek: string;
    usedCapacity: number;
    maxCapacity: number;
  }>;
  nightsScheduled: number;
  ecloNights: number;
}

export interface ComparisonResult {
  runId: string;
  baselineRevision: string;
  draftRevision: string;
  baselineScore: number | null;
  draftScore: number | null;
  scoreDelta: number | null;
  baselineFeasible: boolean;
  draftFeasible: boolean;
  hardViolationDelta: number;
  movedActivityCount: number;
  ecloDelta: number;
  overrunDelta: number;
  changedActivities: ChangedActivity[];
  // Optimistic locking
  hasConflict: boolean;
  newerRevision: string | null;
  conflictPublishedBy: string | null;
}

export interface ChangedActivity {
  activityId: string;
  contractNumber: string;
  activityType: string;
  previousWeek: number;
  previousCalendarWeek: string;
  previousLocation: string;
  newWeek: number;
  newCalendarWeek: string;
  newLocation: string;
  impact: string; // human-readable description
  validationResult: 'ok' | 'violation' | 'warning';
}
