import React from 'react';
import { Loader2 } from 'lucide-react';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';

// Piezas compartidas de Configuración > Catálogo.

export const CAMPO_CLASS =
  'w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-brand-600 bg-slate-50 focus:bg-white transition-colors disabled:bg-slate-100 disabled:text-slate-400';

export const avisarError = (err: unknown) => mostrarToast(extraerErrorParaToast(err).mensaje);

export const Cargando: React.FC = () => (
  <div className="p-12 flex items-center justify-center text-slate-400">
    <Loader2 className="w-5 h-5 animate-spin" />
  </div>
);

export const ErrorCarga: React.FC<{ que: string; onReintentar: () => void }> = ({ que, onReintentar }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
    <p className="text-sm font-bold text-rose-600">Error al consultar {que}.</p>
    <button onClick={onReintentar} className="text-xs font-bold text-brand-600 hover:underline cursor-pointer">
      Reintentar
    </button>
  </div>
);

/** Tarjeta de seccion: titulo, explicacion y accion principal a la derecha. */
export const Seccion: React.FC<{ titulo: string; descripcion: React.ReactNode; accion?: React.ReactNode; children: React.ReactNode }> = ({
  titulo,
  descripcion,
  accion,
  children,
}) => (
  <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100">
      <div className="min-w-0">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">{titulo}</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">{descripcion}</p>
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
    {children}
  </div>
);

/** Interruptor si/no compacto para celdas de tabla. */
export const Interruptor: React.FC<{ valor: boolean; onChange: (v: boolean) => void; disabled?: boolean; etiqueta: string }> = ({
  valor,
  onChange,
  disabled,
  etiqueta,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={valor}
    aria-label={etiqueta}
    title={etiqueta}
    disabled={disabled}
    onClick={() => onChange(!valor)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
      valor ? 'bg-brand-600' : 'bg-slate-300'
    }`}
  >
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${valor ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);
