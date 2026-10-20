import React from 'react';
import { Badge } from '../ui/Badge';
import { HeaderSlot } from './HeaderSlot';

// Cabecera estándar de una sección de primer nivel: título, contador y
// acciones van al Header del sitio (portal), igual que en Presupuestos y
// Obras. El título lo muestran las migas del Header en todos los anchos.
export const HeaderSeccion: React.FC<{ titulo: string; count?: number; acciones?: React.ReactNode }> = ({
  titulo,
  count,
  acciones,
}) => (
  <HeaderSlot>
    {count !== undefined && (
      <Badge size="sm" variant="default" className="hidden min-[420px]:inline-flex font-mono font-bold text-slate-600" title={`${count} · ${titulo}`}>
        {count}
      </Badge>
    )}
    {acciones && <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">{acciones}</div>}
  </HeaderSlot>
);
