import type { Material } from '../types';

/**
 * Precio de catalogo de un material por UNIDAD DE COMPRA, en CLP: precio de
 * origen (por unidad de precio, ej. metro) x unidades de precio por unidad de
 * compra (ej. 5,8 m por barra) x tasa de su moneda. El formato (moneda,
 * unidades y factor) lo resuelve mtw-api (material.formato): el propio del
 * material o el de su tipo de producto. Ninguna pantalla deduce el formato
 * por su cuenta.
 */
export function precioCompraCLP(material: Material, tasas: { dolar: number; euro: number; uf: number }): number | null {
  if (material.precioOrigen == null || !material.formato) return null;
  const { moneda, factorCompra } = material.formato;
  const tasa = moneda === 'USD' ? tasas.dolar : moneda === 'EUR' ? tasas.euro : moneda === 'UF' ? tasas.uf : 1;
  return material.precioOrigen * factorCompra * tasa;
}

/** Unidad de compra de un material (la de la OC), con respaldo a la del espejo HETMO. */
export const unidadCompra = (material: Material) => material.formato?.unidadCompra.codigo ?? material.unidadMedida;
