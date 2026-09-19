'use client';
import React, { useState } from 'react';
import type { ValidationLogEntry } from '@/types/validation';
import { StatusIcon } from '@/components/ui/StatusIcon';

const ruleLabels: Record<ValidationLogEntry['rule'], string> = {
  closure: 'Safety buffer conflict',
  mirror: 'Live-rail closure',
  capacity: 'Location capacity',
  predecessor: 'Work order',
  weekly_allocation: 'Weekly access limit',
  workfront: 'Team limit',
  eclo: 'Early closure limit',
  planned_date: 'Target completion date',
};

interface ValidationLogProps {
  entries?: ValidationLogEntry[];
  log?: ValidationLogEntry[];
  onSelectEntry?: (entry: ValidationLogEntry) => void;
  onSelectViolation?: (entry: ValidationLogEntry) => void;
  selectedEntryId?: string | null;
  highlightCellKey?: string | null;
}

export function ValidationLog({
  entries,
  log,
  onSelectEntry,
  onSelectViolation,
  selectedEntryId,
  highlightCellKey,
}: ValidationLogProps) {
  const [tab, setTab] = useState<'all' | 'error' | 'warning' | 'ok'>('all');

  const rawEntries = entries ?? log ?? [];
  const handleSelect = onSelectEntry ?? onSelectViolation ?? (() => {});
  const activeId = selectedEntryId ?? highlightCellKey ?? null;

  const filtered = tab === 'all' ? rawEntries : rawEntries.filter(e => e.severity === tab);

  return (
    <div>
      <div className="log-tabs">
        <button
          type="button"
          role="tab"
          className={`log-tab ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          className={`log-tab ${tab === 'error' ? 'active' : ''}`}
          onClick={() => setTab('error')}
        >
          Errors
        </button>
        <button
          type="button"
          role="tab"
          className={`log-tab ${tab === 'warning' ? 'active' : ''}`}
          onClick={() => setTab('warning')}
        >
          Warnings
        </button>
        <button
          type="button"
          role="tab"
          className={`log-tab ${tab === 'ok' ? 'active' : ''}`}
          onClick={() => setTab('ok')}
        >
          OK
        </button>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-500)' }}>
          No validation issues
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Week</th>
              <th>Rule checked</th>
              <th>What this means</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => (
              <tr
                role="row"
                key={entry.id}
                className={entry.id === activeId ? 'row--selected' : ''}
                onClick={() => handleSelect(entry)}
                style={{ cursor: 'pointer' }}
              >
                <td><StatusIcon status={entry.severity} size={16} /></td>
                <td>{entry.calendarWeek}</td>
                <td>{ruleLabels[entry.rule]}</td>
                <td>{entry.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
