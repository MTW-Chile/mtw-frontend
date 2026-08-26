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
 * Convierte una geometría del tipo VentanaGeometria (API) al formato crudo
 * que espera el núcleo de geometría (legacyGeometryCore).
 * NOTA: Este formato usa snake_case porque el núcleo (compartido con API/PDF)
 *       lee claves snake_case. Ver toCoreLine() para el puente tipado.
 *
 * Los campos de nivel 2 (barrotillos, travesaños, cota, N1/N2, altura de
 * manilla, curvatura) no tienen columna propia en VentanaGeometria: viven en
 * parametrosJson, la fila HETMO cruda tal como la persiste el sync. Se leen
 * de ahí, con las columnas tipadas (numeroHoja, carril) como fuente
 * preferida cuando existen.
 */
const toRawGeometry = (g: VentanaGeometria): Record<string, unknown> => {
  const params = g.parametrosJson ?? {};
  const fromParams = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = params[key];
      if (value !== undefined && value !== null) return value;
    }
    return undefined;
  };
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
    // Nivel 2: sin columna propia, se leen de parametrosJson.
    codigo_componente: fromParams('codigo_componente', 'codigoComponente'),
    barrotillos_horizontales: fromParams('barrotillos_horizontales', 'barrotillosHorizontales'),
    barrotillos_verticales: fromParams('barrotillos_verticales', 'barrotillosVerticales'),
    bh_numero_travesano: fromParams('bh_numero_travesano', 'bhNumeroTravesano'),
    bh_x_inicio: fromParams('bh_x_inicio', 'bhXInicio'),
    bh_x_fin: fromParams('bh_x_fin', 'bhXFin'),
    bh_y_inicio: fromParams('bh_y_inicio', 'bhYInicio'),
    bh_y_fin: fromParams('bh_y_fin', 'bhYFin'),
    cota: fromParams('cota', 'cota_fija', 'cotaFija'),
    cota_fija: fromParams('cota_fija', 'cotaFija'),
    geometria_n1: fromParams('geometria_n1', 'geometriaN1'),
    geometria_n2: fromParams('geometria_n2', 'geometriaN2'),
    altura_manilla: toFiniteOrNull(fromParams('altura_manilla', 'alturaManilla')),
    radio_curvatura: toFiniteOrNull(fromParams('radio_curvatura', 'radioCurvatura')),
    angulo_curvatura: toFiniteOrNull(fromParams('angulo_curvatura', 'anguloCurvatura')),
    // Nivel 1: ya tienen columna propia desde el fix del sync; parametrosJson
    // sólo cubre las filas sincronizadas antes de ese fix.
    numero_hoja: g.numeroHoja ?? fromParams('numero_hoja', 'numeroHoja'),
    orden_hoja: fromParams('orden_hoja', 'ordenHoja'),
    carril: g.carril ?? fromParams('carril'),
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