import React, { useEffect, useId, useState } from 'react';

/**
 * Campos de formulario (DESIGN.md 5), con la misma API que Input y Select:
 * label arriba, helperText debajo, error en rose.
 */

const BASE =
  'w-full rounded-xl bg-slate-50 border text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 transition-all disabled:bg-slate-100 disabled:text-slate-500';
/** Control compacto para tablas editables en línea. */
export const CAMPO_COMPACTO =
  'text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-600 bg-white disabled:bg-slate-50 disabled:text-slate-500';

/** Envoltorio de un campo: etiqueta, control, ayuda y error. */
export const Campo: React.FC<{ label?: React.ReactNode; htmlFor?: string; helperText?: React.ReactNode; error?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  helperText,
  error,
  children,
}) => (
  <div className="space-y-1.5 w-full">
    {label && (
      <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
        {label}
      </label>
    )}
    {children}
    {error ? <p className="text-[11px] font-semibold text-rose-600">{error}</p> : helperText ? <p className="text-[11px] text-slate-400">{helperText}</p> : null}
  </div>
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: React.ReactNode; helperText?: React.ReactNode; error?: string }
>(({ label, helperText, error, className = '', id, ...props }, ref) => {
  const generado = useId();
  const idCampo = id ?? generado;
  return (
    <Campo label={label} htmlFor={idCampo} helperText={helperText} error={error}>
      <textarea ref={ref} id={idCampo} className={`${BASE} px-3.5 py-2.5 ${error ? 'border-rose-300' : 'border-slate-200'} ${className}`} {...props} />
    </Campo>
  );
});
Textarea.displayName = 'Textarea';

/**
 * Número editable que guarda al salir del campo o con Enter (no en cada
 * tecla). Acepta coma decimal. `compacto` para tablas editables en línea.
 */
export const NumeroInput: React.FC<{
  valor: number | null;
  onGuardar: (v: number | null) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  /** Vacío vale null (si no, vuelve al valor anterior). */
  permiteVacio?: boolean;
  compacto?: boolean;
  sufijo?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
  placeholder?: string;
}> = ({ valor, onGuardar, disabled, min, max, permiteVacio, compacto = true, sufijo, className = 'w-24', placeholder, ...rest }) => {
  const [texto, setTexto] = useState(valor == null ? '' : String(valor));
  useEffect(() => setTexto(valor == null ? '' : String(valor)), [valor]);
  const confirmar = () => {
    if (texto.trim() === '') {
      if (permiteVacio && valor !== null) onGuardar(null);
      else setTexto(valor == null ? '' : String(valor));
      return;
    }
    let n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n)) return setTexto(valor == null ? '' : String(valor));
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    if (n !== valor) onGuardar(n);
    else setTexto(String(valor));
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="text"
        inputMode="decimal"
        value={texto}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={rest['aria-label']}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={`${compacto ? CAMPO_COMPACTO : `${BASE} px-3.5 py-2.5 border-slate-200`} text-right tabular-nums ${className}`}
      />
      {sufijo && <span className="text-[11px] text-slate-400">{sufijo}</span>}
    </span>
  );
};

/** Interruptor sí/no para ajustes. Con `label`, va con su texto al lado. */
export const Interruptor: React.FC<{
  valor: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Nombre accesible (y title). */
  etiqueta: string;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
}> = ({ valor, onChange, disabled, etiqueta, label, helperText }) => {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={() => onChange(!valor)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
        valor ? 'bg-brand-600' : 'bg-slate-300'
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${valor ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
  if (!label) return control;
  return (
    <div className="flex items-start gap-2.5 text-xs">
      {control}
      <span>
        <span className="block font-bold text-slate-800">{label}</span>
        {helperText && <span className="block text-[11px] text-slate-500">{helperText}</span>}
      </span>
    </div>
  );
};

/** Casilla para elegir elementos de una lista. */
export const Casilla: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: React.ReactNode; 'aria-label'?: string }> = ({
  checked,
  onChange,
  disabled,
  label,
  ...rest
}) => (
  <label className={`inline-flex items-center gap-2 text-xs ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <input
      type="checkbox"
      className="accent-brand-600 w-3.5 h-3.5"
      checked={checked}
      disabled={disabled}
      aria-label={rest['aria-label']}
      onChange={(e) => onChange(e.target.checked)}
    />
    {label}
  </label>
);

/** Select compacto para tablas editables en línea (sin etiqueta visible: requiere aria-label). */
export const SelectCompacto: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { 'aria-label': string; tono?: 'advertencia' }> = ({
  tono,
  className = '',
  ...props
}) => <select className={`${CAMPO_COMPACTO} ${tono === 'advertencia' ? 'border-amber-300 bg-amber-50 text-amber-800' : ''} ${className}`} {...props} />;

/** Input compacto para tablas editables en línea (requiere aria-label si no hay etiqueta visible). */
export const InputCompacto = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => (
  <input ref={ref} className={`${CAMPO_COMPACTO} ${className}`} {...props} />
));
InputCompacto.displayName = 'InputCompacto';
