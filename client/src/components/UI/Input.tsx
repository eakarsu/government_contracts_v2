import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  isFullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      isFullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className={`${isFullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-secondary-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {LeftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LeftIcon className="h-5 w-5 text-secondary-400" />
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              block w-full rounded-lg border transition-all duration-200
              text-secondary-900 placeholder-secondary-400
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:bg-secondary-50 disabled:text-secondary-500 disabled:cursor-not-allowed
              ${LeftIcon ? 'pl-10' : 'pl-4'}
              ${RightIcon ? 'pr-10' : 'pr-4'}
              py-2.5
              ${
                error
                  ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500/20'
                  : 'border-secondary-300 focus:border-primary-500 focus:ring-primary-500/20'
              }
              ${className}
            `.trim().replace(/\s+/g, ' ')}
            {...props}
          />
          {RightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <RightIcon className="h-5 w-5 text-secondary-400" />
            </div>
          )}
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

Input.displayName = 'Input';

export default Input;
