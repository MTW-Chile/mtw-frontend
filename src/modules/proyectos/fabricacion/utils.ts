import type { BadgeVariant } from '../../../components/ui/Badge';
import type { FabricacionCuadro } from '../../../types';

// Estados del documento de fabricacion en HETMO (catalogo "lote", plantilla
// 50001): 0 generando, 1 cerrado, 2 optimizado, 3 autorizado, 4 en
// fabricacion, 5 fabricado, 6 albaranado, 99 denegado. Se muestra la glosa
// que devuelve la API cuando existe; el color solo agrupa por etapa y un
// codigo desconocido cae a "default" sin romper nada.
export function varianteEstadoFabricacion(estado: number): BadgeVariant {
  if (estado === 4) return 'warning';
  if (estado === 5 || estado === 6) return 'success';
  if (estado === 99) return 'danger';
  if (estado >= 1 && estado <= 3) return 'info';
  return 'default';
}

export function textoEstadoFabricacion(estado: number, glosa?: string | null): string {
  return glosa?.trim() || `Estado ${estado}`;
}

// Medidas en mm: Decimal llega como string ("1144.5") desde la API. Hasta un
// decimal, sin ceros de relleno (2309 -> "2.309", 1144.5 -> "1.144,5").
export function formatoMm(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-CL', { maximumFractionDigits: 1 });
}

// "1 marco · 2 hojas" -- ignora los cuadros retirados (ya no vienen de HETMO).
export function resumenCuadros(cuadros: FabricacionCuadro[] | undefined): string {
  const vigentes = (cuadros ?? []).filter((c) => !c.retirada);
  if (vigentes.length === 0) return 'Sin cuadros';
  const marcos = vigentes.filter((c) => c.tipo === 'MARCO').length;
  const hojas = vigentes.length - marcos;
  const partes: string[] = [];
  if (marcos) partes.push(`${marcos} ${marcos === 1 ? 'marco' : 'marcos'}`);
  if (hojas) partes.push(`${hojas} ${hojas === 1 ? 'hoja' : 'hojas'}`);
  return partes.join(' · ');
}

export function formatoFechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}
