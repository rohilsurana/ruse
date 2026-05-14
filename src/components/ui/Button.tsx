import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-gold/90 hover:bg-gold text-midnight-dark font-semibold shadow-lg shadow-gold/20',
  secondary: 'bg-midnight-light hover:bg-midnight border border-gold/20 text-parchment',
  danger: 'bg-crimson/80 hover:bg-crimson text-parchment shadow-lg shadow-crimson/20',
  ghost: 'bg-transparent hover:bg-parchment/5 text-parchment/70 hover:text-parchment',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`px-5 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
