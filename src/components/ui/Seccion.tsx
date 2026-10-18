import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { EncabezadoSeccion } from './EncabezadoSeccion';

/**
 * Sección de una página (DESIGN.md 4): tarjeta con encabezado estándar
 * (EncabezadoSeccion) y contenido. `sinRelleno` para contenido que llega al
 * borde (tablas, listas). No se anidan secciones.
 */
export const Seccion: React.FC<{
  titulo?: React.ReactNode;
  antetitulo?: React.ReactNode;
  descripcion?: React.ReactNode;
  icono?: LucideIcon;
  acciones?: React.ReactNode;
  sinRelleno?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = ({ titulo, antetitulo, descripcion, icono, acciones, sinRelleno, className = '', children }) => (
  <section className={`rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {(titulo || acciones) && (
      <EncabezadoSeccion
        titulo={titulo}
        antetitulo={antetitulo}
        descripcion={descripcion}
        icono={icono}
        acciones={acciones}
        className={`px-5 py-4 ${children !== undefined ? 'border-b border-slate-100' : ''}`}
      />
    )}
    {children !== undefined && <div className={sinRelleno ? '' : 'p-5'}>{children}</div>}
  </section>
);
