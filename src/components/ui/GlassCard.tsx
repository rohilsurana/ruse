import type { HTMLAttributes } from 'react';

export function GlassCard({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`glass p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
