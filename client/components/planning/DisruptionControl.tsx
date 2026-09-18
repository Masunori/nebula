'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { reoptimizeRevision } from '@/lib/api';

export function DisruptionControl() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [impact, setImpact] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    await reoptimizeRevision('run-001');
    setLoading(false);
    setImpact('Re-optimized: 3 activities moved, score -29.4');
  };

  return (
    <div className="disruption-panel">
      <div className="disruption-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        <span style={{ fontWeight: 600 }}>Disruption / Change Input</span>
      </div>
      {open && (
        <div className="disruption-body">
          <p style={{ fontSize: '12px', color: 'var(--ink-600)', marginBottom: '16px' }}>
            Disruption re-plan — this creates a new draft revision and queues re-optimization. This is distinct from a manual timetable edit.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <select className="form-input">
                <option value="SEC:ALP:S02_S03:EB">SEC:ALP:S02_S03:EB</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">New Capacity</label>
              <input type="number" min="0" max="4" className="form-input" defaultValue="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">From Week</label>
              <input type="number" className="form-input" defaultValue="1" />
            </div>
            <div className="form-group">
              <label className="form-label">To Week</label>
              <input type="number" className="form-input" defaultValue="4" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Reason</label>
              <textarea className="form-input" rows={2}></textarea>
            </div>
          </div>
          <Button variant="primary" onClick={handleSave} loading={loading}>Save & Re-optimize</Button>
          {impact && <div style={{ marginTop: '16px', padding: '8px', background: 'var(--status-green-bg)', color: 'var(--status-green)', borderRadius: '4px' }}>{impact}</div>}
        </div>
      )}
    </div>
  );
}
