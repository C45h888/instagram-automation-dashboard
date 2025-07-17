import React from 'react';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`rounded-lg bg-white/10 border border-white/20 text-white px-4 py-2 font-sf-pro placeholder:text-white/50 focus:border-gold-500/50 focus:outline-none ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea'; 