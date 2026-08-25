import React from 'react';
import { Layers, Ruler, Boxes, DollarSign } from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { ProyectoVersion } from '../../../../types';

interface ResumenTecnicoCardsProps {
  activeVersion?: ProyectoVersion;
}

export const ResumenTecnicoCards: React.FC<ResumenTecnicoCardsProps> = ({ activeVersion }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Ventanas</div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {activeVersion?.totalVentanas || 0}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
          <Ruler className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Superficie Total</div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-xs font-normal text-slate-500">m²</span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
          <Boxes className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Materiales Base</div>
          <div className="text-lg font-bold font-mono text-slate-900">
            {activeVersion?.totalMateriales || 0}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Importe Base HETMO</div>
          <div className="text-lg font-bold font-mono text-emerald-600">
            {activeVersion?.monedaSimbolo || '$'} {formatNumber(activeVersion?.importeTotal, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};
