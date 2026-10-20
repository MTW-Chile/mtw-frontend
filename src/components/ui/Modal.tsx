import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ANCHO = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', completo: 'sm:max-w-7xl sm:h-[94vh]' } as const;

export interface ModalProps {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  icono?: LucideIcon;
  /** sm 448 px, md 512 px, lg 672 px, xl 896 px; completo 1280 px y alto fijo (editores con columnas). */
  ancho?: keyof typeof ANCHO;
  onClose: () => void;
  /** Bloquea cerrar (ej. mientras se guarda). */
  cerrable?: boolean;
  /** Pie fijo (acciones): usar <Modal.Pie>. */
  pie?: React.ReactNode;
  /** Convierte cuerpo y pie en un <form> (Enter envía; el botón principal es type="submit"). */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Reemplaza las clases del cuerpo (ej. un editor con columnas y scroll propio). */
  cuerpoClassName?: string;
  children: React.ReactNode;
}

/**
 * Modal único (DESIGN.md 5): encabezado con ícono, título y X; cuerpo con
 * scroll; pie fijo con las acciones. En móvil sube como hoja inferior. Se
 * cierra con Escape o la X, no al hacer clic fuera (se perderían datos).
 * Se monta solo cuando está abierto: `{abierto && <Modal …/>}`.
 */
export const Modal: React.FC<ModalProps> & { Pie: typeof Pie } = ({ titulo, subtitulo, icono: Icono, ancho = 'md', onClose, cerrable = true, pie, onSubmit, cuerpoClassName, children }) => {
  const idTitulo = useId();
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cerrable) onClose();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [onClose, cerrable]);

  // Portal a <body>: un modal abierto desde una celda de tabla o una tarjeta animada
  // no hereda su whitespace-nowrap ni queda atrapado por su transform.
  return createPortal(
    <div className="fixed inset-0 z-50 whitespace-normal flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`w-full ${ANCHO[ancho]} bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none`}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icono && (
              <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
                <Icono className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h2 id={idTitulo} className="text-sm font-black tracking-tight text-slate-900 truncate">
                {titulo}
              </h2>
              {subtitulo && <p className="text-[11px] text-slate-500 line-clamp-2">{subtitulo}</p>}
            </div>
          </div>
          {/* eslint-disable-next-line react/forbid-elements -- el propio Modal */}
          <button
            type="button"
            onClick={onClose}
            disabled={!cerrable}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {onSubmit ? (
          <form
            className="flex flex-col flex-1 min-h-0"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(e);
            }}
          >
            <div className={cuerpoClassName ?? 'p-5 space-y-4 overflow-y-auto flex-1'}>{children}</div>
            {pie}
          </form>
        ) : (
          <>
            <div className={cuerpoClassName ?? 'p-5 space-y-4 overflow-y-auto flex-1'}>{children}</div>
            {pie}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

/** Pie del modal: acciones a la derecha (Cancelar a la izquierda de la principal). `inicio`: algo a la izquierda (ej. un total). */
const Pie: React.FC<{ children: React.ReactNode; inicio?: React.ReactNode }> = ({ children, inicio }) => (
  <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2.5 shrink-0">
    <div className="text-[11px] text-slate-500 min-w-0">{inicio}</div>
    <div className="flex items-center gap-2.5 shrink-0">{children}</div>
  </div>
);
Modal.Pie = Pie;
