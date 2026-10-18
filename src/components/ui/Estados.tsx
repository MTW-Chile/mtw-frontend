import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';

/** Carga de una vista o sección (DESIGN.md 5). */
export const Cargando: React.FC<{ texto?: string }> = ({ texto }) => (
  <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-400" role="status">
    <Loader2 className="w-5 h-5 animate-spin" />
    {texto && <span className="text-xs">{texto}</span>}
  </div>
);

/** Sin datos: ícono, título, explicación y, si corresponde, la acción para empezar. */
export const EstadoVacio: React.FC<{ icono?: LucideIcon; titulo: React.ReactNode; descripcion?: React.ReactNode; accion?: React.ReactNode; enTarjeta?: boolean }> = ({
  icono: Icono = Inbox,
  titulo,
  descripcion,
  accion,
  enTarjeta = true,
}) => (
  <div className={`p-10 text-center space-y-2 ${enTarjeta ? 'rounded-2xl bg-white border border-slate-200 shadow-sm' : ''}`}>
    <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
      <Icono className="w-5 h-5" />
    </div>
    <h3 className="text-sm font-bold text-slate-800">{titulo}</h3>
    {descripcion && <p className="text-xs text-slate-500 max-w-sm mx-auto">{descripcion}</p>}
    {accion && <div className="pt-2 flex justify-center">{accion}</div>}
  </div>
);

/** No se pudo cargar: qué falló y botón para reintentar. */
export const ErrorCarga: React.FC<{ que: string; onReintentar?: () => void }> = ({ que, onReintentar }) => (
  <div className="p-8 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
    <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
    <p className="text-sm font-bold text-rose-600">No se pudo cargar {que}.</p>
    {onReintentar && (
      <Button variant="outline" size="sm" onClick={onReintentar}>
        Reintentar
      </Button>
    )}
  </div>
);
