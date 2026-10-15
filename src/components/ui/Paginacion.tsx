import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Tamaños de página ofrecidos. 0 = todas las filas en una sola página. */
export const TAMANOS_PAGINA = [15, 30, 60, 0] as const;

/** Recorta `items` a la página pedida. Si la página no existe (p. ej. tras filtrar), cae a la última. */
export function paginar<T>(items: T[], pagina: number, porPagina: number) {
  if (porPagina === 0) return { visibles: items, paginaEfectiva: 1, totalPaginas: 1 };
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const paginaEfectiva = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaEfectiva - 1) * porPagina;
  return { visibles: items.slice(inicio, inicio + porPagina), paginaEfectiva, totalPaginas };
}

/** Números de página a mostrar, con elipsis cuando hay muchas. */
function rangoPaginas(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas: (number | '…')[] = [1];
  if (actual > 3) paginas.push('…');
  for (let p = Math.max(2, actual - 1); p <= Math.min(total - 1, actual + 1); p++) paginas.push(p);
  if (actual < total - 2) paginas.push('…');
  paginas.push(total);
  return paginas;
}

interface PaginacionProps {
  total: number;
  pagina: number;
  porPagina: number;
  onPaginaChange: (pagina: number) => void;
  onPorPaginaChange: (porPagina: number) => void;
  /** Nombre de lo que se pagina, para el texto ("líneas", "materiales"...). */
  etiqueta?: string;
}

/**
 * Paginación de listados. Muestra el rango visible, el tamaño de página y
 * los números de página. `porPagina = 0` significa "todas".
 */
export const Paginacion: React.FC<PaginacionProps> = ({
  total,
  pagina,
  porPagina,
  onPaginaChange,
  onPorPaginaChange,
  etiqueta = 'registros',
}) => {
  if (total === 0) return null;
  const totalPaginas = porPagina === 0 ? 1 : Math.ceil(total / porPagina);
  const paginaEfectiva = Math.min(Math.max(1, pagina), totalPaginas);
  const desde = porPagina === 0 ? 1 : (paginaEfectiva - 1) * porPagina + 1;
  const hasta = porPagina === 0 ? total : Math.min(paginaEfectiva * porPagina, total);

  const botonBase =
    'min-w-8 h-8 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 shadow-xs px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>
          Mostrando <strong className="text-slate-800">{desde}–{hasta}</strong> de{' '}
          <strong className="text-slate-800">{total}</strong> {etiqueta}
        </span>
        <label className="flex items-center gap-2">
          <span>Por página</span>
          <select
            value={porPagina}
            onChange={(e) => onPorPaginaChange(Number(e.target.value))}
            className="pl-2.5 pr-7 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-600 cursor-pointer appearance-none bg-no-repeat bg-[right_0.5rem_center]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='3'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
          >
            {TAMANOS_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Todas' : n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {porPagina !== 0 && totalPaginas > 1 && (
        <div className="flex items-center gap-1 self-end md:self-auto">
          <button
            type="button"
            onClick={() => onPaginaChange(paginaEfectiva - 1)}
            disabled={paginaEfectiva <= 1}
            aria-label="Página anterior"
            className={`${botonBase} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          {rangoPaginas(paginaEfectiva, totalPaginas).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPaginaChange(p)}
                aria-current={p === paginaEfectiva ? 'page' : undefined}
                className={`${botonBase} ${
                  p === paginaEfectiva
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPaginaChange(paginaEfectiva + 1)}
            disabled={paginaEfectiva >= totalPaginas}
            aria-label="Página siguiente"
            className={`${botonBase} border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </nav>
  );
};
