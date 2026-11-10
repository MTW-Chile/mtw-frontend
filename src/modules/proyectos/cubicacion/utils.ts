import type { ReporteImportacionCubicacion, ReporteSincronizacionCubicacion } from '../../../types';

// Utilidades puras del cubicador (sin red ni DOM). La nomenclatura y las medidas se
// calculan en el servidor (mtw-api/src/cubicador-reglas.ts); aca solo se replica la
// nomenclatura para mostrar un ejemplo en vivo al editar el formato.

export const FORMATO_NOMENCLATURA_DEFECTO = '{codigo}_{nombreUnidad}{torre}';
// Por casa: V01, casa C3, recinto Dorm1 -> V01_C3_Dorm1 (una sola casa: V01_Dorm1).
export const FORMATO_NOMENCLATURA_CASA = '{codigo}_{torre}_{nombreUnidad}';

const TOKENS = ['codigo', 'nombreUnidad', 'torre'];

/** Mensaje de error si el formato no sirve; null si esta bien (mismas reglas que el servidor). */
export function validarFormato(formato: string): string | null {
  if (!formato.trim()) return 'El formato no puede estar vacío.';
  if (formato.length > 80) return 'El formato admite hasta 80 caracteres.';
  if (!formato.startsWith('{codigo}')) return 'Debe empezar con {codigo}: el código original va siempre al principio.';
  const usados: string[] = formato.match(/\{[^}]*\}/g) ?? [];
  for (const u of usados) if (!TOKENS.includes(u.slice(1, -1))) return `Parte desconocida ${u}. Usa {codigo}, {nombreUnidad} o {torre}.`;
  if (/[{}\\/:*?"<>|]/.test(formato.replace(/\{[^}]*\}/g, ''))) return 'Tiene caracteres no permitidos.';
  if (!usados.includes('{nombreUnidad}')) return 'Debe incluir {nombreUnidad}.';
  return null;
}

export interface PosicionEjemplo {
  codigo: string;
  torre?: string | null;
  // Unidad.nombre (ej. "204"): el numero completo del depto, o el nombre de la unidad especial.
  nombreUnidad?: string | null;
}

/** V01, unidad "101", torre A -> "V01_101A". null si falta la unidad. */
export function generarNomenclatura(formato: string, p: PosicionEjemplo): string | null {
  if (!p.nombreUnidad) return null;
  // Sin espacios (el nombre se usa como nombre de linea en HETMO): "Dormitorio 1" -> "Dormitorio1".
  const sinEspacios = (t: string) => t.replace(/\s+/g, '');
  const partes: Record<string, string> = {
    codigo: p.codigo,
    nombreUnidad: sinEspacios(p.nombreUnidad),
    torre: sinEspacios((p.torre ?? '').trim().toUpperCase()),
  };
  // Una casa sin nombre (la unica de la obra) deja la torre vacia: "V01__Dorm1" -> "V01_Dorm1".
  return formato.replace(/\{(codigo|nombreUnidad|torre)\}/g, (_, k: string) => partes[k]).replace(/_{2,}/g, '_');
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

// Lineas de texto para mostrar el resultado de subir una planilla.
export function lineasReporteImportacion(r: ReporteImportacionCubicacion): string[] {
  if (r.formato === 'plantilla') {
    const partes = [`${r.actualizadas} ventana(s) actualizada(s) de ${r.filas} filas`, `${r.posicionadasAhora} con posición nueva`, `${r.rectificadasAhora} rectificada(s)`];
    if (r.sinCambios > 0) partes.push(`${r.sinCambios} sin cambios`);
    return [partes.join(' · ')];
  }
  const v = r.ventanas;
  const e = r.estructura;
  const lineas = [
    `${r.ventanasPlanilla} ventana(s) en la hoja «${r.hoja}». La planilla ubica solo las que también están fabricadas: ${v.ubicadas} ubicada(s) ahora, ${v.movidas} corregida(s) de lugar y ${v.yaEstaban} ya estaban en su lugar.`,
    `Sobran en la planilla (sin ventana fabricada): ${v.sobranEnPlanilla}. Fabricadas que no están en la planilla: ${v.fueraDePlanilla}. Repetidas (posibles reposiciones): ${v.repetidas}.`,
    `Tipos: ${r.tipos.actualizados} actualizado(s) con lo contratado de la hoja BASE${r.tipos.renombrados.length ? ` (${r.tipos.renombrados.join(', ')})` : ''}.`,
  ];
  if (e.torres || e.pisos || e.unidades || e.quitadas) {
    lineas.push(`Estructura: ${e.torres} torre(s), ${e.pisos} piso(s) y ${e.unidades} departamento(s) nuevos${e.quitadas ? `; ${e.quitadas} departamento(s) sin torre quedaron vacíos y se quitaron` : ''}.`);
  }
  return lineas;
}

// Secciones de diferencias de la planilla de control, en el orden en que conviene revisarlas.
export function seccionesDiferenciasControl(r: Extract<ReporteImportacionCubicacion, { formato: 'control' }>): { titulo: string; items: string[] }[] {
  return [
    { titulo: 'Fabricadas que no están en la planilla (quedaron por ubicar)', items: r.fueraDePlanilla },
    { titulo: 'Repetidas: posibles reposiciones (quedaron por ubicar)', items: r.repetidas },
    { titulo: 'Sobran en la planilla, por piso', items: r.sobrantesPorPiso },
    { titulo: 'Sobran en la planilla, fila por fila (no se crearon)', items: r.sobrantes },
    { titulo: 'Diferencias dentro de la planilla (detalle contra hoja BASE)', items: r.diferenciasPlanilla },
    { titulo: 'Medidas fabricadas muy distintas a la planilla', items: r.medidas },
    { titulo: 'Reposiciones en los documentos (no entraron a la cubicación)', items: r.reposiciones },
    { titulo: 'Otros avisos', items: r.advertencias },
  ].filter((s) => s.items.length > 0);
}

export function lineaReporteSincronizacion(r: ReporteSincronizacionCubicacion): string {
  const partes = [`${r.tipos.nuevos} tipo(s) nuevo(s)`, `${r.tipos.actualizados} actualizado(s)`, `${r.unidadesCreadas} unidad(es) creada(s)`];
  if (r.unidadesQuitadas > 0) partes.push(`${r.unidadesQuitadas} sin posición quitada(s)`);
  return partes.join(' · ');
}

// ---- Cubicador visual ----

/** Entero escrito en un campo de texto (con signo); null si esta vacio o no es un entero. */
export const leerEntero = (t: string): number | null => (/^-?\d+$/.test(t.trim()) ? Number(t.trim()) : null);

/** Nombres de torre separados por coma o espacio: "a, b" -> ["A","B"]; vacio = obra sin torres ([""]). */
export function leerTorres(texto: string): string[] {
  const nombres = [...new Set(texto.split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
  return nombres.length ? nombres : [''];
}

/** Lista separada por coma, punto y coma o salto de linea: "estar, cocina" -> ["estar","cocina"] (sin repetidos). */
export const leerLista = (texto: string): string[] => [...new Set(texto.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean))];

/** Pisos desde..hasta, ambos incluidos; [] si el rango no es valido. */
export const rangoPisos = (desde: number, hasta: number): number[] => (hasta < desde ? [] : Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i));

export function mensajeAsignacion(r: { asignadas: number; faltan: number }, codigo: string): string {
  if (r.faltan === 0) return `${r.asignadas} ${codigo} asignada(s).`;
  return `${r.asignadas} ${codigo} asignada(s); no quedaban más ${codigo} por ubicar (faltaron ${r.faltan}). Sube la cantidad contratada del tipo o agrega de más a propósito.`;
}

export function mensajeCopiaPiso(r: { pisos: number; ventanas: number; deptosOmitidos: number; faltan: { codigo: string; cantidad: number }[] }): string {
  const partes = [`${r.ventanas} ventana(s) copiada(s) a ${r.pisos} piso(s)`];
  if (r.deptosOmitidos > 0) partes.push(`${r.deptosOmitidos} departamento(s) ya tenían ventanas y no se tocaron`);
  if (r.faltan.length > 0) partes.push(`faltaron por ubicar: ${r.faltan.map((f) => `${f.cantidad} ${f.codigo}`).join(', ')}`);
  return partes.join(' · ') + '.';
}
