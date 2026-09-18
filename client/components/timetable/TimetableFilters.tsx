'use client';
import React from 'react';
import type { TimetableFilters as FiltersType } from '@/lib/timetable';
import { Search, X } from 'lucide-react';

interface TimetableFiltersProps {
  filters: FiltersType;
  onChange: (f: FiltersType) => void;
  availableWeeks: number[];
}

export function TimetableFilters({ filters, onChange, availableWeeks }: TimetableFiltersProps) {
  const toggleLine = (line: string) => {
    const next = filters.lines.includes(line)
      ? filters.lines.filter(l => l !== line)
      : [...filters.lines, line];
    onChange({ ...filters, lines: next });
  };

  const toggleBound = (bound: string) => {
    const next = filters.bounds.includes(bound)
      ? filters.bounds.filter(b => b !== bound)
      : [...filters.bounds, bound];
    onChange({ ...filters, bounds: next });
  };

  const hasActiveFilters =
    filters.lines.length > 0 ||
    filters.bounds.length > 0 ||
    filters.weeks.length > 0 ||
    filters.search.length > 0;

  const clearFilters = () => {
    onChange({
      weeks: [],
      lines: [],
      bounds: [],
      contracts: [],
      activityTypes: [],
      validationStates: [],
      search: '',
    });
  };

  return (
    <div className="filter-bar">
      <div className="filter-search-wrap">
        <Search size={14} className="filter-search-icon" />
        <input
          type="text"
          className="filter-search"
          placeholder="Filter activity / contract..."
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          type="button"
          className={`filter-btn ${filters.lines.includes('ALP') ? 'active' : ''}`}
          onClick={() => toggleLine('ALP')}
        >
          Alpha Line
        </button>
        <button
          type="button"
          className={`filter-btn ${filters.lines.includes('BET') ? 'active' : ''}`}
          onClick={() => toggleLine('BET')}
        >
          Beta Line
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          type="button"
          className={`filter-btn ${filters.bounds.includes('EB') ? 'active' : ''}`}
          onClick={() => toggleBound('EB')}
        >
          EB
        </button>
        <button
          type="button"
          className={`filter-btn ${filters.bounds.includes('WB') ? 'active' : ''}`}
          onClick={() => toggleBound('WB')}
        >
          WB
        </button>
      </div>

      {availableWeeks.length > 0 && (
        <span style={{ fontSize: 11, color: 'var(--ink-500)', marginLeft: 'auto' }}>
          CW01–CW30 ({availableWeeks.length} active weeks)
        </span>
      )}

      {hasActiveFilters && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={clearFilters}
          style={{ fontSize: 11, gap: 4 }}
        >
          <X size={12} /> Clear filters
        </button>
      )}
    </div>
  );
}
