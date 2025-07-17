import React from 'react';

export function Badge({ className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-sf-pro font-semibold bg-white/10 text-white/80 border border-white/20 ${className}`} {...props} />;
} 