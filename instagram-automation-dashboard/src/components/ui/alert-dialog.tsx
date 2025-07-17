import React, { useState } from 'react';

export function AlertDialog({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function AlertDialogTrigger({ children, asChild = false, ...props }: any) {
  return asChild ? children : <button {...props}>{children}</button>;
}

export function AlertDialogContent({ children, className = '', ...props }: any) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 ${className}`} {...props}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl p-8 max-w-lg w-full">
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ children, className = '', ...props }: any) {
  return <div className={`mb-4 ${className}`} {...props}>{children}</div>;
}

export function AlertDialogTitle({ children, className = '', ...props }: any) {
  return <h2 className={`text-xl font-bold text-white font-sf-pro ${className}`} {...props}>{children}</h2>;
}

export function AlertDialogDescription({ children, className = '', ...props }: any) {
  return <p className={`text-gray-300 font-sf-pro ${className}`} {...props}>{children}</p>;
}

export function AlertDialogFooter({ children, className = '', ...props }: any) {
  return <div className={`mt-6 flex justify-end space-x-4 ${className}`} {...props}>{children}</div>;
}

export function AlertDialogAction({ children, className = '', ...props }: any) {
  return <button className={`bg-red-600 text-white px-4 py-2 rounded-lg font-sf-pro font-medium hover:bg-red-700 ${className}`} {...props}>{children}</button>;
}

export function AlertDialogCancel({ children, className = '', ...props }: any) {
  return <button className={`bg-gray-700 text-white px-4 py-2 rounded-lg font-sf-pro font-medium hover:bg-gray-600 ${className}`} {...props}>{children}</button>;
} 