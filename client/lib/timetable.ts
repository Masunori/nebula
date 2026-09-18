import type { TimetableRow } from '@/types/planning';

export interface TimetableFilters {
  weeks: number[];
  lines: string[];
  bounds: string[];
  contracts: string[];
  activityTypes: string[];
  validationStates: string[];
  search: string;
}

export function filterTimetableRows(
  rows: TimetableRow[],
  filters: TimetableFilters
): TimetableRow[] {
  return rows.filter(row => {
    if (filters.weeks.length > 0 && !filters.weeks.includes(row.week)) return false;
    if (filters.lines.length > 0 && !filters.lines.includes(row.lineCode)) return false;
    if (filters.bounds.length > 0 && !filters.bounds.includes(row.bound)) return false;
    if (filters.contracts.length > 0 && !filters.contracts.includes(row.contractNumber)) return false;
    if (filters.activityTypes.length > 0 && !filters.activityTypes.includes(row.activityType)) return false;
    if (filters.validationStates.length > 0 && !filters.validationStates.includes(row.status)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!row.activityId.toLowerCase().includes(q) &&
          !row.contractNumber.toLowerCase().includes(q) &&
          !row.locationId.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function groupByLocation(rows: TimetableRow[]): Record<string, TimetableRow[]> {
  return rows.reduce((acc, row) => {
    if (!acc[row.locationId]) acc[row.locationId] = [];
    acc[row.locationId].push(row);
    return acc;
  }, {} as Record<string, TimetableRow[]>);
}

export function sortRowsByWeekAndLocation(rows: TimetableRow[]): TimetableRow[] {
  return [...rows].sort((a, b) => {
    if (a.locationId !== b.locationId) return a.locationId.localeCompare(b.locationId);
    return a.week - b.week;
  });
}

export function getUniqueWeeks(rows: TimetableRow[]): number[] {
  return [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);
}

export function getUniqueLocations(rows: TimetableRow[]): string[] {
  return [...new Set(rows.map(r => r.locationId))].sort();
}

export function groupValidationLogBySeverity<T extends { severity: string }>(entries: T[]): Record<string, T[]> {
  return entries.reduce((acc, entry) => {
    if (!acc[entry.severity]) acc[entry.severity] = [];
    acc[entry.severity].push(entry);
    return acc;
  }, {} as Record<string, T[]>);
}
