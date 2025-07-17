import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const base = 'rounded-lg font-sf-pro font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gold-500/50';
    const variants: Record<string, string> = {
      primary: 'bg-gold-500 text-white hover:bg-gold-600',
      secondary: 'bg-white/10 text-white hover:bg-white/20',
      ghost: 'bg-transparent text-white hover:bg-white/10',
      outline: 'border border-white/20 text-white hover:bg-white/10',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
    };
    const sizes: Record<string, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2 text-base',
      lg: 'px-7 py-3 text-lg',
      icon: 'p-2',
    };
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button'; 