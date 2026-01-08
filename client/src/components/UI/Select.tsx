import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  isFullWidth?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder,
      isFullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={`${isFullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-secondary-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              block w-full rounded-lg border appearance-none transition-all duration-200
              text-secondary-900 bg-white
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed
              pl-4 pr-10 py-2.5
              ${
                error
                  ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20'
                  : 'border-secondary-300 focus:border-primary-500 focus:ring-primary-500/20'
              }
              ${className}
            `.trim().replace(/\s+/g, ' ')}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ChevronDown className="h-5 w-5 text-secondary-400" />
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-danger-600">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-secondary-500">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
