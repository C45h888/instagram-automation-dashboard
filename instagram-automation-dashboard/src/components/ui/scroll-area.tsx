import React from 'react';

export function ScrollArea({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`overflow-y-auto custom-scrollbar rounded-xl ${className}`} {...props}>
      {children}
    </div>
  );
} 