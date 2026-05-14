import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-4 py-2.5 rounded-lg bg-midnight-light border border-gold/20 text-parchment placeholder:text-parchment/30 focus:outline-none focus:border-gold/50 transition-colors text-sm ${className}`}
      {...props}
    />
  );
}
