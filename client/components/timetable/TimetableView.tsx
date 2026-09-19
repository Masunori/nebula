'use client';
import React, { useState } from 'react';
import type { TimetableRow } from '@/types/planning';
import { DispatchTable } from './DispatchTable';
import { GanttTimeline } from './GanttTimeline';
import { CalendarDays, GripVertical, Lock } from 'lucide-react';

interface TimetableViewProps {
  rows: TimetableRow[];
  highlightCellKey?: string | null;
  onSelectActivity?: (activityId: string) => void;
  editable?: boolean;
}

export function TimetableView({ rows, highlightCellKey, onSelectActivity, editable = false }: TimetableViewProps) {
  const [view, setView] = useState<'timeline' | 'table'>('timeline');

  return (
    <div>
      <div className="timetable-toolbar">
        <div className="seg-control" style={{ width: 220 }}>
          <button
            className={`seg-btn${view === 'timeline' ? ' active' : ''}`}
            onClick={() => setView('timeline')}
            aria-pressed={view === 'timeline'}
          >
            Timeline
          </button>
          <button
            className={`seg-btn${view === 'table' ? ' active' : ''}`}
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
          >
            Dispatch Table
          </button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
          {rows.length} row{rows.length !== 1 ? 's' : ''}
        </span>
        {editable && (
          <span className="edit-mode-notice"><GripVertical size={14} /> Work blocks can move; closure markers update automatically</span>
        )}
      </div>
      <div className="timetable-legend" aria-label="Timetable legend">
        <span className="legend-item"><span className="legend-swatch legend-swatch--renewal" aria-hidden /> Renewal work</span>
        <span className="legend-item"><span className="legend-swatch legend-swatch--construction" aria-hidden /> Construction work</span>
        <span className="legend-item"><span className="legend-swatch legend-swatch--closure" aria-hidden><Lock size={10} /></span> Generated closure</span>
        <span className="legend-item legend-cw"><CalendarDays size={13} /> CW = calendar week</span>
      </div>
      <div>
        {view === 'timeline'
          ? <GanttTimeline rows={rows} highlightCellKey={highlightCellKey} onSelectActivity={onSelectActivity} editable={editable} />
          : <DispatchTable rows={rows} highlightCellKey={highlightCellKey} />
        }
      </div>
    </div>
  );
}
