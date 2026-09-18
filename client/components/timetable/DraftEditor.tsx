'use client';
import React, { useState } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import type { TimetableRow } from '@/types/planning';
import type { ValidationResult } from '@/types/validation';
import { TimetableView } from './TimetableView';
import { Button } from '@/components/ui/Button';
import { RotateCcw, Check, Sparkles } from 'lucide-react';
import { updateDraft, validateDraft } from '@/lib/api';

export function DraftEditor({
  runId,
  rows,
  highlightCellKey,
  onValidated,
}: {
  runId: string;
  rows: TimetableRow[];
  highlightCellKey?: string | null;
  onValidated: (result: ValidationResult) => void;
}) {
  const [localRows, setLocalRows] = useState(rows);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activity = active.data.current?.activity as TimetableRow | undefined;
    const [, weekText, ...locationParts] = String(over.id).split(':');
    const week = Number(weekText);
    const locationId = locationParts.join(':');
    if (!activity || !week || !locationId) return;

    const locationPartsForLine = locationId.split(':');
    const lineCode = locationPartsForLine[1] as TimetableRow['lineCode'];
    const bound = locationPartsForLine.at(-1) as TimetableRow['bound'];

    setLocalRows(currentRows => currentRows.map(row => (
      row.activityId === activity.activityId && row.accessSeq === activity.accessSeq && !row.isDerived
        ? { ...row, week, calendarWeek: `CW${String(week).padStart(2, '0')}`, locationId, lineCode, bound, status: 'pending' }
        : row
    )));
    setSaveMessage(`Draft updated: ${activity.activityId} moved to CW${String(week).padStart(2, '0')}. Validate the draft to check all rules.`);
  };

  const handleValidate = async () => {
    setSaving(true);
    await updateDraft(runId, []);
    const result = await validateDraft(runId);
    onValidated(result);
    setSaving(false);
    setSaveMessage('Draft timetable validation is complete');
  };

  const handleReset = () => {
    setLocalRows(rows);
    setSaveMessage('Reverted draft to baseline');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="editor-toolbar">
        <Button variant="secondary" size="sm" leftIcon={<RotateCcw size={14} />} onClick={handleReset}>
          Reset Changes
        </Button>
        <Button variant="primary" size="sm" leftIcon={<Sparkles size={14} />} onClick={handleValidate} loading={saving}>
          Validate Draft
        </Button>
        <div className="toolbar-sep" />
        {saveMessage && (
          <span style={{ fontSize: 12, color: 'var(--teal-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={14} /> {saveMessage}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <TimetableView rows={localRows} highlightCellKey={highlightCellKey} editable />
        </DndContext>
      </div>
    </div>
  );
}
