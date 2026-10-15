import React from 'react';
import { Coins } from 'lucide-react';

interface DivisasFormProps {
  dolar: string;
  setDolar: (val: string) => void;
  uf: string;
  setUf: (val: string) => void;
  euro: string;
  setEuro: (val: string) => void;
  /** Pie de la tarjeta (ej. mensaje y botón de guardar). */
  footer?: React.ReactNode;
}

const CAMPOS: { key: 'dolar' | 'uf' | 'euro'; label: string; placeholder: string }[] = [
  { key: 'dolar', label: 'Dólar observado (USD)', placeholder: '950' },
  { key: 'uf', label: 'Unidad de fomento (UF)', placeholder: '38500' },
  { key: 'euro', label: 'Euro oficial (EUR)', placeholder: '1030' },
];

export const DivisasForm: React.FC<DivisasFormProps> = ({ dolar, setDolar, uf, setUf, euro, setEuro, footer }) => {
  const valores = { dolar, uf, euro };
  const setters = { dolar: setDolar, uf: setUf, euro: setEuro };

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
          <Coins className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Parámetros económicos</div>
          <h2 className="text-base font-extrabold text-slate-900">Divisas de la obra</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tipos de cambio para convertir las compras en USD y EUR a pesos chilenos, y cotizar en UF. Son propios de este presupuesto.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CAMPOS.map((c) => (
          <label key={c.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2 block">
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">{c.label}</span>
              <span className="text-[10px] font-bold text-brand-600">CLP</span>
            </span>
            <input
              type="number"
              value={valores[c.key]}
              onChange={(e) => setters[c.key](e.target.value)}
              placeholder={c.placeholder}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-900 tabular-nums focus:outline-none focus:border-brand-600 transition-colors"
            />
          </label>
        ))}
      </div>

      {footer && <div className="pt-4 border-t border-slate-100">{footer}</div>}
    </section>
  );
};
