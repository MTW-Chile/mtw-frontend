import type { ProyectoVersion, Ventana } from '../../../types';

export interface PrecioVentaLinea {
  precioUnitarioCLP: number;
  precioVentaCLP: number;
}

/**
 * Precio comercial de cada ventana, prorrateado: NO se usa el precio
 * absoluto que HETMO calculó por línea (importeUnitario) -- solo se usa
 * como PESO relativo entre líneas, contra la base imponible que HETMO
 * reporta para toda la version (sumaTotalLineas). El total absoluto lo fija
 * el valor de venta ya negociado en la Hoja de Fijación (con margen), no
 * HETMO. Así, la suma de precioVentaCLP de todas las líneas cierra exacto
 * contra ventaTotalCLP, sin depender de que el precio de HETMO por línea
 * haya sido correcto.
 *
 * Si no hay base imponible utilizable (sumaTotalLineas ausente/0, o ninguna
 * línea con importeUnitario), se reparte por unidades como respaldo -- peor
 * que el peso real, pero nunca deja una línea sin precio.
 *
 * NOTA: se probó un respaldo por costo real de materiales para líneas sin
 * importeUnitario (manuales como Puerta Protex), pero el costo de
 * Perfileria/Refuerzos NO es atribuible a una ventana individual -- HETMO
 * lo entrega como resumen a nivel de TODO el proyecto (barras optimizadas
 * de corte), no por línea. Confirmado en producción: eso hacía que una
 * ventana real con perfilería quedara en peso ~0 y toda la venta se le
 * regalara a la Puerta Protex. Revertido hasta implementarlo bien.
 */
export function computePreciosVenta(
  ventanas: Ventana[],
  sumaTotalLineas: ProyectoVersion['sumaTotalLineas'] | undefined,
  ventaTotalCLP: number
): Map<string, PrecioVentaLinea> {
  const resultado = new Map<string, PrecioVentaLinea>();
  if (!ventanas.length || !(ventaTotalCLP > 0)) return resultado;

  const base = Number(sumaTotalLineas) || 0;
  const pesos = ventanas.map((v) => Math.max(0, Number(v.importeUnitario) || 0) * (v.unidades || 1));
  const pesoTotal = pesos.reduce((acc, p) => acc + p, 0);

  const usarImporteHetmo = base > 0 && pesoTotal > 0;
  const totalUnidades = ventanas.reduce((acc, v) => acc + (v.unidades || 1), 0);

  ventanas.forEach((v, index) => {
    const peso = usarImporteHetmo ? pesos[index] / pesoTotal : (v.unidades || 1) / totalUnidades;
    const precioVentaCLP = peso * ventaTotalCLP;
    const precioUnitarioCLP = precioVentaCLP / (v.unidades || 1);
    resultado.set(v.id, { precioUnitarioCLP, precioVentaCLP });
  });

  return resultado;
}
