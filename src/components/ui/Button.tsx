import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'subtle';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-[#E34A26] hover:bg-[#C13615] active:bg-[#A92E11] text-white shadow-xs border border-transparent font-bold',
      secondary:
        'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-xs border border-transparent font-bold',
      outline:
        'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 shadow-xs font-semibold',
      ghost:
        'bg-transparent hover:bg-slate-100 active:bg-slate-200/80 text-slate-600 hover:text-slate-900 font-medium',
      danger:
        'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs border border-transparent font-bold',
      subtle:
        'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-semibold',
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
      md: 'text-xs px-4 py-2 rounded-xl gap-2',
      lg: 'text-sm px-5 py-2.5 rounded-xl gap-2.5',
      icon: 'p-2 rounded-xl justify-center',
    };

    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
