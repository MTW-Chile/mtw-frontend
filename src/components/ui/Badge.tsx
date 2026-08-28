import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'brand'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'outline'
  | 'subtle';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    brand: 'bg-[#E34A26]/10 text-[#E34A26] border-[#E34A26]/20 font-bold',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
    info: 'bg-sky-50 text-sky-700 border-sky-200 font-semibold',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
    outline: 'bg-transparent text-slate-600 border-slate-300',
    subtle: 'bg-slate-50 text-slate-500 border-slate-200/60',
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-slate-400',
    brand: 'bg-[#E34A26]',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    info: 'bg-sky-500',
    danger: 'bg-rose-500',
    outline: 'bg-slate-400',
    subtle: 'bg-slate-400',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
    lg: 'text-xs px-3 py-1 gap-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-full border tracking-wide whitespace-nowrap shrink-0 select-none transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
};
