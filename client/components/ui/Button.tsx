import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, `btn--${size}`, className].filter(Boolean).join(' ');
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cls}
      aria-busy={loading}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
