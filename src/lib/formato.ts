/**
 * Formato único de montos, cantidades y fechas (DESIGN.md 3). Ninguna
 * pantalla formatea con toLocaleString suelto: así un monto se ve igual en
 * todas partes.
 */

const numero = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** $ 1.234.567 (pesos, sin decimales). */
export const clp = (v: number | string | null | undefined): string =>
  numero(v).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/** 12,35 UF (hasta 2 decimales). */
export const uf = (v: number | string | null | undefined): string =>
  `${numero(v).toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`;

/** 1.234,5 (hasta `decimales` decimales, sin forzar ceros). */
export const cantidad = (v: number | string | null | undefined, decimales = 2): string =>
  numero(v).toLocaleString('es-CL', { maximumFractionDigits: decimales });

/** 12,5% */
export const porcentaje = (v: number | string | null | undefined, decimales = 1): string =>
  `${numero(v).toLocaleString('es-CL', { maximumFractionDigits: decimales })}%`;

/** 18-10-2026 */
export const fecha = (v: string | Date | null | undefined): string => (v ? new Date(v).toLocaleDateString('es-CL') : '—');

/** 18-10-2026 14:32 */
export const fechaHora = (v: string | Date | null | undefined): string =>
  v ? new Date(v).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
