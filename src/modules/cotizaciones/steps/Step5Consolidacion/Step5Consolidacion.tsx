import React from 'react';
import { FileText } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';
import { EstadoComercialCard } from './EstadoComercialCard';

type EstadoAprobacion = 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA' | 'ACEPTADO_CLIENTE';

interface Step5ConsolidacionProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  onCambiarEstadoAprobacion: (estado: EstadoAprobacion) => void;
  isCambiandoEstadoAprobacion: boolean;
  onCrearVersionInterna: (hetmoId: number) => void;
  isCreandoVersionInterna: boolean;
}

export const Step5Consolidacion: React.FC<Step5ConsolidacionProps> = ({
  activeVersion,
  onCambiarEstadoAprobacion,
  isCambiandoEstadoAprobacion,
  onCrearVersionInterna,
  isCreandoVersionInterna,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <EstadoComercialCard
        activeVersion={activeVersion}
        onCambiarEstado={onCambiarEstadoAprobacion}
        isCambiandoEstado={isCambiandoEstadoAprobacion}
        onCrearVersionInterna={onCrearVersionInterna}
        isCreandoVersion={isCreandoVersionInterna}
      />

      <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Paso 5: Consolidación & PDF</h3>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Resumen comercial y generación del Presupuesto final en PDF.
        </p>
      </div>
    </div>
  );
};
