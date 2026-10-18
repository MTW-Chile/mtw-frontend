import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface OpcionMenu<T> {
  value: T;
  label: React.ReactNode;
  /** Algo a la izquierda (ícono, número de paso). */
  prefijo?: React.ReactNode;
  descripcion?: React.ReactNode;
  peligro?: boolean;
  disabled?: boolean;
}

/**
 * Menú que se despliega desde un botón (DESIGN.md 5): saltar a un paso,
 * acciones de un registro. Se cierra al elegir, con Escape o al hacer clic
 * fuera. `valor` marca la opción actual (selector); sin él es un menú de
 * acciones.
 */
export function MenuDesplegable<T extends string | number>({
  contenido,
  etiqueta,
  opciones,
  valor,
  onElegir,
  hacia = 'abajo',
  alinear = 'izquierda',
  ancho = 'w-64',
}: {
  /** Contenido del botón que abre el menú. */
  contenido: React.ReactNode;
  /** Nombre accesible y title del botón. */
  etiqueta: string;
  opciones: OpcionMenu<T>[];
  valor?: T;
  onElegir: (v: T) => void;
  hacia?: 'arriba' | 'abajo';
  alinear?: 'izquierda' | 'derecha';
  ancho?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', alPresionar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alPresionar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const selector = valor !== undefined;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup={selector ? 'listbox' : 'menu'}
        aria-label={etiqueta}
        title={etiqueta}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
          abierto ? 'bg-brand-600/10 border-brand-600/40 text-brand-600 ring-2 ring-brand-600/20' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
        }`}
      >
        {contenido}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${abierto === (hacia === 'abajo') ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div
          role={selector ? 'listbox' : 'menu'}
          className={`absolute ${alinear === 'derecha' ? 'right-0' : 'left-0'} ${hacia === 'arriba' ? 'bottom-full mb-2' : 'top-full mt-2'} ${ancho} rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50 animate-fade-in`}
        >
          {opciones.map((o) => {
            const activo = selector && o.value === valor;
            return (
              <button
                key={String(o.value)}
                type="button"
                role={selector ? 'option' : 'menuitem'}
                aria-selected={selector ? activo : undefined}
                disabled={o.disabled}
                onClick={() => {
                  setAbierto(false);
                  onElegir(o.value);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  activo ? 'bg-brand-600/10 text-brand-600 font-bold' : o.peligro ? 'text-rose-600 hover:bg-rose-50 font-semibold' : 'text-slate-700 hover:bg-slate-100 font-semibold'
                }`}
              >
                {o.prefijo}
                <span className="flex-1 min-w-0">
                  <span className="block">{o.label}</span>
                  {o.descripcion && <span className="block text-[11px] font-normal text-slate-500">{o.descripcion}</span>}
                </span>
                {activo && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
