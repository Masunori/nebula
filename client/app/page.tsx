'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { listRuns, solveScenarioRemote } from '@/lib/api';
import type { PlanningRun } from '@/types/planning';
import { OperationalSummary, type OperationalSummaryMetrics } from '@/components/planning/OperationalSummary';
import { RunsTable } from '@/components/planning/RunsTable';
import { DisruptionControl } from '@/components/planning/DisruptionControl';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [runs, setRuns] = useState<PlanningRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OperationalSummaryMetrics>({
    scheduledNights: 193,
    totalActivities: 54,
    scheduledActivities: 54,
    isFeasible: true,
    scenario: 'A',
    awaitingRecalculation: false,
    objectiveScore: 0,
    violationsCount: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const [runsData, solRes] = await Promise.all([
        listRuns(),
        fetch('/api/solver/persisted?scenario=A').then(r => r.json()).catch(() => null),
      ]);
      setRuns(runsData);

      if (solRes && solRes.has_solution) {
        setMetrics({
          scheduledNights: 193,
          totalActivities: 54,
          scheduledActivities: 54,
          isFeasible: solRes.feasible,
          scenario: 'A',
          awaitingRecalculation: false,
          objectiveScore:
            solRes.soft_scores?.penalty_score ??
            solRes.soft_scores?.priority_weighted_score ??
            solRes.soft_scores?.objective_score ??
            0,
          violationsCount: solRes.hard_violations?.length ?? 0,
        });
      } else {
        setMetrics(prev => ({
          ...prev,
          awaitingRecalculation: true,
        }));
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleDbUpdate = () => {
      setMetrics(prev => ({
        ...prev,
        awaitingRecalculation: true,
      }));
    };
    window.addEventListener('nebula_database_updated', handleDbUpdate);

    return () => {
      window.removeEventListener('nebula_database_updated', handleDbUpdate);
    };
  }, [loadData]);

  const handleDisruptionRecalc = async () => {
    setLoading(true);
    try {
      await solveScenarioRemote('A', 30);
      await loadData();
    } catch (e) {
      console.error('Auto recalculate failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-dashboard page-wrap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Planning Runs</h1>
          <p className="page-subtitle">Line Alpha · Line Beta · Horizon CW01–CW30 2027</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/schedule">
            <Button variant="secondary">View Master Schedule</Button>
          </Link>
          <Link href="/database">
            <Button variant="secondary">Database Studio</Button>
          </Link>
          <Link href="/upload">
            <Button variant="primary" leftIcon={<Plus size={16} />}>New planning run</Button>
          </Link>
        </div>
      </div>
      <OperationalSummary runs={runs} metrics={metrics} />
      <RunsTable runs={runs} loading={loading} />
      <DisruptionControl onDisruptionApplied={handleDisruptionRecalc} />
    </div>
  );
}
