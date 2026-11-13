import React from 'react';
import { cantidad } from '../../../lib/formato';

const TONO = {
  fabricacion: 'bg-sky-500',
  instalacion: 'bg-emerald-500',
  despacho: 'bg-violet-500',
} as const;

/** Qué significa cada fila, para el título al pasar el cursor. */
const AYUDA_HOJAS = 'Hojas; en una ventana fija, su vidrio';

/**
 * Avance de una obra POR PARTE: marcos y hojas (o vidrios) por separado, cada uno con
 * su barra y su «x/total». Es la forma única de mostrar cuánto se ha despachado o
 * instalado: un marco puede ir semanas antes que su hoja, y un solo número de
 * «ventanas instaladas» esconde esa diferencia. Los números vienen ya contados de la
 * API (dominio/obras/avance-partes.ts).
 *
 * `compacto`: para celdas de tabla (barras cortas, sin la palabra completa).
 */
export const AvancePartes: React.FC<{ marcos: number; hojas: number; total: number; tono: keyof typeof TONO; compacto?: boolean; className?: string }> = ({ marcos, hojas, total, tono, compacto, className = '' }) => {
  if (total === 0) return <span className="text-slate-500">—</span>;
  const fila = (etiqueta: string, corta: string, valor: number, ayuda: string) => (
    <span className="flex items-center gap-2" title={`${ayuda}: ${cantidad(valor, 0)} de ${cantidad(total, 0)}`}>
      <span className={`shrink-0 text-slate-500 ${compacto ? 'w-3 font-bold' : 'w-12'}`} aria-hidden={compacto || undefined}>
        {compacto ? corta : etiqueta}
      </span>
      {compacto && <span className="sr-only">{etiqueta}</span>}
      <span className={`h-1.5 rounded-full bg-slate-100 overflow-hidden ${compacto ? 'w-10' : 'flex-1 max-w-[10rem]'}`}>
        <span className={`block h-full rounded-full ${TONO[tono]}`} style={{ width: `${Math.min(100, Math.round((valor / total) * 100))}%` }} />
      </span>
      <span className="font-mono font-semibold tabular-nums text-slate-600">
        {cantidad(valor, 0)}/{cantidad(total, 0)}
      </span>
    </span>
  );
  return (
    <span className={`flex flex-col gap-0.5 text-[11px] ${className}`}>
      {fila('Marcos', 'M', marcos, 'Marcos')}
      {fila('Hojas', 'H', hojas, AYUDA_HOJAS)}
    </span>
  );
};

/** El mismo dato en una línea de texto: «marcos 341 · hojas 186». */
export const textoAvancePartes = (marcos: number, hojas: number): string => `marcos ${cantidad(marcos, 0)} · hojas ${cantidad(hojas, 0)}`;
