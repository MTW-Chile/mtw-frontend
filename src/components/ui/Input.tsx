import React, { useId } from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Unidad a la derecha dentro del campo (CLP, %, m²). */
  sufijo?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      sufijo,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const generado = useId();
    const inputId = id || generado;
    const derecha = rightIcon;

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className={`relative ${sufijo ? 'flex items-stretch' : ''}`}>
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full py-2.5 rounded-xl bg-slate-50 border text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 transition-all ${
              leftIcon ? 'pl-10' : 'pl-3.5'
            } ${derecha ? 'pr-10' : 'pr-3.5'} ${sufijo ? 'rounded-r-none' : ''} disabled:bg-slate-100 disabled:text-slate-500 ${
              error ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
            } ${className}`}
            {...props}
          />
          {derecha && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 flex items-center">{derecha}</div>}
          {sufijo && (
            <span className="shrink-0 flex items-center px-3 rounded-r-xl border border-l-0 border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
              {sufijo}
            </span>
          )}
        </div>
        {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
        {helperText && !error && (
          <p className="text-[11px] text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
