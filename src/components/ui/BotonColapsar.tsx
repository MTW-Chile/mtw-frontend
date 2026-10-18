import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Encabezado que abre y cierra un grupo (partidas, fases): chevron + contenido. */
export const BotonColapsar: React.FC<{ abierto: boolean; onClick: () => void; children: React.ReactNode; className?: string }> = ({
  abierto,
  onClick,
  children,
  className = '',
}) => (
  <button type="button" onClick={onClick} aria-expanded={abierto} className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0 text-left cursor-pointer ${className}`}>
    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abierto ? '' : '-rotate-90'}`} />
    {children}
  </button>
);
