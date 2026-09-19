'use client';
import React, { useMemo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TimetableRow, LineCode, Bound } from '@/types/planning';
import { Lock } from 'lucide-react';

interface GanttTimelineProps {
  rows: TimetableRow[];
  highlightCellKey?: string | null;
  onSelectActivity?: (activityId: string) => void;
  editable?: boolean;
}

// CW01–CW30 months (2027-01-04 start)
const CW_MONTHS: Record<number, string> = {
  1: 'Jan', 2: 'Jan', 3: 'Jan', 4: 'Jan',
  5: 'Feb', 6: 'Feb', 7: 'Feb', 8: 'Feb',
  9: 'Mar', 10: 'Mar', 11: 'Mar', 12: 'Mar',
  13: 'Apr', 14: 'Apr', 15: 'Apr', 16: 'Apr',
  17: 'May', 18: 'May', 19: 'May', 20: 'May',
  21: 'Jun', 22: 'Jun', 23: 'Jun', 24: 'Jun',
  25: 'Jul', 26: 'Jul', 27: 'Jul', 28: 'Jul',
  29: 'Aug', 30: 'Aug',
};

const WEEKS = Array.from({ length: 30 }, (_, i) => i + 1);

type GroupKey = `${LineCode}-${Bound}`;

function DraggableActivity({ activity, onSelectActivity }: { activity: TimetableRow; onSelectActivity?: (activityId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `activity:${activity.activityId}:${activity.accessSeq}`,
    data: { activity },
  });

  return (
    <div
      ref={setNodeRef}
      className={`gantt-block gantt-block--${activity.activityType.toLowerCase()} dnd-draggable${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      title={`Move ${activity.activityId} to another timetable slot`}
      onClick={() => onSelectActivity?.(activity.activityId)}
      {...attributes}
      {...listeners}
      onKeyDown={event => {
        if (event.key === 'Enter') onSelectActivity?.(activity.activityId);
      }}
    >
      {activity.activityId}
    </div>
  );
}

function DroppableSlot({
  locationId,
  week,
  className,
  children,
}: {
  locationId: string;
  week: number;
  className: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot:${week}:${locationId}` });

  return (
    <td ref={setNodeRef} className={`${className}${isOver ? ' dnd-over' : ''}`}>
      {children}
    </td>
  );
}

export function GanttTimeline({ rows, highlightCellKey, onSelectActivity, editable = false }: GanttTimelineProps) {
  // Group rows: line → bound → location → week → activities
  const structure = useMemo(() => {
    const groups: Map<GroupKey, Map<string, Map<number, TimetableRow[]>>> = new Map();

    for (const row of rows) {
      const gk: GroupKey = `${row.lineCode}-${row.bound}`;
      if (!groups.has(gk)) groups.set(gk, new Map());
      const byLoc = groups.get(gk)!;
      if (!byLoc.has(row.locationId)) byLoc.set(row.locationId, new Map());
      const byWeek = byLoc.get(row.locationId)!;
      if (!byWeek.has(row.week)) byWeek.set(row.week, []);
      byWeek.get(row.week)!.push(row);
    }
    return groups;
  }, [rows]);

  const groupKeys = Array.from(structure.keys()).sort();

  return (
    <div className="gantt-outer">
      <table className="gantt-table" aria-label="Gantt timeline">
        <thead>
          {/* Month row */}
          <tr>
            <th className="location-col" />
            {WEEKS.map((w, i) => {
              const month = CW_MONTHS[w];
              const prevMonth = i > 0 ? CW_MONTHS[w - 1] : null;
              return (
                <th
                  key={w}
                  className={month !== prevMonth ? 'month-header' : ''}
                  title={`CW${String(w).padStart(2, '0')}`}
                >
                  {month !== prevMonth ? month : ''}
                </th>
              );
            })}
          </tr>
          {/* CW row */}
          <tr>
            <th className="location-col">Location</th>
            {WEEKS.map(w => (
              <th key={w}>CW{String(w).padStart(2, '0')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupKeys.map(gk => {
            const [line, bound] = gk.split('-');
            const locMap = structure.get(gk)!;
            const locs = Array.from(locMap.keys()).sort();

            return (
              <React.Fragment key={gk}>
                {/* Group header row */}
                <tr>
                  <td className="location-cell group-header" colSpan={31}>
                    {line} — {bound}
                  </td>
                </tr>
                {locs.map(loc => {
                  const weekMap = locMap.get(loc)!;
                  return (
                    <tr key={loc}>
                      <td className="location-cell" title={loc}>
                        <span className="truncate" style={{ maxWidth: 210, display: 'block' }}>{loc}</span>
                      </td>
                      {WEEKS.map(w => {
                        const acts = weekMap.get(w) ?? [];
                        const cellKey = acts[0] ? `${acts[0].activityId}:${w}:${loc}` : null;
                        const isHl = cellKey === highlightCellKey;
                        const cellClassName = [
                              isHl ? 'row--highlight' : '',
                            ].filter(Boolean).join(' ');
                        const blocks = acts.map((act, idx) => (
                          editable && !act.isDerived ? (
                            <DraggableActivity key={`${act.activityId}-${idx}`} activity={act} onSelectActivity={onSelectActivity} />
                          ) : act.isDerived ? (
                            <div
                              key={`${act.activityId}-${idx}`}
                              className="gantt-block gantt-block--derived dnd-locked"
                              title="Generated closure. It updates automatically when its linked work activity moves."
                            >
                              <Lock size={10} aria-hidden /> Closure
                            </div>
                          ) : (
                            <div
                              key={`${act.activityId}-${idx}`}
                              className={`gantt-block gantt-block--${act.isDerived ? 'derived' : act.activityType.toLowerCase()}`}
                              title={`${act.activityId} (${act.contractNumber}) — ${act.activityType}${act.eclo ? ' ECLO' : ''}`}
                              onClick={() => onSelectActivity?.(act.activityId)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={e => {
                                if (e.key === 'Enter') onSelectActivity?.(act.activityId);
                              }}
                            >
                              {act.activityId}
                            </div>
                          )
                        ));

                        return editable ? (
                          <DroppableSlot key={w} locationId={loc} week={w} className={cellClassName}>
                            {blocks}
                          </DroppableSlot>
                        ) : (
                          <td key={w} className={cellClassName}>{blocks}</td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
