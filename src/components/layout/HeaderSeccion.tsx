import React from 'react';
import { Badge } from '../ui/Badge';
import { HeaderSlot } from './HeaderSlot';

// Cabecera estándar de una sección de primer nivel: título, contador y
// acciones van al Header del sitio (portal), igual que en Presupuestos y
// Obras. Las migas del Header se ocultan bajo md: ahí el título va aquí.
export const HeaderSeccion: React.FC<{ titulo: string; count?: number; acciones?: React.ReactNode }> = ({
  titulo,
  count,
  acciones,
}) => (
  <HeaderSlot>
    <span className="hidden sm:inline md:hidden text-sm font-bold text-slate-900 truncate min-w-0">{titulo}</span>
    {count !== undefined && (
      <Badge size="sm" variant="default" className="hidden min-[420px]:inline-flex font-mono font-bold text-slate-600" title={`${count}`}>
        {count}
      </Badge>
    )}
    {acciones && <div className="ml-auto flex items-center gap-2 shrink-0">{acciones}</div>}
  </HeaderSlot>
);
