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
 * Convierte un valor numérico a número finito, aceptando cero y negativos.
 * Para modificadores de forma, códigos de forma, etc.
 */
const toFiniteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Convierte un material del tipo Ventana (API) al formato interno LineMaterial.
 */
const toLineMaterial = (m: MaterialVentana): LineMaterial => ({
  descripcionArticulo: m.material?.descripcion,
  descripcion: m.material?.descripcion,
  cantidad: m.cantidad,
  uds: m.piezas ?? undefined,
});

/**
 * Asigna numero_ventana a cada geometría basado en perteneceHueco.
 * Si perteneceHueco es null, infiere el número de ventana a partir de:
 *
 * 1. Items con tipoElemento === 10000 (definición de paño) — cada uno inicia
 *    un nuevo paño. Los items siguientes (tipo 3, 6, etc.) pertenecen a ese
 *    paño hasta el siguiente item tipo 10000.
 *
 * 2. Si no hay items tipo 10000, busca items tipo 3 (aperturas) que tengan
 *    numero_ventana explícito (del HETMO original). Esto cubre casos donde
 *    HETMO declara múltiples paños sin items tipo 10000, por ejemplo en
 *    ventanas compuestas donde cada paño tiene su propia apertura.
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

  // Si alguna geometría tiene perteneceHueco no nulo, usarlo directamente
  const hasPerteneceHueco = geometrias.some(g => g.perteneceHueco != null);
  if (hasPerteneceHueco) return geometrias;

  // Intentar 1: Inferir numero_ventana a partir de items tipo 10000
  const panelStarts = geometrias
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.tipoElemento === 10000);

  if (panelStarts.length >= 2) {
    // Múltiples paños definidos por items tipo 10000
    let currentPanel = 1;
    const result: VentanaGeometria[] = [];
    for (let i = 0; i < geometrias.length; i++) {
      const g = geometrias[i];
      if (g.tipoElemento === 10000 && i > 0) {
        currentPanel++;
      }
      result.push({
        ...g,
        perteneceHueco: currentPanel,
      });
    }
    return result;
  }

  // Intentar 2: Buscar perteneceHueco explícito en items tipo 3 (aperturas)
  // Algunos HETMO declaran múltiples paños con perteneceHueco en las aperturas
  // sin items tipo 10000. Ej: ventana compuesta con 2 hojas proyectantes.
  const aperturePanelNumbers = new Set<number>();
  geometrias.forEach(g => {
    if (g.tipoElemento === 3 && g.perteneceHueco != null && g.perteneceHueco > 0) {
      aperturePanelNumbers.add(g.perteneceHueco);
    }
  });

  if (aperturePanelNumbers.size >= 2) {
    // Múltiples paños detectados por perteneceHueco en aperturas
    return geometrias.map(g => ({
      ...g,
      perteneceHueco: g.perteneceHueco ?? 1, // NO usar posicion como respaldo
    }));
  }

  // Un solo paño o ninguno: todas las geometrías pertenecen al paño 1
  return geometrias;
};

/**
 * Convierte una geometría del tipo VentanaGeometria (API) al formato crudo
 * que espera el núcleo de geometría (legacyGeometryCore).
 * NOTA: Este formato usa snake_case porque el núcleo (compartido con API/PDF)
 *       lee claves snake_case. Ver toCoreLine() para el puente tipado.
 *
 * Algunos campos (codigoComponente, barrotillosHorizontales, etc.) no existen
 * en el tipo VentanaGeometria pero SÍ son devueltos por el endpoint HETMO.
 * Se accede via rawGeometry (any) para capturarlos sin perder información.
 */
const toRawGeometry = (g: VentanaGeometria): Record<string, unknown> => {
  const rg = g as any;
  return {
    numero_ventana: g.perteneceHueco ?? 1, // NO usar g.posicion - significa otra cosa en HETMO
    orden: g.ordenGeometria,
    orden_geometria: g.ordenGeometria,
    tipo_elemento: toPositive(g.tipoElemento),
    elemento: toPositive(g.tipoElemento),
    tipo_geometria: toFiniteOrNull(g.tipoGeometria), // puede ser 0, que es válido
    ancho: toPositive(g.anchoMm),
    alto: toPositive(g.altoMm),
    ancho_mm: toPositive(g.anchoMm),
    alto_mm: toPositive(g.altoMm),
    tipo_apertura: toPositive(g.tipoApertura),
    apertura: toPositive(g.tipoApertura),
    posicion: g.posicion,
    pertenece_hueco: g.perteneceHueco,
    forma_codigo: toFiniteOrNull(g.formaCodigo), // 0 es válido en specialOutline()
    modificador_x: toFiniteOrNull(g.modificadorX), // puede ser negativo (trapecios)
    modificador_y: toFiniteOrNull(g.modificadorY), // puede ser negativo (trapecios)
    // Campos HETMO adicionales que el núcleo consulta.
    // Existen en la respuesta del endpoint aunque no estén en el tipo TS.
    codigo_componente: rg.codigoComponente ?? rg.codigo_componente,
    barrotillos_horizontales: rg.barrotillosHorizontales ?? rg.barrotillos_horizontales,
    barrotillos_verticales: rg.barrotillosVerticales ?? rg.barrotillos_verticales,
    bh_numero_travesano: rg.bhNumeroTravesano ?? rg.bh_numero_travesano,
    bh_x_inicio: rg.bhXInicio ?? rg.bh_x_inicio,
    bh_x_fin: rg.bhXFin ?? rg.bh_x_fin,
    bh_y_inicio: rg.bhYInicio ?? rg.bh_y_inicio,
    bh_y_fin: rg.bhYFin ?? rg.bh_y_fin,
    cota: rg.cota ?? rg.cota_fija,
    cota_fija: rg.cotaFija ?? rg.cota_fija,
    geometria_n1: rg.geometriaN1,
    geometria_n2: rg.geometriaN2,
    altura_manilla: toFiniteOrNull(rg.alturaManilla ?? rg.altura_manilla),
    radio_curvatura: toFiniteOrNull(rg.radioCurvatura ?? rg.radio_curvatura),
    angulo_curvatura: toFiniteOrNull(rg.anguloCurvatura ?? rg.angulo_curvatura),
    numero_hoja: rg.numeroHoja ?? rg.numero_hoja,
    orden_hoja: rg.ordenHoja ?? rg.orden_hoja,
  };
};

/**
 * Convierte una Ventana (tipo API) al formato interno WindowLine
 * que usan el núcleo de geometría y el renderizador SVG.
 *
 * Las claves usan camelCase para el uso interno.
 * Para pasar datos al núcleo (que lee snake_case), ver toCoreLine().
 */
export function toWindowLine(ventana: Ventana): WindowLine | null {
  if (!ventana) return null;

  const ancho = toPositive(ventana.anchoMm) ?? 1;
  const alto = toPositive(ventana.altoMm) ?? 1;

  // Pre-procesar geometrías para asignar numero_ventana correctamente
  const rawGeometrias = Array.isArray(ventana.geometrias) && ventana.geometrias.length > 0
    ? assignPanelNumbers(ventana.geometrias).map(toRawGeometry)
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
    geometria: rawGeometrias,
    materiales: Array.isArray(ventana.materiales) && ventana.materiales.length > 0
      ? ventana.materiales.map(toLineMaterial)
      : undefined,
  };
}

/**
 * Convierte una WindowLine (camelCase) al formato snake_case que espera
 * el núcleo de geometría (legacyGeometryCore.ts).
 *
 * El núcleo NO se puede modificar porque es compartido con la API y el generador
 * de PDF. Este puente asegura que las funciones core.* reciban las claves
 * exactas que esperan (tipo_apertura, dibujo_ancho, etc.).
 */
export function toCoreLine(line: WindowLine): Record<string, unknown> {
  return {
    ancho: line.ancho,
    alto: line.alto,
    ancho_mm: line.ancho,
    alto_mm: line.alto,
    dibujo_ancho: line.dibujoAncho ?? line.ancho,
    dibujo_alto: line.dibujoAlto ?? line.alto,
    uds: line.uds ?? 0,
    linea_hetmo: line.lineaHetmo,
    lineaHetmo: line.lineaHetmo,
    dibujo_tipo_apertura: line.dibujoTipoApertura ?? line.tipoApertura,
    tipo_apertura: line.dibujoTipoApertura ?? line.tipoApertura,
    apertura: line.dibujoTipoApertura ?? line.tipoApertura,
    acabado: line.acabadoCodigo,
    acabado_descripcion: line.acabadoDescripcion,
    acabado_patron: line.acabadoPatron,
    modelo: line.modelo,
    serie_perfiles: line.seriePerfiles,
    numero_cuadros_hojas: line.numeroCuadrosHojas ?? line.cantidadVidriosPorUnidad,
    NUMERO_CUADROS_HOJAS: line.numeroCuadrosHojas ?? line.cantidadVidriosPorUnidad,
    altura_manilla: line.alturaManilla,
    dibujo_vidrio: line.dibujoVidrio,
    vidrio_codigo: line.vidrioCodigo,
    dibujo_vidrios: line.dibujoVidrios,
    dibujo_sin_marco: line.dibujoSinMarco,
    geometria: line.geometria,
    materiales: line.materiales,
  };
}

/**
 * Adaptador legacy: convierte Ventana al formato `any` que espera
 * el código existente (legacyGeometryCore + legacyGeometrySvg).
 *
 * Mantenido para compatibilidad mientras se migra al nuevo sistema.
 * @deprecated Usar `toWindowLine` en código nuevo.
 */
export function toLegacyLine(ventana: Ventana): Record<string, unknown> | null {
  if (!ventana) return null;

  const ancho = toPositive(ventana.anchoMm) ?? 1;
  const alto = toPositive(ventana.altoMm) ?? 1;

  // Pre-procesar geometrías para asignar numero_ventana correctamente
  const rawGeometrias = Array.isArray(ventana.geometrias) && ventana.geometrias.length > 0
    ? assignPanelNumbers(ventana.geometrias).map(toRawGeometry)
    : [];

  return {
    ancho,
    alto,
    ancho_mm: ancho,
    alto_mm: alto,
    dibujo_ancho: ancho,
    dibujo_alto: alto,
    uds: toPositive(ventana.unidades),
    linea_hetmo: toPositive(ventana.lineaHetmo),
    dibujo_tipo_apertura: ventana.dibujoTipoApertura,
    tipo_apertura: ventana.dibujoTipoApertura,
    apertura: ventana.dibujoTipoApertura,
    acabado: ventana.acabadoCodigo,
    acabado_descripcion: (ventana as any).acabadoDescripcion,
    acabado_patron: (ventana as any).acabadoPatron,
    geometria: rawGeometrias,
    materiales: Array.isArray(ventana.materiales) && ventana.materiales.length > 0
      ? ventana.materiales.map(toLineMaterial)
      : [],
  };
}