import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

export function StatusIcon({ status, size = 16 }: { status: string, size?: number }) {
  if (status === 'valid' || status === 'ok' || status === 'ready') return <CheckCircle2 size={size} />;
  if (status === 'invalid' || status === 'error' || status === 'failed') return <XCircle size={size} />;
  if (status === 'pending' || status === 'warning') return <AlertCircle size={size} />;
  if (status === 'queued') return <Clock size={size} />;
  if (status === 'optimizing' || status === 'validating') return <Loader2 size={size} style={{ animation: 'spin 1s linear infinite' }} />;
  return <Clock size={size} />;
}
