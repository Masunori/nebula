'use client';
import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { StatusIcon } from '@/components/ui/StatusIcon';
import type { RunStatus, ValidationState } from '@/types/planning';

export function RunStatusBadge({ status, validation }: { status: RunStatus, validation: ValidationState }) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Badge variant={status === 'ready' ? 'valid' : 'info'} icon={<StatusIcon status={status} size={14} />}>
        {status}
      </Badge>
      {status === 'ready' && (
        <Badge variant={validation} icon={<StatusIcon status={validation} size={14} />}>
          {validation}
        </Badge>
      )}
    </div>
  );
}
