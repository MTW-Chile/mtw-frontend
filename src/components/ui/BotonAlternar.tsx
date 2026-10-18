import React from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Herramienta que se activa y desactiva (Espejar, Invertir mano): marcada
 * en color de marca cuando está activa. `title` explica qué hace.
 */
export const BotonAlternar: React.FC<{
  activo: boolean;
  onClick: () => void;
  icono?: LucideIcon;
  cargando?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}> = ({ activo, onClick, icono: Icono, cargando, disabled, title, children }) => (
  <button
    type="button"
    aria-pressed={activo}
    onClick={onClick}
    disabled={disabled || cargando}
    title={title}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
      activo ? 'bg-brand-600/10 text-brand-600 border-brand-600/30 font-bold' : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:bg-slate-100/80 shadow-2xs font-semibold'
    }`}
  >
    {cargando ? <Loader2 className="w-3 h-3 animate-spin" /> : Icono && <Icono className="w-3 h-3" />}
    {children}
  </button>
);
