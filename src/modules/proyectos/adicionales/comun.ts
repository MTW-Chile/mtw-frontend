import type { BadgeVariant } from '../../../components/ui/Badge';
import { useIndicadoresChile } from '../../../lib/useIndicadoresChile';
import { useParametrosGenerales } from '../../../lib/parametrosGenerales';
import type { Adicional, EstadoAdicional } from '../../../types';

/** "PRJ-2026-508 · A2": como se nombra un adicional. */
export const codigoAdicional = (a: Pick<Adicional, 'numero'> & { proyecto?: { codigoInterno: string | null; obra: string } }) =>
  `${a.proyecto?.codigoInterno ?? a.proyecto?.obra ?? 'Obra'} · A${a.numero}`;

export const VARIANTE_ESTADO: Record<EstadoAdicional, BadgeVariant> = {
  BORRADOR: 'default',
  ESPERANDO_APROBACION: 'warning',
  APROBADO: 'info',
  ENVIADO: 'brand',
  ACEPTADO: 'success',
  RECHAZADO: 'danger',
  ANULADO: 'subtle',
};

export const clp = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
export const uf = (v: number) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`;

/**
 * Divisas vigentes para cotizar un adicional: las del día (GET /api/indicadores)
 * y, si no se pudieron obtener o vienen desactualizadas, las de respaldo de
 * Configuración › Comercial.
 */
export function useTasasVigentes(): { tasas: { dolar: number; euro: number; uf: number } | null; delDia: boolean } {
  const { indicadores } = useIndicadoresChile();
  const parametros = useParametrosGenerales();
  if (indicadores && !indicadores.desactualizado && indicadores.dolar && indicadores.euro && indicadores.uf) {
    return { tasas: { dolar: indicadores.dolar, euro: indicadores.euro, uf: indicadores.uf }, delDia: true };
  }
  return { tasas: parametros?.tasasRespaldo ?? null, delDia: false };
}
