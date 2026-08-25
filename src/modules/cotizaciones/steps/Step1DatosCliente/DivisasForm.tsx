import React from 'react';
import { Coins } from 'lucide-react';

interface DivisasFormProps {
  dolar: string;
  setDolar: (val: string) => void;
  uf: string;
  setUf: (val: string) => void;
  euro: string;
  setEuro: (val: string) => void;
}

export const DivisasForm: React.FC<DivisasFormProps> = ({
  dolar,
  setDolar,
  uf,
  setUf,
  euro,
  setEuro,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
          <Coins className="w-4 h-4 text-[#E34A26]" />
          <span>2. Parámetros Económicos y Divisas de la Obra</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Valores específicos para este presupuesto
        </span>
      </div>

      <p className="text-xs text-slate-600">
        Define los tipos de cambio para convertir las compras internacionales (USD/EUR) al costo real en pesos chilenos y cotizar en UF.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Dólar Observado (USD)</span>
            <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
          </label>
          <input
            type="number"
            value={dolar}
            onChange={(e) => setDolar(e.target.value)}
            placeholder="950.00"
            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-[#E34A26] transition-colors"
          />
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Unidad de Fomento (UF)</span>
            <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
          </label>
          <input
            type="number"
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            placeholder="38500.00"
            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-[#E34A26] transition-colors"
          />
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Euro Oficial (EUR)</span>
            <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
          </label>
          <input
            type="number"
            value={euro}
            onChange={(e) => setEuro(e.target.value)}
            placeholder="1030.00"
            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-[#E34A26] transition-colors"
          />
        </div>
      </div>
    </div>
  );
};
