import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '12px' }}>
      <Loader2 className="btn-spinner" size={24} style={{ animation: 'spin 1s linear infinite' }} />
      {label && <span style={{ color: 'var(--ink-500)', fontSize: '12px' }}>{label}</span>}
    </div>
  );
}
