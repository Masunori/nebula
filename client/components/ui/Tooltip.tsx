import React from 'react';

export function Tooltip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tooltip-wrap" title={title}>
      {children}
      <span className="tooltip-text">{title}</span>
    </div>
  );
}
