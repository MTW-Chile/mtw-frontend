import type { LucideIcon } from 'lucide-react';

/**
 * Elegir una vista o un filtro entre pocas opciones, como botones unidos
 * (DESIGN.md 5): versión v1/v2, Todos/Pendientes, Lista/Tarjetas. Para
 * navegar entre secciones de una página usar SubTabs; para un formulario,
 * OpcionesTarjeta.
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
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex flex-wrap items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 border border-slate-200">
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
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              tamano === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${sel ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {Icono && <Icono className="w-3.5 h-3.5" />}
            {label}
            {contador !== undefined && (
              <span className={`text-[10px] font-bold tabular-nums rounded-full px-1.5 ${sel ? 'bg-brand-600/10 text-brand-700' : 'bg-slate-200 text-slate-500'}`}>{contador}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
