import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Sección de una página (DESIGN.md 4): tarjeta con encabezado (título,
 * descripción, acciones a la derecha) y contenido. `sinRelleno` para contenido
 * que llega al borde (tablas). No se anidan secciones.
 */
export const Seccion: React.FC<{
  titulo?: React.ReactNode;
  descripcion?: React.ReactNode;
  icono?: LucideIcon;
  acciones?: React.ReactNode;
  sinRelleno?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ titulo, descripcion, icono: Icono, acciones, sinRelleno, className = '', children }) => (
  <section className={`rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {(titulo || acciones) && (
      <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${children ? 'border-b border-slate-100' : ''}`}>
        <div className="flex items-start gap-3 min-w-0">
          {Icono && (
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <Icono className="w-4.5 h-4.5" />
            </div>
          )}
          <div className="min-w-0">
            {titulo && <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">{titulo}</h2>}
            {descripcion && <div className="text-[11px] text-slate-500 mt-0.5">{descripcion}</div>}
          </div>
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2 shrink-0">{acciones}</div>}
      </div>
    )}
    {children !== undefined && <div className={sinRelleno ? '' : 'p-5'}>{children}</div>}
  </section>
);
