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
 * Una línea PERSONALIZADO (Vidrio DVH, Puerta Protex) nunca trae
 * importeUnitario -- ese campo solo lo calcula HETMO. Sin respaldo, su peso
 * quedaba en 0 y toda su parte de la venta se la regalaba a las demás
 * líneas. El respaldo es el costo real de sus materiales -- SOLO para
 * lineas PERSONALIZADO, nunca para lineas HETMO: se probo aplicarlo a
 * todas por igual, pero el costo de Perfileria/Refuerzos NO es atribuible
 * a una ventana individual (HETMO lo entrega como resumen a nivel de TODO
 * el proyecto, via barras optimizadas de corte, no por linea), y eso hacia
 * que una ventana HETMO real con perfileria quedara en peso ~0 -- una
 * linea PERSONALIZADO en cambio nunca trae Perfileria/Refuerzos en su
 * receta (solo Vidrios y Herrajes, ver /api/ventanas/manual), asi que el
 * respaldo es seguro unicamente para ese caso.
 *
 * Ese costo real, sin embargo, esta en una escala distinta a
 * importeUnitario: importeUnitario es un PRECIO DE VENTA (HETMO ya le
 * aplico margen), mientras que el costo de materiales de la linea manual
 * es COSTO puro, sin margen. Mezclarlos tal cual en el mismo prorrateo
 * hacia que el lado con el numero mas grande (cualquiera de los dos, segun
 * el caso) se quedara con ~100% de la venta y el otro con ~0%, en vez de
 * repartirse en proporciones razonables. Se corrige llevando el costo de
 * la linea manual a la MISMA escala de venta con el margen promedio real
 * de todo el proyecto (ventaTotalCLP / costoTotalProyectoCLP, ambos ya
 * calculados en Step5 via computeCostoTotalYVenta) antes de compararlo con
 * importeUnitario.
 *
 * importeUnitario en si tambien viene en una escala distinta a como se
 * maneja el resto de la plata en esta app: HETMO lo entrega en UF (no en
 * CLP como todos los demas montos internos), practica comun en cotizacion
 * de construccion en Chile para no perder valor con la inflacion --
 * confirmado con datos reales: una ventana con importeUnitario=5.13 vale
 * en la practica ~2.65 UF (calculado independientemente via costo real +
 * margen), mismo orden de magnitud que 5.13 UF, e imposible como CLP
 * crudo ($5.13). Sin la conversion, una ventana HETMO real quedaba
 * comparada en los pesos (millones) contra un puñado de unidades sueltas,
 * asi que su parte de la venta se redondeaba a 0 apenas convivia con
 * cualquier otra linea en pesos (ya fuera otra ventana HETMO con
 * importeUnitario mas alto, o el respaldo en CLP de una linea manual).
 */
export function computePreciosVenta(
  ventanas: Ventana[],
  sumaTotalLineas: ProyectoVersion['sumaTotalLineas'] | undefined,
  ventaTotalCLP: number,
  costoLineaManualCLP?: (v: Ventana) => number,
  costoTotalProyectoCLP?: number,
  tasaUf?: number
): Map<string, PrecioVentaLinea> {
  const resultado = new Map<string, PrecioVentaLinea>();
  if (!ventanas.length || !(ventaTotalCLP > 0)) return resultado;

  const base = Number(sumaTotalLineas) || 0;
  const factorUf = Number(tasaUf) > 0 ? Number(tasaUf) : 1;
  const margenMultiplicador = Number(costoTotalProyectoCLP) > 0 ? ventaTotalCLP / Number(costoTotalProyectoCLP) : 1;
  const pesos = ventanas.map((v) => {
    const importeHetmo = Math.max(0, Number(v.importeUnitario) || 0) * factorUf * (v.unidades || 1);
    if (importeHetmo > 0) return importeHetmo;
    if (v.origen === 'PERSONALIZADO' && costoLineaManualCLP) {
      return Math.max(0, costoLineaManualCLP(v)) * margenMultiplicador;
    }
    return 0;
  });
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
