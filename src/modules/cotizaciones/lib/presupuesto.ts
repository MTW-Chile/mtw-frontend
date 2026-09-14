import type { Ventana } from '../../../types';

export interface PrecioVentaLinea {
  precioUnitarioCLP: number;
  precioVentaCLP: number;
}

/**
 * Precio comercial de cada ventana/línea, calculado de forma INDEPENDIENTE
 * por línea -- nunca prorrateado contra un total ni contra las demás
 * líneas. Se probó repartir un total negociado proporcionalmente entre
 * líneas (por importeUnitario, luego con distintos respaldos de costo para
 * líneas PERSONALIZADO); el resultado practico de eso es que el precio
 * mostrado para UNA línea cambiaba segun que otras líneas hubiera en el
 * presupuesto (agregar o quitar la Puerta Protex modificaba el precio de
 * una ventana HETMO real que no tiene nada que ver con la Protex) --
 * inaceptable para un presupuesto comercial, cada línea tiene que valer lo
 * mismo la tenga sola o acompañada.
 *
 * Cada línea usa su propia fuente de verdad, sin mezclarse con otras:
 * - Línea HETMO: su importeUnitario (HETMO lo entrega en UF, no en CLP
 *   como el resto de los montos internos de la app -- práctica común en
 *   cotización de construcción en Chile; se convierte a CLP con tasaUf).
 * - Línea PERSONALIZADO (Vidrio DVH, Puerta Protex): nunca trae
 *   importeUnitario de HETMO, así que se usa el costo real de sus
 *   materiales (solo Vidrios y Herrajes en su receta, ver
 *   /api/ventanas/manual -- a diferencia de una ventana HETMO real, sí es
 *   atribuible 1:1 sin la logica de barras optimizadas de Perfileria) con
 *   el mismo margen que el resto del proyecto (ventaTotalCLP /
 *   costoTotalProyectoCLP, calculados en Step5 via computeCostoTotalYVenta).
 */
export function computePreciosVenta(
  ventanas: Ventana[],
  costoLineaManualCLP: (v: Ventana) => number,
  margenMultiplicador: number,
  tasaUf: number
): Map<string, PrecioVentaLinea> {
  const resultado = new Map<string, PrecioVentaLinea>();
  const factorUf = tasaUf > 0 ? tasaUf : 1;
  const margen = margenMultiplicador > 0 ? margenMultiplicador : 1;

  ventanas.forEach((v) => {
    const importeHetmoCLP = Math.max(0, Number(v.importeUnitario) || 0) * factorUf;
    const precioUnitarioCLP = importeHetmoCLP > 0 ? importeHetmoCLP : Math.max(0, costoLineaManualCLP(v)) * margen;
    const precioVentaCLP = precioUnitarioCLP * (v.unidades || 1);
    resultado.set(v.id, { precioUnitarioCLP, precioVentaCLP });
  });

  return resultado;
}
