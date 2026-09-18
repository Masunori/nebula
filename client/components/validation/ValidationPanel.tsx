'use client';
import React, { useState } from 'react';
import type { ValidationResult } from '@/types/validation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RefreshCw, AlertOctagon } from 'lucide-react';

interface ValidationPanelProps {
  result: ValidationResult | null;
  onRevalidate: () => Promise<void>;
}

export function ValidationPanel({ result, onRevalidate }: ValidationPanelProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  if (!result) return null;

  const handleRecheck = async () => {
    setIsChecking(true);
    setCheckMessage(null);
    try {
      await onRevalidate();
      setCheckMessage('Timetable checks updated.');
    } catch {
      setCheckMessage('The timetable could not be re-checked. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="validation-panel">
      {/* Header */}
      <div className="val-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="val-section-label">Timetable Validation</span>
          <div className="feasibility-badge" style={{ marginTop: 4 }}>
            <Badge variant={result.feasible ? 'valid' : 'invalid'}>
              {result.feasible ? '✓ Feasible' : '✗ Infeasible'}
            </Badge>
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>
            Validated {new Date(result.validatedAt).toLocaleTimeString()}
          </p>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={12} />} onClick={handleRecheck} loading={isChecking}>
          {isChecking ? 'Re-checking...' : 'Re-check'}
        </Button>
      </div>
      {checkMessage && (
        <p className="validation-check-message" role="status" aria-live="polite">
          {checkMessage}
        </p>
      )}

      {/* Objective score breakdown */}
      <div className="val-section">
        <span className="val-section-label">Objective Score (Scenario {result.scenario})</span>
        <div className="score-display" style={{ marginTop: 4 }}>
          {result.softScores?.priorityWeightedScore?.toLocaleString() ?? 0}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="score-row">
            <span className="score-row-label">Overrun days</span>
            <span className="score-row-value">{result.softScores?.overrunDaysTotal ?? 0}d</span>
          </div>
          <div className="score-row">
            <span className="score-row-label">Overrunning contracts</span>
            <span className="score-row-value">{result.softScores?.contractsOverrunning ?? 0}</span>
          </div>
          <div className="score-row">
            <span className="score-row-label">Excess access nights</span>
            <span className="score-row-value">{result.softScores?.excessAccessNightsTotal ?? 0}</span>
          </div>
          <div className="score-row">
            <span className="score-row-label">ECLO nights used</span>
            <span className="score-row-value">{result.softScores?.ecloNightsTotal ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Hard violations */}
      <div className="val-section">
        <span className="val-section-label">Rules That Must Be Met</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {result.hardViolations.length > 0 ? (
            <>
              <AlertOctagon size={20} style={{ color: 'var(--status-red)' }} />
              <span className="violation-count">{result.hardViolations.length}</span>
              <span style={{ fontSize: 12, color: 'var(--status-red)', fontWeight: 500 }}>
                Schedule issues need attention
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--status-green)', fontWeight: 500 }}>
              0 hard violations (all non-negotiables met)
            </span>
          )}
        </div>
      </div>

      {/* Capacity Hotspots */}
      <div className="val-section">
        <span className="val-section-label">Interchange & Bottlenecks</span>
        <div style={{ marginTop: 6 }}>
          {result.capacityHotspots.map(h => (
            <div key={`${h.locationId}-${h.week}`} className="hotspot-item">
              <span className="hotspot-loc truncate" style={{ maxWidth: 180 }}>
                {h.locationId} ({h.calendarWeek})
              </span>
              <span className={`hotspot-cap ${h.usedCapacity >= h.maxCapacity ? 'at-limit' : ''}`}>
                {h.usedCapacity}/{h.maxCapacity} {h.usedCapacity >= h.maxCapacity ? 'LIMIT' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
