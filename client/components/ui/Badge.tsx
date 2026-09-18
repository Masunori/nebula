import React from 'react';

interface BadgeProps {
  variant?:
    | 'valid' | 'invalid' | 'pending' | 'unvalidated' | 'info'
    | 'queued' | 'optimizing' | 'validating' | 'ready' | 'failed'
    | 'scenario-a' | 'scenario-b' | 'scenario-c'
    | string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Badge({ variant = 'info', children, icon }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`}>
      {icon}
      {children}
    </span>
  );
}
