import React from 'react';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className = '', ...props }: SwitchProps) {
  return (
    <label className={`inline-flex items-center cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onCheckedChange(e.target.checked)}
        className="sr-only"
        {...props}
      />
      <span className={`w-10 h-6 flex items-center bg-gray-700 rounded-full p-1 duration-300 ease-in-out ${checked ? 'bg-gold-500' : 'bg-gray-700'}`}>
        <span className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? 'translate-x-4' : ''}`}></span>
      </span>
    </label>
  );
} 