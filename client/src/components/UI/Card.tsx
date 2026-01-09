import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  animate?: boolean;
  variant?: 'default' | 'gradient' | 'bordered' | 'elevated';
  gradientFrom?: string;
  gradientTo?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  gradient?: boolean;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<CardBodyProps>;
  Footer: React.FC<CardFooterProps>;
} = ({
  children,
  className = '',
  hover = false,
  padding = 'md',
  animate = false,
  variant = 'default',
  gradientFrom = 'from-blue-500',
  gradientTo = 'to-indigo-600',
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const variantClasses = {
    default: 'bg-white border border-gray-100 shadow-card',
    gradient: `bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white shadow-lg`,
    bordered: 'bg-white border-2 border-gray-200 shadow-sm',
    elevated: 'bg-white border border-gray-100 shadow-lg',
  };

  const hoverClasses = hover
    ? variant === 'gradient'
      ? 'transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]'
      : 'transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-gray-200'
    : '';

  return (
    <div
      className={`
        rounded-xl
        ${variantClasses[variant]}
        ${hoverClasses}
        ${animate ? 'animate-fade-in-up' : ''}
        ${paddingClasses[padding]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  );
};

const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '', action, gradient = false }) => (
  <div className={`flex items-center justify-between pb-4 border-b ${gradient ? 'border-white/20 bg-gradient-to-r from-gray-50 to-white -mx-6 -mt-6 px-6 pt-6 mb-4 rounded-t-xl' : 'border-gray-100'} ${className}`}>
    <div className="flex-1">{children}</div>
    {action && <div className="ml-4">{action}</div>}
  </div>
);

const CardBody: React.FC<CardBodyProps> = ({ children, className = '' }) => (
  <div className={`py-4 ${className}`}>{children}</div>
);

const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => (
  <div className={`pt-4 border-t border-gray-100 ${className}`}>{children}</div>
);

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
