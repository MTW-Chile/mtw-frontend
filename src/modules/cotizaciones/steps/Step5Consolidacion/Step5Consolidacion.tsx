import React from 'react';
import { FileText } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';

interface Step5ConsolidacionProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

export const Step5Consolidacion: React.FC<Step5ConsolidacionProps> = (_props) => {
  return (
    <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
        <FileText className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">Paso 5: Consolidación, Aprobación & PDF</h3>
      <p className="text-xs text-slate-600 max-w-md mx-auto">
        Resumen comercial, control de Aprobación de Gerencia y generación del Presupuesto final en PDF.
      </p>
    </div>
  );
};
