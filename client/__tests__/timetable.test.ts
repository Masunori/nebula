'use client';
import { describe, it, expect } from 'vitest';
import {
  filterTimetableRows,
  sortRowsByWeekAndLocation,
  groupValidationLogBySeverity,
  getUniqueWeeks,
} from '@/lib/timetable';
import type { TimetableRow } from '@/types/planning';
import { buildScheduleDownloads, PLANNING_RUNS } from '@/lib/mockPlanningData';
import { approveDraft, getRun } from '@/lib/api';

function makeRow(overrides: Partial<TimetableRow>): TimetableRow {
  return {
    activityId: 'A001',
    accessSeq: 1,
    week: 1,
    calendarWeek: 'CW01',
    eclo: false,
    accessNight: 1,
    contractNumber: 'C001',
    activityType: 'Renewal',
    natureOfWorks: 'Non-live (Consist)',
    accessType: 'C',
    lineCode: 'ALP',
    bound: 'EB',
    locationId: 'SEC:ALP:S01_S02:EB',
    coShareGroup: null,
    isDerived: false,
    derivedFrom: null,
    derivedType: null,
    possessionType: 'C',
    ecloNights: 0,
    status: 'valid',
    isCritical: false,
    ...overrides,
  };
}

describe('filterTimetableRows', () => {
  const rows: TimetableRow[] = [
    makeRow({ activityId: 'A001', week: 4, lineCode: 'ALP', bound: 'EB', contractNumber: 'C001', status: 'valid' }),
    makeRow({ activityId: 'A012', week: 4, lineCode: 'BET', bound: 'WB', contractNumber: 'C002', status: 'invalid' }),
    makeRow({ activityId: 'A074', week: 21, lineCode: 'ALP', bound: 'EB', contractNumber: 'C013', activityType: 'Renewal', status: 'valid' }),
  ];

  it('filters by line', () => {
    const result = filterTimetableRows(rows, { weeks: [], lines: ['ALP'], bounds: [], contracts: [], activityTypes: [], validationStates: [], search: '' });
    expect(result).toHaveLength(2);
    expect(result.every(r => r.lineCode === 'ALP')).toBe(true);
  });

  it('filters by week', () => {
    const result = filterTimetableRows(rows, { weeks: [4], lines: [], bounds: [], contracts: [], activityTypes: [], validationStates: [], search: '' });
    expect(result).toHaveLength(2);
  });

  it('filters by bound', () => {
    const result = filterTimetableRows(rows, { weeks: [], lines: [], bounds: ['WB'], contracts: [], activityTypes: [], validationStates: [], search: '' });
    expect(result).toHaveLength(1);
    expect(result[0].activityId).toBe('A012');
  });

  it('filters by validation state', () => {
    const result = filterTimetableRows(rows, { weeks: [], lines: [], bounds: [], contracts: [], activityTypes: [], validationStates: ['invalid'], search: '' });
    expect(result).toHaveLength(1);
  });

  it('filters by search (activityId)', () => {
    const result = filterTimetableRows(rows, { weeks: [], lines: [], bounds: [], contracts: [], activityTypes: [], validationStates: [], search: 'A012' });
    expect(result).toHaveLength(1);
    expect(result[0].activityId).toBe('A012');
  });

  it('returns all rows when no filters active', () => {
    const result = filterTimetableRows(rows, { weeks: [], lines: [], bounds: [], contracts: [], activityTypes: [], validationStates: [], search: '' });
    expect(result).toHaveLength(3);
  });
});

describe('sortRowsByWeekAndLocation', () => {
  it('sorts by location then week', () => {
    const rows = [
      makeRow({ locationId: 'SEC:BET:S15_S16:EB', week: 5 }),
      makeRow({ locationId: 'SEC:ALP:S01_S02:EB', week: 2 }),
      makeRow({ locationId: 'SEC:ALP:S01_S02:EB', week: 1 }),
    ];
    const result = sortRowsByWeekAndLocation(rows);
    expect(result[0].locationId).toBe('SEC:ALP:S01_S02:EB');
    expect(result[0].week).toBe(1);
    expect(result[1].week).toBe(2);
    expect(result[2].locationId).toBe('SEC:BET:S15_S16:EB');
  });
});

describe('getUniqueWeeks', () => {
  it('returns sorted unique weeks', () => {
    const rows = [
      makeRow({ week: 4 }),
      makeRow({ week: 2 }),
      makeRow({ week: 4 }),
      makeRow({ week: 10 }),
    ];
    expect(getUniqueWeeks(rows)).toEqual([2, 4, 10]);
  });
});

describe('groupValidationLogBySeverity', () => {
  it('groups entries by severity', () => {
    const entries = [
      { id: '1', severity: 'error', rule: 'closure' },
      { id: '2', severity: 'warning', rule: 'capacity' },
      { id: '3', severity: 'error', rule: 'mirror' },
      { id: '4', severity: 'ok', rule: 'predecessor' },
    ];
    const grouped = groupValidationLogBySeverity(entries);
    expect(grouped['error']).toHaveLength(2);
    expect(grouped['warning']).toHaveLength(1);
    expect(grouped['ok']).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(groupValidationLogBySeverity([])).toEqual({});
  });
});

describe('buildScheduleDownloads', () => {
  it('creates the three required submission files with their required headers', () => {
    const downloads = buildScheduleDownloads(PLANNING_RUNS[0]);

    expect(downloads.map(file => file.filename)).toEqual([
      'SCHEDULE_ACCESS.csv',
      'SCHEDULE_OCCUPANCY.csv',
      'RESULTS.csv',
    ]);
    expect(downloads[0].content.split('\n')[0]).toBe('activity_id,access_seq,week,eclo,access_night');
    expect(downloads[1].content.split('\n')[0]).toBe('activity_id,week,location_id,co_share_group');
    expect(downloads[2].content.split('\n')[0]).toBe('scenario,contract_number,simulated_completion_date,overrun_days');
  });
});

describe('approveDraft', () => {
  it('keeps the scenario on the approved revision', async () => {
    const approvedRun = await approveDraft('run-003');
    const storedRun = await getRun(approvedRun.runId);

    expect(approvedRun.scenario).toBe('C');
    expect(storedRun?.scenario).toBe('C');
    expect(storedRun?.revisionType).toBe('approved');
  });
});
