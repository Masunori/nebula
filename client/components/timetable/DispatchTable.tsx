'use client';
import React, { useRef, useEffect } from 'react';
import type { TimetableRow } from '@/types/planning';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { EmptyState } from '@/components/ui/EmptyState';

interface DispatchTableProps {
  rows: TimetableRow[];
  highlightCellKey?: string | null;
  onSelectRow?: (key: string) => void;
}

export function DispatchTable({ rows, highlightCellKey, onSelectRow }: DispatchTableProps) {
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (highlightCellKey && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightCellKey]);

  if (rows.length === 0) {
    return <EmptyState title="No activities" body="Adjust filters to see timetable rows." />;
  }

  return (
    <div className="table-wrap">
      <table className="data-table" aria-label="Nightly dispatch timetable">
        <thead>
          <tr>
            <th>CW</th>
            <th>Night</th>
            <th>Line</th>
            <th>Bound</th>
            <th>Location</th>
            <th>Activity</th>
            <th>Contract</th>
            <th>Possession</th>
            <th>ECLO</th>
            <th>Co-share</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const key = `${row.activityId}:${row.week}:${row.locationId}`;
            const isHighlight = key === highlightCellKey;
            const rowClass = [
              row.isDerived ? 'row--derived' : '',
              isHighlight ? 'row--selected' : '',
            ].filter(Boolean).join(' ');

            return (
              <tr
                key={key}
                ref={isHighlight ? highlightRef : undefined}
                className={rowClass}
                onClick={() => onSelectRow?.(key)}
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelectRow?.(key); }}
              >
                <td className="font-mono">{row.calendarWeek}</td>
                <td>{row.accessNight}</td>
                <td><span className={`chip chip--${row.lineCode.toLowerCase()}`}>{row.lineCode}</span></td>
                <td><span className={`chip chip--${row.bound.toLowerCase()}`}>{row.bound}</span></td>
                <td className="font-mono">
                  <Tooltip title={row.locationId}>
                    <span className="truncate" style={{ maxWidth: 160, display: 'block' }}>{row.locationId}</span>
                  </Tooltip>
                </td>
                <td>
                  {row.isDerived ? (
                    <Tooltip title={`Derived ${row.derivedType} closure — calculated by engine. Cannot be manually moved.`}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-mirror)' }}>
                        <Lock size={12} />
                        {row.activityId}
                      </span>
                    </Tooltip>
                  ) : row.activityId}
                </td>
                <td>{row.contractNumber}</td>
                <td><span className={`chip chip--${row.possessionType.toLowerCase()}`}>{row.possessionType}</span></td>
                <td>{row.eclo ? <span title="ECLO night">⚡</span> : '—'}</td>
                <td className="font-mono">{row.coShareGroup ?? '—'}</td>
                <td><Badge variant={row.status}>{row.status}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
