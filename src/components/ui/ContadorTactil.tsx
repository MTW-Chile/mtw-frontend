import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const BOTON =
  'w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0';

/**
 * Cantidad para contar en tablet o celular (recepción en bodega, acuse en
 * obra): botones − / + de 44 px y teclado numérico. Cada toque de − / +
 * guarda al instante; lo tipeado se aplica al salir del campo o con Enter.
 */
export const ContadorTactil: React.FC<{
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Solo enteros (unidades individualizadas, piezas). */
  enteros?: boolean;
  disabled?: boolean;
  'aria-label': string;
}> = ({ valor, onChange, min = 0, max, enteros = false, disabled, ...rest }) => {
  const [texto, setTexto] = useState(String(valor));
  // Si el valor cambia desde afuera ("Llegó todo"), el campo lo sigue.
  const [valorPrevio, setValorPrevio] = useState(valor);
  if (valor !== valorPrevio) {
    setValorPrevio(valor);
    setTexto(String(valor));
  }

  const acotar = (n: number) => {
    let v = enteros ? Math.round(n) : Math.round(n * 100) / 100;
    v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };
  const confirmar = () => {
    const n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n)) {
      setTexto(String(valor));
      return;
    }
    const v = acotar(n);
    if (v !== valor) onChange(v);
    else setTexto(String(valor));
  };

  return (
    <span className="inline-flex items-center gap-1">
      {/* eslint-disable-next-line react/forbid-elements -- botón táctil propio del contador */}
      <button type="button" className={BOTON} aria-label="Menos" disabled={disabled || valor <= min} onClick={() => onChange(acotar(valor - 1))}>
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="text"
        inputMode={enteros ? 'numeric' : 'decimal'}
        value={texto}
        disabled={disabled}
        aria-label={rest['aria-label']}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="w-20 h-11 text-center text-base font-mono font-bold tabular-nums rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600 disabled:opacity-50"
      />
      {/* eslint-disable-next-line react/forbid-elements -- botón táctil propio del contador */}
      <button type="button" className={BOTON} aria-label="Más" disabled={disabled || (max !== undefined && valor >= max)} onClick={() => onChange(acotar(valor + 1))}>
        <Plus className="w-4 h-4" />
      </button>
    </span>
  );
};
