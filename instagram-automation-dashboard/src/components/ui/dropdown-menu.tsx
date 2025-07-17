import React, { useState } from 'react';

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <div className="relative inline-block">{children}</div>;
}

export function DropdownMenuTrigger({ children, asChild = false, ...props }: any) {
  return asChild ? children : <button {...props}>{children}</button>;
}

export function DropdownMenuContent({ children, align = 'start', className = '', ...props }: any) {
  return (
    <div
      className={`absolute z-50 mt-2 min-w-[10rem] rounded-xl bg-gray-800 border border-gray-700 shadow-lg p-2 ${className}`}
      style={{ [align]: 0 }}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ children, className = '', ...props }: any) {
  return (
    <div className={`px-4 py-2 rounded-lg cursor-pointer hover:bg-white/10 text-white ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = '', ...props }: any) {
  return <div className={`my-2 border-t border-gray-700 ${className}`} {...props} />;
} 