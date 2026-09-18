'use client';
import React, { useEffect, useState } from 'react';
import { listRuns } from '@/lib/api';
import type { PlanningRun } from '@/types/planning';
import { OperationalSummary } from '@/components/planning/OperationalSummary';
import { RunsTable } from '@/components/planning/RunsTable';
import { DisruptionControl } from '@/components/planning/DisruptionControl';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [runs, setRuns] = useState<PlanningRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRuns().then(r => { setRuns(r); setLoading(false); });
  }, []);

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
      <OperationalSummary runs={runs} />
      <RunsTable runs={runs} loading={loading} />
      <DisruptionControl />
    </div>
  );
}
