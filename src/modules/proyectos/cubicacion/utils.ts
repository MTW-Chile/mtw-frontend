import type { ReporteImportacionCubicacion, ReporteSincronizacionCubicacion } from '../../../types';

// Utilidades puras del cubicador (sin red ni DOM). La nomenclatura y las medidas se
// calculan en el servidor (mtw-api/src/cubicador-reglas.ts); aca solo se replica la
// nomenclatura para mostrar un ejemplo en vivo al editar el formato.

export const FORMATO_NOMENCLATURA_DEFECTO = '{codigo}_{piso}{dpto}{torre}';

const TOKENS = ['codigo', 'piso', 'dpto', 'torre'];

/** Mensaje de error si el formato no sirve; null si esta bien (mismas reglas que el servidor). */
export function validarFormato(formato: string): string | null {
  if (!formato.trim()) return 'El formato no puede estar vacío.';
  if (formato.length > 80) return 'El formato admite hasta 80 caracteres.';
  if (!formato.startsWith('{codigo}')) return 'Debe empezar con {codigo}: el código original va siempre al principio.';
  const usados: string[] = formato.match(/\{[^}]*\}/g) ?? [];
  for (const u of usados) if (!TOKENS.includes(u.slice(1, -1))) return `Parte desconocida ${u}. Usa {codigo}, {piso}, {dpto} o {torre}.`;
  if (/[{}\\/:*?"<>|]/.test(formato.replace(/\{[^}]*\}/g, ''))) return 'Tiene caracteres no permitidos.';
  if (!usados.includes('{piso}') && !usados.includes('{dpto}')) return 'Debe incluir {piso} o {dpto}.';
  return null;
}

export interface PosicionEjemplo {
  codigo: string;
  torre?: string | null;
  piso?: number | null;
  dpto?: number | null;
}

/** V01, piso 1, depto 1, torre A -> "V01_101A". null si falta el piso o el departamento. */
export function generarNomenclatura(formato: string, p: PosicionEjemplo): string | null {
  if (p.piso == null || p.dpto == null) return null;
  const partes: Record<string, string> = {
    codigo: p.codigo,
    piso: String(p.piso),
    dpto: String(p.dpto).padStart(2, '0'),
    torre: (p.torre ?? '').trim().toUpperCase(),
  };
  return formato.replace(/\{(codigo|piso|dpto|torre)\}/g, (_, k: string) => partes[k]);
}

/** "1.234,56 UF": hasta 2 decimales, separadores chilenos. */
export function formatoMonto(valor: number | null | undefined, moneda = 'UF'): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return `${valor.toLocaleString('es-CL', { maximumFractionDigits: 2 })} ${moneda}`;
}

export type EstadoSaldo = 'completo' | 'pendiente' | 'excedido';

/** completo = se cubicó todo lo contratado; pendiente = falta; excedido = hay más cubicadas que contratadas. */
export function estadoSaldo(saldo: number): EstadoSaldo {
  return saldo === 0 ? 'completo' : saldo > 0 ? 'pendiente' : 'excedido';
}

/** Dispara la descarga de un archivo generado en memoria. */
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "2200,5" para mostrar un numero de mm en un campo de texto (coma decimal, sin separador de miles). */
export const mmATexto = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n).replace('.', ','));

// Lineas de texto para mostrar el resultado de subir una planilla o de leer el presupuesto.
export function lineasReporteImportacion(r: ReporteImportacionCubicacion): string[] {
  if (r.formato === 'plantilla') {
    const partes = [`${r.actualizadas} ventana(s) actualizada(s) de ${r.filas} filas`, `${r.posicionadasAhora} con posición nueva`, `${r.rectificadasAhora} rectificada(s)`];
    if (r.sinCambios > 0) partes.push(`${r.sinCambios} sin cambios`);
    return [partes.join(' · ')];
  }
  const u = r.unidades;
  return [
    `Tipos: ${r.tipos.nuevos} nuevos, ${r.tipos.actualizados} actualizados`,
    `Ventanas: ${u.asignadas} asignadas a ventanas del presupuesto, ${u.nuevas} nuevas, ${u.existentes} ya existían${u.rectificadasAhora > 0 ? `, ${u.rectificadasAhora} con rasgo cargado` : ''}`,
    `Áreas comunes: ${u.areasComunes}`,
  ];
}

export function lineaReporteSincronizacion(r: ReporteSincronizacionCubicacion): string {
  const partes = [`${r.tipos.nuevos} tipo(s) nuevo(s)`, `${r.tipos.actualizados} actualizado(s)`, `${r.unidadesCreadas} unidad(es) creada(s)`];
  if (r.unidadesQuitadas > 0) partes.push(`${r.unidadesQuitadas} sin posición quitada(s)`);
  return partes.join(' · ');
}
