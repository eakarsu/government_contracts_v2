import React from 'react';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'accent' | 'gradient';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  isLoading?: boolean;
  isFullWidth?: boolean;
  children: React.ReactNode;
  gradientFrom?: string;
  gradientTo?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  isLoading = false,
  isFullWidth = false,
  children,
  className = '',
  disabled,
  gradientFrom = 'from-blue-500',
  gradientTo = 'to-indigo-600',
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center font-medium
    rounded-lg transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98]
    relative overflow-hidden
  `;

  const variantClasses: Record<ButtonVariant, string> = {
    primary: `
      bg-primary-600 text-white
      hover:bg-primary-700 hover:shadow-lg hover:-translate-y-0.5
      focus:ring-primary-500
      shadow-md
    `,
    secondary: `
      bg-secondary-100 text-secondary-700
      hover:bg-secondary-200 hover:shadow-sm
      focus:ring-secondary-500
    `,
    outline: `
      border-2 border-secondary-300 text-secondary-700 bg-transparent
      hover:bg-secondary-50 hover:border-secondary-400 hover:shadow-sm
      focus:ring-secondary-500
    `,
    ghost: `
      text-secondary-600 bg-transparent
      hover:bg-secondary-100 hover:text-secondary-800
      focus:ring-secondary-500
    `,
    danger: `
      bg-danger-600 text-white
      hover:bg-danger-700 hover:shadow-lg hover:-translate-y-0.5
      focus:ring-danger-500
      shadow-md
    `,
    success: `
      bg-success-600 text-white
      hover:bg-success-700 hover:shadow-lg hover:-translate-y-0.5
      focus:ring-success-500
      shadow-md
    `,
    accent: `
      bg-accent-600 text-white
      hover:bg-accent-700 hover:shadow-lg hover:-translate-y-0.5
      focus:ring-accent-500
      shadow-md
    `,
    gradient: `
      bg-gradient-to-r ${gradientFrom} ${gradientTo} text-white
      hover:shadow-xl hover:-translate-y-0.5 hover:scale-[1.02]
      focus:ring-blue-500
      shadow-lg
      before:absolute before:inset-0 before:bg-white/0 before:transition-all before:duration-300
      hover:before:bg-white/10
    `,
  };

  const sizeClasses: Record<ButtonSize, string> = {
    xs: 'text-xs px-2.5 py-1.5 gap-1',
    sm: 'text-sm px-3 py-2 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-5 py-3 gap-2',
    xl: 'text-lg px-6 py-3.5 gap-2.5',
  };

  const iconSizes: Record<ButtonSize, string> = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-5 w-5',
  };

  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isFullWidth ? 'w-full' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className={`animate-spin ${iconSizes[size]} ${LeftIcon || RightIcon ? 'mr-2' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : LeftIcon ? (
        <LeftIcon className={iconSizes[size]} />
      ) : null}
      {children}
      {!isLoading && RightIcon && <RightIcon className={iconSizes[size]} />}
    </button>
  );
};

export default Button;
