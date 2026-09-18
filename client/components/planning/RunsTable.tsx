'use client';
import React from 'react';
import Link from 'next/link';
import type { PlanningRun } from '@/types/planning';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Eye, GitCompare } from 'lucide-react';
import { StatusIcon } from '@/components/ui/StatusIcon';

export function RunsTable({ runs, loading }: { runs: PlanningRun[]; loading: boolean }) {
  if (loading) return <LoadingSpinner />;
  if (runs.length === 0) return <EmptyState title="No runs found" body="Create a new planning run to get started." />;

  return (
    <table className="data-table runs-table">
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Revision</th>
          <th>Validation</th>
          <th>Score</th>
          <th>Violations</th>
          <th>Editor</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {runs.map(run => (
          <tr key={run.runId}>
            <td>
              <Badge variant={`scenario-${run.scenario.toLowerCase()}`}>{run.scenario}</Badge>
            </td>
            <td>{run.revisionType === 'draft' ? `Draft ${run.revisionNumber}` : `Rev ${run.revisionNumber}`}</td>
            <td>
              <Badge variant={run.validationState} icon={<StatusIcon status={run.validationState} size={14} />}>
                {run.validationState}
              </Badge>
            </td>
            <td className="font-mono">{run.objectiveScore ?? '——'}</td>
            <td>
              {run.hardViolationCount > 0 ? (
                <Badge variant="invalid">{run.hardViolationCount}</Badge>
              ) : '—'}
            </td>
            <td>{run.updatedBy.name}</td>
            <td>{new Date(run.updatedAt).toLocaleDateString()}</td>
            <td>
              <div style={{ display: 'flex', gap: '4px' }}>
                <Tooltip title="View Run">
                  <Link href={`/runs/${run.runId}`}>
                    <Button variant="ghost" size="sm" leftIcon={<Eye size={16} />} />
                  </Link>
                </Tooltip>
                {run.parentRunId && (
                  <Tooltip title="Compare Revisions">
                    <Link href={`/runs/${run.runId}/compare`}>
                      <Button variant="ghost" size="sm" leftIcon={<GitCompare size={16} />} />
                    </Link>
                  </Tooltip>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
