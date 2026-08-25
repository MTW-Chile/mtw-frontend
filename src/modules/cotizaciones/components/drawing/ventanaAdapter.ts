import type { Ventana, VentanaGeometria, MaterialVentana } from '../../../../types';
import type { WindowLine, LineMaterial } from './types';

/**
 * Convierte un número a positivo o null si es inválido.
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
  cantidad: m.cantidad,
  uds: m.piezas ?? undefined,
});

/**
 * Convierte una geometría del tipo VentanaGeometria (API) al formato crudo
 * que espera el núcleo de geometría (legacyGeometryCore).
 */
const toRawGeometry = (g: VentanaGeometria): Record<string, unknown> => ({
  numero_ventana: g.perteneceHueco ?? g.posicion ?? 1,
  orden: g.ordenGeometria,
  orden_geometria: g.ordenGeometria,
  tipo_elemento: toPositive(g.tipoElemento),
  elemento: toPositive(g.tipoElemento),
  tipo_geometria: toPositive(g.tipoGeometria),
  ancho: toPositive(g.anchoMm),
  alto: toPositive(g.altoMm),
  ancho_mm: toPositive(g.anchoMm),
  alto_mm: toPositive(g.altoMm),
  tipo_apertura: toPositive(g.tipoApertura),
  apertura: toPositive(g.tipoApertura),
  posicion: g.posicion,
  pertenece_hueco: g.perteneceHueco,
  forma_codigo: toPositive(g.formaCodigo),
  modificador_x: toPositive(g.modificadorX),
  modificador_y: toPositive(g.modificadorY),
});

/**
 * Convierte una Ventana (tipo API) al formato interno WindowLine
 * que usan el núcleo de geometría y el renderizador SVG.
 *
 * Reemplaza el anterior `toLegacyLine` que retornaba `any`.
 */
export function toWindowLine(ventana: Ventana): WindowLine | null {
  if (!ventana) return null;

  const ancho = toPositive(ventana.anchoMm) ?? 1;
  const alto = toPositive(ventana.altoMm) ?? 1;

  return {
    lineaHetmo: toPositive(ventana.lineaHetmo) ?? undefined,
    modelo: ventana.modelo,
    ancho,
    alto,
    tipoApertura: ventana.dibujoTipoApertura ?? undefined,
    acabadoCodigo: ventana.acabadoCodigo ?? undefined,
    uds: toPositive(ventana.unidades) ?? undefined,
    cantidadVidriosPorUnidad: toPositive(ventana.numeroCuadrosHojas) ?? undefined,
    dibujoTipoApertura: ventana.dibujoTipoApertura ?? undefined,
    dibujoSinMarco: false,
    numeroCuadrosHojas: toPositive(ventana.numeroCuadrosHojas) ?? undefined,
    geometria: Array.isArray(ventana.geometrias) && ventana.geometrias.length > 0
      ? ventana.geometrias.map(toRawGeometry)
      : undefined,
    materiales: Array.isArray(ventana.materiales) && ventana.materiales.length > 0
      ? ventana.materiales.map(toLineMaterial)
      : undefined,
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
    acabado_descripcion: null,
    acabado_patron: null,
    geometria: Array.isArray(ventana.geometrias) && ventana.geometrias.length > 0
      ? ventana.geometrias.map(toRawGeometry)
      : [],
    materiales: Array.isArray(ventana.materiales) && ventana.materiales.length > 0
      ? ventana.materiales.map(toLineMaterial)
      : [],
  };
}