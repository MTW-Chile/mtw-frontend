import React from 'react';
import { Coins, Lock, Pencil } from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';

type CampoDivisa = 'dolar' | 'uf' | 'euro';

const CAMPOS: { key: CampoDivisa; label: string; sigla: string; placeholder: string }[] = [
  { key: 'dolar', label: 'Dólar observado (USD)', sigla: 'USD', placeholder: '950' },
  { key: 'uf', label: 'Unidad de fomento (UF)', sigla: 'UF', placeholder: '38500' },
  { key: 'euro', label: 'Euro oficial (EUR)', sigla: 'EUR', placeholder: '1030' },
];

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

export const DivisasForm: React.FC<DivisasFormProps> = ({ dolar, setDolar, uf, setUf, euro, setEuro, footer }) => {
  const valores = { dolar, uf, euro };
  const setters = { dolar: setDolar, uf: setUf, euro: setEuro };

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
          <Coins className="w-4 h-4" />
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
          <Input
            key={c.key}
            label={c.label}
            sufijo="CLP"
            type="number"
            value={valores[c.key]}
            onChange={(e) => setters[c.key](e.target.value)}
            placeholder={c.placeholder}
            className="text-right font-bold tabular-nums"
          />
        ))}
      </div>

      {footer && <div className="pt-3 border-t border-slate-100">{footer}</div>}
    </section>
  );
};

interface DivisasResumenProps {
  dolar: string;
  uf: string;
  euro: string;
  congelado: boolean;
  onEditar: () => void;
}

// Versión colapsada de las divisas: una línea con los valores guardados.
// Congelado: sin botón Editar, igual que cualquier otra edición del presupuesto.
export const DivisasResumen: React.FC<DivisasResumenProps> = ({ dolar, uf, euro, congelado, onEditar }) => {
  const valores = { dolar, uf, euro };

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0 flex-wrap text-xs">
        <Coins className="w-4 h-4 text-brand-600 shrink-0" />
        <span className="font-bold text-slate-800">Divisas</span>
        {CAMPOS.map((c) => (
          <span key={c.key} className="text-slate-500">
            {c.sigla}{' '}
            <span className="font-semibold text-slate-900 tabular-nums">
              {valores[c.key] ? formatNumber(Number(valores[c.key]), 0) : '—'}
            </span>
          </span>
        ))}
      </div>

      {congelado ? (
        <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Congeladas
        </span>
      ) : (
        <Button variant="outline" size="sm" onClick={onEditar} leftIcon={<Pencil className="w-3.5 h-3.5" />}>
          Editar
        </Button>
      )}
    </section>
  );
};
