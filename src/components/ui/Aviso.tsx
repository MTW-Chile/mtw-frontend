import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const TONOS = {
  info: { caja: 'bg-sky-50 border-sky-200 text-sky-800', Icono: Info },
  exito: { caja: 'bg-emerald-50 border-emerald-200 text-emerald-800', Icono: CheckCircle2 },
  advertencia: { caja: 'bg-amber-50 border-amber-200 text-amber-800', Icono: AlertTriangle },
  peligro: { caja: 'bg-rose-50 border-rose-200 text-rose-700', Icono: AlertCircle },
  neutro: { caja: 'bg-slate-50 border-slate-200 text-slate-600', Icono: Info },
} as const;

/**
 * Aviso dentro de una página o modal (DESIGN.md 5): un error al guardar,
 * algo "por revisar", una explicación. Reemplaza las cajas de color a mano.
 */
export const Aviso: React.FC<{ tono?: keyof typeof TONOS; titulo?: React.ReactNode; children?: React.ReactNode; accion?: React.ReactNode; sinIcono?: boolean }> = ({
  tono = 'info',
  titulo,
  children,
  accion,
  sinIcono,
}) => {
  const { caja, Icono } = TONOS[tono];
  return (
    // El botón (accion) baja bajo el texto cuando no caben lado a lado, en vez de apretarlo.
    <div role={tono === 'peligro' ? 'alert' : undefined} className={`p-3 rounded-xl border text-xs flex flex-wrap items-start gap-2 ${caja}`}>
      {!sinIcono && <Icono className="w-4 h-4 shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1 basis-56 space-y-0.5">
        {titulo && <p className="font-bold">{titulo}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
      {accion && <div className="shrink-0 ml-auto">{accion}</div>}
    </div>
  );
};
