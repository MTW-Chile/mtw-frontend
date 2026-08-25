import React from 'react';
import { Calculator } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';

interface Step4FijacionesProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

export const Step4Fijaciones: React.FC<Step4FijacionesProps> = (_props) => {
  return (
    <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
        <Calculator className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">Paso 4: Hoja de Fijación y Extras</h3>
      <p className="text-xs text-slate-600 max-w-md mx-auto">
        Cálculo de fijaciones, tornillería, sellantes, grúas, traslados y mano de obra de instalación.
      </p>
    </div>
  );
};
