import React from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  indicatorClassName?: string;
}

export function Progress({ value, className = '', indicatorClassName = '', ...props }: ProgressProps) {
  return (
    <div className={`w-full bg-gray-700/30 rounded-full h-3 ${className}`} {...props}>
      <div
        className={`h-3 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-700 ${indicatorClassName}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
} 