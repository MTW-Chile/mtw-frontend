import type { Ventana, VentanaGeometria, MaterialVentana } from '../../../../types';
import type { WindowLine, LineMaterial } from './types';

/**
 * Convierte un número a positivo o null si es inválido.
 * Para dimensiones (ancho, alto, unidades).
 */
const toPositive = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Convierte un material del tipo Ventana (API) al formato interno LineMaterial.
 */
const toLineMaterial = (m: MaterialVentana): LineMaterial => ({
  descripcionArticulo: m.material?.descripcion,
  descripcion: m.material?.descripcion,
  familia: m.material?.familia,
  cantidad: m.cantidad,
  uds: m.piezas ?? undefined,
  acabado: m.acabado ?? undefined,
});

/**
 * Asigna numero_ventana a cada geometría basado en perteneceHueco.
 * Si perteneceHueco es null, infiere el número de ventana a partir de:
 *
 * 1. Items con tipoElemento === 10000 (definición de paño) — cada uno inicia
 *    un nuevo paño. Los items siguientes (tipo 3, 6, etc.) pertenecen a ese
 *    paño hasta el siguiente item tipo 10000.
 *
 * 2. Si no hay items tipo 10000 pero al menos 2 geometrías declaran
 *    perteneceHueco distinto (y mayor que 0: HETMO usa 0 como "sin
 *    asignar", no como paño real), se confía en ese valor tal cual viene.
 *    Un único valor no alcanza para inferir los límites de los paños de
 *    forma fiable, así que en ese caso se sigue con la inferencia por
 *    items tipo 10000.
 *
 * En HETMO, cada paño de una ventana compuesta tiene:
 *   - Un item tipo 10000 con ancho/alto del paño (opcional)
 *   - Items tipo 3 (aperturas) que pertenecen a ese paño
 *   - Items tipo 6 (cortes) que pertenecen a ese paño
 *
 * Todos los items del mismo paño comparten el mismo numero_ventana.
 */
const assignPanelNumbers = (geometrias: VentanaGeometria[]): VentanaGeometria[] => {
  if (!geometrias.length) return geometrias;

  // perteneceHueco === 0 no identifica un paño real, así que para esta
  // inferencia se trata igual que si no viniera declarado.
  const paneloDe = (g: VentanaGeometria): number | null =>
    g.perteneceHueco != null && g.perteneceHueco > 0 ? g.perteneceHueco : null;

  const distinctPaneles = new Set(
    geometrias.map(paneloDe).filter((n): n is number => n != null)
  );
  if (distinctPaneles.size >= 2) return geometrias;

  // Inferir numero_ventana a partir de items tipo 10000.
  // Number(...) normaliza: tipoElemento puede llegar sin tipar como string
  // desde algún consumidor que no pase por el tipo VentanaGeometria.
  const esPano = (g: VentanaGeometria) => Number(g.tipoElemento) === 10000;
  const panelStarts = geometrias
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => esPano(g));

  if (panelStarts.length >= 2) {
    // Múltiples paños definidos por items tipo 10000
    let currentPanel = 1;
    const result: VentanaGeometria[] = [];
    for (let i = 0; i < geometrias.length; i++) {
      const g = geometrias[i];
      if (esPano(g) && i > 0) {
        currentPanel++;
      }
      result.push({
        ...g,
        perteneceHueco: currentPanel,
      });
    }
    return result;
  }

  // Un solo paño o ninguno: todas las geometrías pertenecen al paño 1
  return geometrias;
};

/**
 * Convierte una Ventana (tipo API) al formato interno WindowLine que usan
 * el núcleo de geometría (geometryCore.ts) y el renderizador SVG.
 *
 * El núcleo acepta VentanaGeometria[] directamente (camelCase, con
 * parametrosJson para los campos de nivel 2 que no tienen columna propia
 * -- barrotillos, travesaños, cota, N1/N2, altura de manilla, curvatura --
 * bajo su nombre HETMO original). No hace falta traducir a snake_case acá;
 * ver geometryCore.ts:normalizeGeometryItem() para el único ajuste que el
 * núcleo sigue necesitando.
 */
export function toWindowLine(ventana: Ventana): WindowLine | null {
  if (!ventana) return null;

  const ancho = toPositive(ventana.anchoMm) ?? 1;
  const alto = toPositive(ventana.altoMm) ?? 1;

  // Pre-procesar geometrías para asignar perteneceHueco correctamente
  const geometrias = Array.isArray(ventana.geometrias) && ventana.geometrias.length > 0
    ? assignPanelNumbers(ventana.geometrias)
    : undefined;

  return {
    lineaHetmo: toPositive(ventana.lineaHetmo) ?? undefined,
    modelo: ventana.modelo,
    ancho,
    alto,
    tipoApertura: ventana.dibujoTipoApertura ?? undefined,
    acabadoCodigo: ventana.acabadoCodigo ?? undefined,
    acabadoDescripcion: (ventana as any).acabadoDescripcion ?? undefined,
    acabadoPatron: (ventana as any).acabadoPatron ?? undefined,
    uds: toPositive(ventana.unidades) ?? undefined,
    cantidadVidriosPorUnidad: toPositive(ventana.numeroCuadrosHojas) ?? undefined,
    dibujoTipoApertura: ventana.dibujoTipoApertura ?? undefined,
    dibujoSinMarco: false,
    numeroCuadrosHojas: toPositive(ventana.numeroCuadrosHojas) ?? undefined,
    dibujoVidrio: (ventana as any).dibujoVidrio ?? undefined,
    vidrioCodigo: (ventana as any).vidrioCodigo ?? undefined,
    dibujoVidrios: Array.isArray((ventana as any).dibujoVidrios) ? (ventana as any).dibujoVidrios : undefined,
    geometria: geometrias,
    materiales: Array.isArray(ventana.materiales) && ventana.materiales.length > 0
      ? ventana.materiales.map(toLineMaterial)
      : undefined,
  };
}