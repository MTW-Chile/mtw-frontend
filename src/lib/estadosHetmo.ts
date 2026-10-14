import type { BadgeVariant } from '../components/ui/Badge';
import type { Proyecto } from '../types';

// Estados REALES de un presupuesto en HETMO: catalogo HT_TEXTOS_ESTADO_DOCUMENTOS,
// plantilla 1 (Presupuesto), verificado contra la base el 2026-10-05. Antes la
// app mostraba la glosa que guardaba el sync, que venia de un mapa fijo del
// agente de HETMO con significados equivocados (p.ej. 30 = "Pasado a pedido"
// cuando es "aceptado comercial", 20 = "Aceptado por el cliente" cuando es
// "denegado"). Se decide SIEMPRE por el codigo numerico, no por la glosa.
//
// Ojo: estos estados son los de HETMO. El estado comercial interno del ERP
// (EstadoAprobacion: en cotizacion, aceptado por el cliente...) es otra cosa.
export const ESTADOS_PRESUPUESTO_HETMO: Record<number, { label: string; variant: BadgeVariant }> = {
  0: { label: 'Pendiente de medir', variant: 'default' },
  1: { label: 'Generación de presupuesto', variant: 'default' },
  2: { label: 'Presupuesto cerrado', variant: 'info' },
  4: { label: 'Presupuesto autorizado', variant: 'info' },
  6: { label: 'Presupuesto enviado', variant: 'info' },
  8: { label: 'Presupuesto anulado', variant: 'danger' },
  20: { label: 'Presupuesto denegado', variant: 'danger' },
  30: { label: 'Aceptado comercial', variant: 'success' },
  60: { label: 'Aceptado producción', variant: 'success' },
  100: { label: 'Aceptado comercial y producción', variant: 'success' },
  105: { label: 'Fabricando', variant: 'warning' },
  110: { label: 'Facturando', variant: 'success' },
};

// Un codigo que HETMO agregue y no conozcamos se muestra tal cual, sin romper.
export function glosaEstadoPresupuesto(estado: number | null | undefined): string {
  if (estado === null || estado === undefined) return 'Sin estado';
  return ESTADOS_PRESUPUESTO_HETMO[estado]?.label ?? `Estado ${estado}`;
}

export function varianteEstadoPresupuesto(estado: number | null | undefined): BadgeVariant {
  if (estado === null || estado === undefined) return 'default';
  return ESTADOS_PRESUPUESTO_HETMO[estado]?.variant ?? 'default';
}

type ProyectoMinimo = Pick<Proyecto, 'origen'> & { versiones: { estadoHetmo: number }[] };

// Un presupuesto manual no tiene estado real en HETMO (el 2 que guarda es
// sintetico): se rotula como lo que es.
export function etiquetaEstadoProyecto(p: ProyectoMinimo): string {
  if (p.origen === 'MANUAL_PRESUPUESTO') return 'Presupuesto manual';
  return glosaEstadoPresupuesto(p.versiones[0]?.estadoHetmo);
}

export function varianteEstadoProyecto(p: ProyectoMinimo): BadgeVariant {
  if (p.origen === 'MANUAL_PRESUPUESTO') return 'brand';
  return varianteEstadoPresupuesto(p.versiones[0]?.estadoHetmo);
}

// Lista por defecto de Presupuestos: los presupuestos cerrados en HETMO
// (estado 2) y los presupuestos manuales. "Todos los estados" muestra el resto.
// La insignia numerica del menu cuenta exactamente esto.
export function esPresupuestoPrincipal(p: ProyectoMinimo): boolean {
  if (p.origen === 'MANUAL_OBRA') return false;
  if (p.origen === 'MANUAL_PRESUPUESTO') return true;
  return p.versiones[0]?.estadoHetmo === 2;
}
