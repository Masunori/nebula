import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ValidationLog } from '@/components/validation/ValidationLog';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import type { ValidationLogEntry, ValidationResult } from '@/types/validation';

const mockEntries: ValidationLogEntry[] = [
  {
    id: 'v1',
    severity: 'error',
    rule: 'closure',
    week: 4,
    calendarWeek: 'CW04',
    locationId: 'SEC:BET:H01_H02:WB',
    activityId: 'A012',
    contractNumber: 'C002',
    message: 'A012 enters closure zone of A007 at SEC:BET:H01_H02:WB',
    timetableCellKey: 'A012:4:SEC:BET:H01_H02:WB',
  },
  {
    id: 'v2',
    severity: 'warning',
    rule: 'capacity',
    week: 21,
    calendarWeek: 'CW21',
    locationId: 'SEC:ALP:H01_H02:EB',
    activityId: 'A074',
    contractNumber: 'C013',
    message: 'SEC:ALP:H01_H02:EB at capacity (1/1) in CW21',
    timetableCellKey: 'A074:21:SEC:ALP:H01_H02:EB',
  },
  {
    id: 'v3',
    severity: 'ok',
    rule: 'predecessor',
    week: 21,
    calendarWeek: 'CW21',
    locationId: 'SEC:ALP:S03_S04:EB',
    activityId: 'A004',
    contractNumber: 'C001',
    message: 'A004 predecessor A003 completed in CW16 — OK',
    timetableCellKey: 'A004:21:SEC:ALP:S03_S04:EB',
  },
];

const validationResult: ValidationResult = {
  runId: 'run-001',
  revisionNumber: '12',
  scenario: 'A',
  feasible: true,
  hardViolations: [],
  softScores: {
    scenario: 'A',
    overrunDaysTotal: 0,
    contractsOverrunning: 0,
    earlinessTotal: 0,
    excessAccessNightsTotal: 0,
    ecloNightsTotal: 0,
    priorityOverrun: { '1': 0, '2': 0, '3': 0 },
    priorityWeightedScore: 0,
  },
  validationLog: [],
  validatedAt: '2027-01-10T11:42:00Z',
  capacityHotspots: [],
  nightsScheduled: 0,
  ecloNights: 0,
};

describe('ValidationLog', () => {
  it('renders all entries by default', () => {
    const onSelect = vi.fn();
    render(<ValidationLog entries={mockEntries} onSelectEntry={onSelect} selectedEntryId={null} />);
    expect(screen.getByText(/A012 enters closure zone/)).toBeInTheDocument();
    expect(screen.getByText(/SEC:ALP:H01_H02:EB at capacity/)).toBeInTheDocument();
    expect(screen.getByText(/A004 predecessor A003 completed/)).toBeInTheDocument();
  });

  it('filters to errors tab', () => {
    const onSelect = vi.fn();
    render(<ValidationLog entries={mockEntries} onSelectEntry={onSelect} selectedEntryId={null} />);
    fireEvent.click(screen.getByRole('tab', { name: /errors/i }));
    expect(screen.getByText(/A012 enters closure zone/)).toBeInTheDocument();
    expect(screen.queryByText(/SEC:ALP:H01_H02:EB at capacity/)).not.toBeInTheDocument();
  });

  it('calls onSelectEntry when row is clicked', () => {
    const onSelect = vi.fn();
    render(<ValidationLog entries={mockEntries} onSelectEntry={onSelect} selectedEntryId={null} />);
    fireEvent.click(screen.getByText(/A012 enters closure zone/));
    expect(onSelect).toHaveBeenCalledWith(mockEntries[0]);
  });

  it('highlights the selected row', () => {
    const onSelect = vi.fn();
    render(<ValidationLog entries={mockEntries} onSelectEntry={onSelect} selectedEntryId="v2" />);
    const rows = screen.getAllByRole('row');
    const selected = rows.find(r => r.textContent?.includes('SEC:ALP:H01_H02:EB at capacity'));
    expect(selected).toBeDefined();
    expect(selected?.className).toMatch(/selected/);
  });

  it('shows empty state when no entries', () => {
    const onSelect = vi.fn();
    render(<ValidationLog entries={[]} onSelectEntry={onSelect} selectedEntryId={null} />);
    expect(screen.getByText(/no validation issues/i)).toBeInTheDocument();
  });
});

describe('ValidationPanel', () => {
  it('shows completion feedback after re-checking', async () => {
    const onRevalidate = vi.fn().mockResolvedValue(undefined);
    render(<ValidationPanel result={validationResult} onRevalidate={onRevalidate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Re-check' }));

    expect(onRevalidate).toHaveBeenCalledOnce();
    expect(await screen.findByText('Timetable checks updated.')).toBeInTheDocument();
  });
});
