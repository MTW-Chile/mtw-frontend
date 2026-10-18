import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Encabezado estándar de una sección o pestaña (DESIGN.md 4), el mismo de las
 * tarjetas del cotizador: ícono en caja, antetítulo en mayúsculas pequeñas,
 * título en negrita, descripción y acciones a la derecha.
 */
export const EncabezadoSeccion: React.FC<{
  titulo: React.ReactNode;
  antetitulo?: React.ReactNode;
  descripcion?: React.ReactNode;
  icono?: LucideIcon;
  acciones?: React.ReactNode;
  className?: string;
}> = ({ titulo, antetitulo, descripcion, icono: Icono, acciones, className = '' }) => (
  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
    <div className="flex items-center gap-3 min-w-0">
      {Icono && (
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-600/10 text-brand-600 border border-brand-600/20 flex items-center justify-center shrink-0">
          <Icono className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      )}
      <div className="min-w-0">
        {antetitulo && <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{antetitulo}</div>}
        <h2 className="text-sm font-bold text-slate-900">{titulo}</h2>
        {descripcion && <div className="text-[11px] text-slate-500 mt-0.5">{descripcion}</div>}
      </div>
    </div>
    {acciones && <div className="flex flex-wrap items-center gap-2 shrink-0">{acciones}</div>}
  </div>
);
