import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Elegir una vista o un filtro entre pocas opciones, como botones unidos
 * (DESIGN.md 5): versión v1/v2, Todos/Pendientes, Lista/Tarjetas. Para
 * navegar entre secciones de una página usar SubTabs; para un formulario,
 * OpcionesTarjeta.
 *
 * Siempre es UNA fila. Si no cabe (un filtro con cinco estados en un celular),
 * no se envuelve en varias líneas: se desliza hacia el lado, con el borde
 * difuminado donde queda algo por ver y la opción elegida siempre a la vista.
 */
export function Segmentado<T extends string | number>({
  opciones,
  valor,
  onChange,
  etiqueta,
  tamano = 'sm',
}: {
  opciones: { value: T; label: React.ReactNode; icono?: LucideIcon; contador?: number; title?: string; disabled?: boolean }[];
  valor: T;
  onChange: (v: T) => void;
  /** Nombre accesible del grupo. */
  etiqueta: string;
  tamano?: 'xs' | 'sm';
}) {
  const caja = useRef<HTMLDivElement>(null);
  // Qué lado tiene opciones fuera de la vista (para difuminar ese borde).
  const [oculto, setOculto] = useState({ izquierda: false, derecha: false });

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      const izquierda = el.scrollLeft > 2;
      const derecha = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setOculto((a) => (a.izquierda === izquierda && a.derecha === derecha ? a : { izquierda, derecha }));
    };
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(el);
    return () => {
      el.removeEventListener('scroll', medir);
      observador?.disconnect();
    };
  }, [opciones.length]);

  // La opción elegida queda a la vista (al entrar con un filtro ya puesto, o al elegir una que estaba a medias).
  useEffect(() => {
    const el = caja.current;
    const elegida = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !elegida) return;
    const margen = 24;
    if (elegida.offsetLeft < el.scrollLeft + margen) el.scrollTo({ left: Math.max(0, elegida.offsetLeft - margen) });
    else if (elegida.offsetLeft + elegida.offsetWidth > el.scrollLeft + el.clientWidth - margen) el.scrollTo({ left: elegida.offsetLeft + elegida.offsetWidth - el.clientWidth + margen });
  }, [valor]);

  const borde = oculto.izquierda && oculto.derecha ? 'linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)' : oculto.derecha ? 'linear-gradient(to right, #000 calc(100% - 28px), transparent)' : oculto.izquierda ? 'linear-gradient(to right, transparent, #000 28px)' : undefined;

  return (
    <div
      ref={caja}
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex max-w-full min-w-0 items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 border border-slate-200 overflow-x-auto no-scrollbar overscroll-x-contain"
      style={borde ? { maskImage: borde, WebkitMaskImage: borde } : undefined}
    >
      {opciones.map(({ value, label, icono: Icono, contador, title, disabled }) => {
        const sel = value === valor;
        return (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={sel}
            title={title}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              tamano === 'xs' ? 'px-2 py-1 text-[11px] pointer-coarse:min-h-10' : 'px-3 py-1.5 text-xs pointer-coarse:min-h-11 pointer-coarse:px-3.5'
            } ${sel ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {Icono && <Icono className="w-3.5 h-3.5" />}
            {label}
            {contador !== undefined && (
              <span className={`text-[11px] font-bold tabular-nums rounded-full px-1.5 ${sel ? 'bg-brand-600/10 text-brand-700' : 'bg-slate-200 text-slate-500'}`}>{contador}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
