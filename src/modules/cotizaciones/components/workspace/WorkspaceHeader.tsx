import React from 'react';
import { ArrowLeft, Building2, RotateCcw, ShieldCheck } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';

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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Obras</span>
        </button>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center font-bold text-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">{proyecto.obra}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-100 border border-slate-300 text-slate-700">
                {proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`}
              </span>
              {activeVersion?.esCongelado ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Aprobado Gerencia
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-[#E34A26]/10 border border-[#E34A26]/30 text-[#E34A26]">
                  {activeVersion?.estadoAprobacion || 'En Cotización'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {activeVersion && (
          // Solo informativo: la version se elige en el Paso 1 (o sobre un
          // presupuesto ya consolidado), nunca desde el header a mitad de
          // cotizacion -- cambiarla ahi arriesgaba pisar trabajo en curso.
          <span
            className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600"
            title="La version a presupuestar se elige en el Paso 1"
          >
            Rev {activeVersion.versionNumero}
          </span>
        )}

        <button
          onClick={onOpenReimport}
          disabled={activeVersion?.esCongelado}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-400 text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
          title="Restablecer presupuesto leyendo los datos originales de HETMO"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden md:inline">Reimportar HETMO</span>
        </button>
      </div>
    </header>
  );
};
