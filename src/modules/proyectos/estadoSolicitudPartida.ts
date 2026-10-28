import type { BadgeVariant } from '../../components/ui/Badge';
import type { EstadoOC, OrdenCompra, SolicitudMaterial } from '../../types';

/**
 * En qué va una partida de una fase, de la compra a la entrega al taller.
 * Decide la fila de la partida en Fabricación › Fases de Producción:
 * - un badge junto al nombre con el estado del pedido (Enviado, Pendiente de
 *   aprobación, Pendiente de recepción, Recibida parcial/total, Rechazada,
 *   En bodega);
 * - un botón de ancho fijo que avanza: Solicitar materiales → Solicitado →
 *   Solicitar requisición → Esperando entrega → Entregado a taller.
 * Mira la OC más reciente de esa fase con ítems de la partida (una cancelada
 * no cuenta) y después la requisición a bodega más reciente que pida sus
 * materiales (una rechazada no cuenta).
 */
export type AccionPartida = 'solicitar-materiales' | 'solicitar-requisicion';

export interface EstadoPartida {
  badge: { etiqueta: string; variante: BadgeVariant } | null;
  boton: { etiqueta: string; accion: AccionPartida | null };
  /** OC o requisición de referencia, para el title. */
  referencia: string | null;
}

const BADGE_POR_ESTADO_OC: Partial<Record<EstadoOC, { etiqueta: string; variante: BadgeVariant }>> = {
  BORRADOR: { etiqueta: 'Enviado', variante: 'subtle' },
  PENDIENTE_APROBACION: { etiqueta: 'Pendiente de aprobación', variante: 'warning' },
  APROBADA: { etiqueta: 'Pendiente de recepción', variante: 'info' },
  ENVIADA: { etiqueta: 'Pendiente de recepción', variante: 'info' },
  RECIBIDA_PARCIAL: { etiqueta: 'Recibida (parcial)', variante: 'warning' },
  RECIBIDA_TOTAL: { etiqueta: 'Recibida (total)', variante: 'success' },
  PARCIALMENTE_CONCILIADA: { etiqueta: 'Recibida (total)', variante: 'success' },
  CONCILIADA: { etiqueta: 'Recibida (total)', variante: 'success' },
  RECHAZADA: { etiqueta: 'Rechazada', variante: 'danger' },
};
const RECIBIDA: EstadoOC[] = ['RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'PARCIALMENTE_CONCILIADA', 'CONCILIADA'];

export function estadoPartida(entrada: {
  ordenes: Pick<OrdenCompra, 'faseId' | 'estado' | 'numero' | 'creadoEn' | 'items'>[];
  requisiciones: Pick<SolicitudMaterial, 'id' | 'faseId' | 'estado' | 'fechaSolicitud' | 'items'>[];
  faseId: string;
  partidaCodigo: string;
  /** Materiales de la partida en esta fase (para cruzar con las requisiciones). */
  materialIds: string[];
  /** Todo lo que necesita la partida ya está en bodega: se puede pedir sin comprar. */
  cubiertaPorStock: boolean;
  /** Cubierta solo contando Obras Mayores: hay que pedir el traslado a la bodega de la obra antes de que se entregue. */
  requiereTraslado?: boolean;
}): EstadoPartida {
  const { ordenes, requisiciones, faseId, partidaCodigo, materialIds, cubiertaPorStock, requiereTraslado } = entrada;
  const materiales = new Set(materialIds);

  const oc = ordenes
    .filter((o) => o.faseId === faseId && o.estado !== 'CANCELADA' && o.items.some((i) => i.partida?.codigo === partidaCodigo))
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0];
  const badge = oc
    ? (BADGE_POR_ESTADO_OC[oc.estado] ?? null)
    : cubiertaPorStock
      ? requiereTraslado
        ? { etiqueta: 'En Obras Mayores · pedir traslado', variante: 'warning' as BadgeVariant }
        : { etiqueta: 'En bodega', variante: 'success' as BadgeVariant }
      : null;

  const requisicion = requisiciones
    .filter((r) => r.faseId === faseId && r.estado !== 'RECHAZADA' && r.items.some((i) => materiales.has(i.materialId)))
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud))[0];
  if (requisicion) {
    return { badge, referencia: oc?.numero ?? null, boton: { etiqueta: requisicion.estado === 'ENTREGADA' ? 'Entregado a taller' : 'Esperando entrega', accion: null } };
  }

  if (oc && oc.estado !== 'RECHAZADA') {
    const recibida = RECIBIDA.includes(oc.estado);
    return { badge, referencia: oc.numero, boton: recibida ? { etiqueta: 'Solicitar requisición', accion: 'solicitar-requisicion' } : { etiqueta: 'Solicitado', accion: null } };
  }

  return {
    badge,
    referencia: oc?.numero ?? null,
    boton: cubiertaPorStock ? { etiqueta: 'Solicitar requisición', accion: 'solicitar-requisicion' } : { etiqueta: 'Solicitar materiales', accion: 'solicitar-materiales' },
  };
}
