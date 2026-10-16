import React from 'react';
import { Loader2 } from 'lucide-react';

export type LoaderSize = 'sm' | 'md' | 'lg';

const ICON_SIZE: Record<LoaderSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-8 h-8',
};

interface LoaderProps {
  // Texto opcional debajo del icono (ej. "Cargando presupuesto...").
  label?: string;
  size?: LoaderSize;
  // block: ocupa el área con padding y centrado, para usarlo como estado de
  // carga de una vista o de un panel. Sin block, es solo el icono (en línea,
  // p.ej. dentro de un botón o de una fila).
  block?: boolean;
  className?: string;
}

// Loader estándar del frontend: el mismo Loader2 animado que usan Button y
// los listados. Hereda la tipografía del body (Inter) -- no fijar fuente acá.
export const Loader: React.FC<LoaderProps> = ({ label, size = 'md', block = false, className = '' }) => {
  const icono = <Loader2 className={`${ICON_SIZE[size]} animate-spin text-slate-400 shrink-0`} />;

  if (!block) {
    return <span className={`inline-flex items-center ${className}`}>{icono}</span>;
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-12 text-slate-500 ${className}`} role="status">
      {icono}
      {label && <span className="text-xs font-medium">{label}</span>}
    </div>
  );
};
