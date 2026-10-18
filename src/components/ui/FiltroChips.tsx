import { ChevronDown } from 'lucide-react';

/**
 * Filtro de un listado por categoría o estado (DESIGN.md 5): chips en
 * escritorio y un selector en móvil (las chips no caben a 360 px).
 */
export function FiltroChips<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: { id: T; label: string; total?: number }[];
  valor: T;
  onChange: (v: T) => void;
  /** Nombre accesible (ej. "Filtrar por estado"). */
  etiqueta: string;
}) {
  return (
    <>
      <div className="relative md:hidden w-full">
        <select
          aria-label={etiqueta}
          value={valor}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-600 appearance-none cursor-pointer"
        >
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
              {o.total !== undefined ? ` (${o.total})` : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <div role="radiogroup" aria-label={etiqueta} className="hidden md:flex flex-wrap items-center gap-1.5">
        {opciones.map((o) => {
          const activo = o.id === valor;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(o.id)}
              className={`px-3 py-1 rounded-full text-xs shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                activo ? 'bg-slate-900 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
              }`}
            >
              {o.label}
              {o.total !== undefined && <span className={`ml-1 tabular-nums ${activo ? 'opacity-80' : 'text-slate-400'}`}>{o.total}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
