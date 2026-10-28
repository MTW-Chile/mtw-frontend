import type { BadgeVariant } from '../../../components/ui/Badge';
import type { FabricacionCuadro, ReporteVinculacionCubicacion, ResultadoVinculoFabricacion } from '../../../types';

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

// Resumen corto del intento de conectar las ventanas de este lote con el
// cubicador (ver vincularFabricacionConCubicacion en mtw-api) -- se agrega
// al aviso de "Actualizado:" de siempre, no es un aviso aparte.
export function textoVinculacionCubicacion(r: ReporteVinculacionCubicacion): string {
  const partes: string[] = [];
  if (r.vinculadas > 0) partes.push(`${r.vinculadas} ventana(s) conectada(s) con la cubicación`);
  if (r.sinMatch.length > 0) partes.push(`${r.sinMatch.length} sin match de nomenclatura (vincular a mano abajo)`);
  if (r.faseInferida) partes.push(`fase detectada: ${r.faseInferida.nombre}`);
  else if (r.faseConflicto) partes.push('ventanas de más de una fase nuestra: revisar a mano');
  return partes.length ? partes.join(', ') + '.' : '';
}

export function formatoFechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

// Resumen de una tanda de vinculos para el aviso: documentos, ventanas leidas
// y cuantas calzaron con la cubicacion.
export function textoVinculosMultiples(resultados: ResultadoVinculoFabricacion[], fallidos: string[]): string {
  const partes: string[] = [];
  if (resultados.length) {
    const ventanas = resultados.reduce((s, r) => s + r.ventanas.nuevas, 0);
    const conCubicacion = resultados.reduce((s, r) => s + (r.vinculacionCubicacion?.vinculadas ?? 0), 0);
    partes.push(`${resultados.length} documento(s) vinculado(s): ${ventanas} ventana(s) leída(s)${conCubicacion ? `, ${conCubicacion} conectada(s) con la cubicación` : ''}.`);
    const advertencias = resultados.flatMap((r) => r.advertencias);
    if (advertencias.length) partes.push(advertencias.join(' '));
  }
  if (fallidos.length) partes.push(`${fallidos.length} no se pudo vincular: ${fallidos.join('; ')}`);
  return partes.join(' ');
}
