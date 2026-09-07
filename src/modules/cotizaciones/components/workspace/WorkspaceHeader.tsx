import React from 'react';
import { ArrowLeft, Building2, RotateCcw, ShieldCheck, Lock } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';

// BORRADOR es el valor historico de la columna antes del flujo de estado
// comercial; se muestra igual que EN_COTIZACION (ver EstadoComercialCard).
const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: 'En Cotización',
  EN_COTIZACION: 'En Cotización',
  ESPERANDO_APROBACION_COMERCIAL: 'Esperando Aprobación Comercial',
  APROBADO_GERENCIA: 'Aprobado Gerencia',
  ACEPTADO_CLIENTE: 'Aceptado por Cliente',
};

interface WorkspaceHeaderProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  onBack: () => void;
  onOpenReimport: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  proyecto,
  activeVersion,
  onBack,
  onOpenReimport,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs px-3.5 sm:px-6 py-2.5 sm:py-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 max-w-7xl mx-auto">
        {/* Lado Principal / Identificación */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
            title="Volver al listado de Obras"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
            <span className="hidden xs:inline">Volver</span>
            <span className="hidden sm:inline">a Obras</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center font-bold text-xs shrink-0">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-base font-bold tracking-tight text-slate-900 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">
                  {proyecto.obra}
                </h1>

                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-mono bg-slate-100 border border-slate-300 text-slate-700 shrink-0">
                  {proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`}
                </span>

                {activeVersion?.esCongelado ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-semibold flex items-center gap-1 shrink-0">
                    {activeVersion.estadoAprobacion === 'APROBADO_GERENCIA' ||
                    activeVersion.estadoAprobacion === 'ACEPTADO_CLIENTE' ? (
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Lock className="w-3 h-3 text-emerald-600" />
                    )}
                    <span>{ESTADO_LABEL[activeVersion.estadoAprobacion] || activeVersion.estadoAprobacion}</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#E34A26]/10 border border-[#E34A26]/30 text-[#E34A26] shrink-0">
                    {activeVersion ? ESTADO_LABEL[activeVersion.estadoAprobacion] || activeVersion.estadoAprobacion : 'En Cotización'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lado Acciones / Versión */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 self-end sm:self-auto">
          {activeVersion && (
            <span
              className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-[11px] sm:text-xs font-semibold text-slate-600"
              title="La versión a presupuestar se elige en el Paso 1"
            >
              Rev {activeVersion.versionNumero}
            </span>
          )}

          <button
            onClick={onOpenReimport}
            disabled={activeVersion?.esCongelado}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-400 text-xs font-medium transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-40 cursor-pointer"
            title="Restablecer presupuesto leyendo los datos originales de HETMO"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Reimportar HETMO</span>
          </button>
        </div>
      </div>
    </header>
  );
};
