'use client';

import { useState, useRef, useEffect } from 'react';

interface InlineInputProps {
  onSave: (value: string) => void;
  onCancel: () => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  error?: string | null;
}

export default function InlineInput({
  onSave,
  onCancel,
  defaultValue = '',
  placeholder = 'Enter name...',
  className = '',
  error = null,
}: InlineInputProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSave(trimmedValue);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Auto-cancel on blur
    onCancel();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  return (
    <div className={`inline-input-container relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`flex-1 px-2 py-1 text-sm rounded focus:outline-none text-white min-w-0 ${
          error 
            ? 'bg-red-900/50 border border-red-500 focus:border-red-400' 
            : 'bg-[#3c3c3c] border border-[#007acc] focus:border-[#007acc]'
        }`}
        title={error || "Press Enter to save, Escape to cancel"}
      />
      {error && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-red-900 border border-red-600 rounded text-xs text-red-200 z-10 whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}