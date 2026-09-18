import React from 'react';

export function EmptyState({ title, body, action, icon }: { title: string, body: string, action?: React.ReactNode, icon?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      {icon && <div style={{ marginBottom: '16px' }}>{icon}</div>}
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{title}</h3>
      <p style={{ color: 'var(--ink-500)', marginBottom: '16px' }}>{body}</p>
      {action}
    </div>
  );
}
