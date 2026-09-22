import { resolverMoneda, type MonedaHetmo } from '../../../lib/monedas';
import type { ProyectoVersion, MaterialVentana, Ventana, Fase } from '../../../types';
import { toWindowLine } from '../components/drawing/ventanaAdapter';
import { cuadrosFor } from '../components/drawing/geometryCore';

export interface MaterialConsolidado {
  id: string;
  materialId: string;
  skuInterno: string;
  descripcion: string;
  familia: string;
  familiaCruda: string;
  unidadMedida: string;
  proveedorNombre: string;
  cantidadTotal: number;
  precioOrigen: number;
  monedaOrigen: string;
  precioCLP: number;
  excluido: boolean;
  // true cuando el precio viene de un ajuste manual en la Analitica
  // (ProyectoMaterialAjuste.precioPersonalizado), no del precio original de
  // HETMO -- para destacar visualmente que este item fue tocado a mano.
  precioModificado: boolean;
}

// moneda_origen_codigo de HETMO viene hardcodeado en '2' para TODO material
// (confirmado en el codigo fuente de apiv2 -- nunca fue un dato real), asi
// que no sirve para resolver la divisa. La divisa real depende de la
// familia del material (regla de negocio, no de HETMO): Perfileria,
// Accesorios y Juntas se compran en euros; Refuerzos y Herrajes en dolares;
// Vidrios se cotiza directo en pesos, sin conversion.
export const MONEDA_POR_FAMILIA: Record<string, 'EUR' | 'USD' | 'CLP'> = {
  PERFILERIA: 'USD',
  ACCESORIOS: 'USD',
  REFUERZOS: 'USD',
  HERRAJES: 'EUR',
  VIDRIOS: 'CLP',
};

// Juntas no es una categoria propia en la Analitica -- se compra y reporta
// junto con Accesorios (asi lo muestran tanto Hetmo como el dashboard
// antiguo). normalizarFamilia() funde ambas apenas se resuelve la familia
// de un material, asi que el resto del calculo (agrupacion, moneda,
// aprobacion por familia, descuento) nunca ve "JUNTAS" por separado.
export const normalizarFamilia = (familia: string) => (familia === 'JUNTAS' ? 'ACCESORIOS' : familia);

/**
 * Consolida todos los materiales de las ventanas de una version, con los
 * ajustes ya guardados (exclusion / familia personalizada) aplicados.
 *
 * Extraido de Step3Materiales.tsx para que Step4Fijaciones (Hoja de
 * Fijacion) reuse EXACTAMENTE la misma logica de cantidades/precios que la
 * Analitica de Materiales -- ya validada contra datos reales de Hetmo, no
 * se debe reimplementar por separado en cada pantalla que necesite estos
 * totales.
 */
export function computeMaterialesConsolidados(
  activeVersion: ProyectoVersion | undefined,
  tasaDolar: number,
  tasaEuro: number,
  tasaUf: number,
  monedas: MonedaHetmo[]
): MaterialConsolidado[] {
  const map = new Map<string, MaterialConsolidado>();
  const familiaCrudaPorMaterial = new Map<string, string>();
  const ventanas = activeVersion?.ventanas || [];
  const ajustesPorMaterial = new Map((activeVersion?.materialAjustes || []).map((a) => [a.materialId, a]));

  ventanas.forEach((v) => {
    const mats: MaterialVentana[] = v.materiales || [];

    mats.forEach((mv) => {
      const mat = mv.material;
      const key = mv.materialId || mv.id;
      const ajuste = ajustesPorMaterial.get(mv.materialId);
      const familiaCruda = (ajuste?.familiaPersonalizada || mat?.familia || 'ACCESORIOS').toUpperCase().trim();
      const familia = normalizarFamilia(familiaCruda);
      familiaCrudaPorMaterial.set(mv.materialId, familiaCruda);

      // Juntas se cobra por los metros REALMENTE cortados del rollo de
      // stock (confirmado contra el excel real: 93003 son 50,4m de un
      // rollo de 300m, no el rollo completo) -- mv.cantidad para Juntas
      // no es esos metros, es un conteo que no calza con el consumo real
      // de Hetmo. mv.longitudMm SI trae esos metros reales -- pero pese
      // al nombre del campo ("_mm") ya viene expresado directamente en
      // METROS, no en milimetros (mismo tipo de nombre enganoso que en
      // Vidrios, mas abajo): dividir por 1000 daba 0,05m en vez de los
      // 50,4m reales para 93003 (confirmado contra pantalla real de la
      // Analitica). precioOrigen sigue siendo por metro (no se escala, a
      // diferencia de Perfileria/Refuerzos mas abajo), asi que Total =
      // precio_metro * metros_reales, igual que Hetmo.
      //
      // mv.cantidad ya viene totalizado por Hetmo para todas las UDS de
      // esta linea (confirmado contra el resumen real de Hetmo: sumar
      // cantidad tal cual, sin multiplicar por nada, calza al digito con
      // el analisis de materiales que Hetmo le entrega al cliente).
      // Multiplicar de nuevo por v.unidades duplicaba la cantidad en toda
      // linea con UDS > 1. Ojo: pese al tipo `number` de MaterialVentana,
      // el campo Decimal de Prisma llega como string por el wire -- sin
      // Number() aca, el += de abajo concatena texto en vez de sumar.
      // Vidrios: mv.longitudMm (pese al nombre del campo) ya viene
      // expresado directamente en m² para esta familia -- confirmado
      // sumando las filas crudas de un vidrio real contra Hetmo: da
      // 73,04 m² para "5/12/5 INC" en Casa La Aurora, exacto al
      // centesimo contra el dashboard antiguo. mv.cantidad para vidrios
      // es un conteo de paños, no m², por eso no sirve aca.
      const cantidadTotal =
        familiaCruda === 'JUNTAS' || familiaCruda === 'VIDRIOS'
          ? Number(mv.longitudMm) || 0
          : Number(mv.cantidad) || 0;

      // precioPersonalizado/monedaPersonalizada pisan el precio original de
      // HETMO cuando alguien lo edito a mano en la Analitica. Sin edicion
      // manual, la divisa la determina la familia -- moneda_origen_codigo
      // de HETMO viene hardcodeado en '2' para todo material sincronizado
      // desde HETMO, nunca fue un dato real (ver MONEDA_POR_FAMILIA).
      //
      // Excepcion: una fila PERSONALIZADO (agregada a mano desde Step2Lineas
      // -- reemplazo de material, vidrio DVH fijo, puerta Protex...) SI
      // trae una divisa real en mv.monedaOrigen -- la eligio la persona en
      // el formulario, o se copio del precio vigente del material en el
      // Maestro (ver POST /materiales, /materiales/reemplazar y
      // /ventanas/manual en mtw-api). Ignorarla y adivinar por familia daba
      // resultados absurdos: un kit de herrajes cargado en pesos ($250.000)
      // se mostraba convertido como si fueran euros ($257.500.000).
      const precioOrigen = ajuste?.precioPersonalizado ?? mv.precioOrigen ?? 0;
      const monedaBase = MONEDA_POR_FAMILIA[familia] || 'CLP';
      // Vidrios SIEMPRE se cotiza en pesos, sin excepcion (regla de negocio
      // explicita) -- nunca confiar en mv.monedaOrigen para esta familia,
      // ni siquiera en una linea PERSONALIZADO. Confirmado en produccion:
      // una Puerta Protex copio el codigo crudo de moneda que HETMO tenia
      // guardado para ESE presupuesto puntual (un numero como "2"), que en
      // ese documento en particular resolvia a Dolar en el diccionario de
      // monedas -- multiplicando el precio real del vidrio por ~950 en la
      // Analitica pese a que el vidrio en si siempre esta en CLP.
      const monedaOrigen =
        familia === 'VIDRIOS'
          ? 'CLP'
          : ajuste?.precioPersonalizado != null
          ? ajuste.monedaPersonalizada || monedaBase
          : mv.origen === 'PERSONALIZADO' && mv.monedaOrigen
          ? mv.monedaOrigen
          : monedaBase;

      const iso = resolverMoneda(monedaOrigen, monedas).iso;
      let factorCLP = 1;
      if (iso === 'USD') factorCLP = tasaDolar;
      else if (iso === 'EUR') factorCLP = tasaEuro;
      else if (iso === 'UF') factorCLP = tasaUf;

      const precioCLP = precioOrigen * factorCLP;

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.cantidadTotal += cantidadTotal;
      } else {
        map.set(key, {
          id: mv.id,
          materialId: mv.materialId,
          skuInterno: mat?.skuInterno || `SKU-${key.slice(0, 6)}`,
          descripcion: mat?.descripcion || 'Material de fábrica HETMO',
          familia,
          familiaCruda,
          unidadMedida: mat?.unidadMedida || 'U',
          proveedorNombre: mat?.proveedor?.nombre || 'HETMO Almacén',
          cantidadTotal,
          precioOrigen,
          monedaOrigen,
          precioCLP,
          excluido: ajuste?.excluido ?? mv.excluido ?? false,
          precioModificado: ajuste?.precioPersonalizado != null,
        });
      }
    });
  });

  // Perfileria y Refuerzos se compran por barra de stock, no por pieza
  // usada: /materiales (el resumen de Hetmo) ya trae esa cantidad de
  // barras post-optimizacion de corte, confirmado contra el analisis de
  // materiales real de Casa La Aurora. El resto de las familias
  // (Accesorios, Herrajes, Vidrios) ya calzan sumando por ventana y no se
  // tocan.
  //
  // precioOrigen/precioCLP para estas dos familias viene por METRO (asi
  // lo entrega HETMO -- confirmado contra el excel real: 001mtw da
  // US$1,618 "por metro", no por barra). Cantidad ahora esta en barras de
  // 5,8m, asi que Total CLP = precioCLP * cantidad quedaba dividido por
  // ese largo si no se escala precioCLP a "por barra" aca mismo
  // (verificado: 001mtw daba $44.576 en vez de los $258.540 reales del
  // excel, exactamente el precio por metro sin multiplicar por los
  // 5,8m/barra; 41013 daba igual el mismo patron, calza exacto al
  // aplicar el factor).
  //
  // Juntas NO entra aca todavia pese a comprarse tambien por rollo de
  // stock (300m): a diferencia de Perfileria/Refuerzos, el excel muestra
  // que Hetmo cobra Juntas por los METROS REALMENTE CORTADOS (ej. 50,4m
  // de 300m de rollo), no por rollo completo -- aplicar el mismo factor
  // de largo de barra aca inflaria el precio ~6x. Falta confirmar de
  // donde sacar esos metros reales (candidato: MaterialVentana.longitudMm
  // sumado por ventana) antes de arreglar el precio de Juntas; la
  // cantidad de Juntas se dejo sumando por ventana como el resto de
  // Accesorios mientras tanto.
  const FAMILIAS_CANTIDAD_RESUMEN = new Set(['PERFILERIA', 'REFUERZOS']);
  const LARGO_BARRA_METROS: Record<string, number> = {
    PERFILERIA: 5.8,
    REFUERZOS: 5.8,
  };
  const resumenPorMaterial = new Map(
    (activeVersion?.materialesResumen || []).map((r) => [r.materialId, Number(r.cantidadHetmo) || 0])
  );
  const consolidados = Array.from(map.values());
  consolidados.forEach((m) => {
    const familiaCruda = familiaCrudaPorMaterial.get(m.materialId) || m.familia;
    if (!FAMILIAS_CANTIDAD_RESUMEN.has(familiaCruda)) return;
    const cantidadResumen = resumenPorMaterial.get(m.materialId);
    if (cantidadResumen === undefined) return;
    m.cantidadTotal = cantidadResumen;
    m.precioCLP *= LARGO_BARRA_METROS[familiaCruda];
  });

  return consolidados;
}

/**
 * Total CLP de un material con el descuento/recargo de su familia ya
 * aplicado (nunca sobre el precio individual, ver Step3Materiales).
 */
export function montoConAjuste(
  m: MaterialConsolidado,
  aprobacionesPorFamilia: Map<string, { descuentoPct: number | null; recargoPct: number | null } | undefined>
): number {
  const aprobacion = aprobacionesPorFamilia.get(m.familia);
  const descuento = Number(aprobacion?.descuentoPct) || 0;
  const recargo = Number(aprobacion?.recargoPct) || 0;
  return m.precioCLP * m.cantidadTotal * (1 - descuento / 100) * (1 + recargo / 100);
}

/**
 * Costo total NETO y valor de venta de la version, leidos de la config YA
 * GUARDADA (activeVersion.fijacionConfig) -- misma formula que
 * Step4Fijaciones.tsx, pero contra el estado persistido, no un draft en
 * edicion. Usado por el Presupuesto (Paso 5) para prorratear precios: no
 * debe reflejar una edicion sin guardar de otra pestaña.
 */
export function computeCostoTotalYVenta(
  activeVersion: ProyectoVersion | undefined,
  materialesConsolidados: MaterialConsolidado[],
  aprobacionesPorFamilia: Map<string, { descuentoPct: number | null; recargoPct: number | null } | undefined>
): { costoTotal: number; venta: number; margen: number } {
  const config = activeVersion?.fijacionConfig;
  const m2Ventanas = Number(activeVersion?.totalM2Ventanas) || 0;
  const m2Vidrios = materialesConsolidados
    .filter((m) => !m.excluido && m.familia === 'VIDRIOS')
    .reduce((acc, m) => acc + m.cantidadTotal, 0);
  // totalM2Ventanas SOLO lo actualiza el sync de HETMO -- una Puerta Protex
  // (linea manual, nunca toca ese campo) queda en $0 de instalacion si se
  // le aplica la misma formula. Se le da su propia tarifa (m2 real de las
  // lineas PROTEX de la version, por valorInstalacionProtexM2) en vez de
  // sumarla a m2Ventanas -- Vidrio DVH fijo queda afuera por ahora a
  // proposito (puede venir dentro del propio presupuesto de HETMO).
  const m2Protex = (activeVersion?.ventanas || [])
    .filter((v) => v.tipoLineaManual === 'PROTEX')
    .reduce((acc, v) => acc + (Number(v.m2Ventana) || 0), 0);

  const materialesTotal = materialesConsolidados
    .filter((m) => !m.excluido)
    .reduce((acc, m) => acc + montoConAjuste(m, aprobacionesPorFamilia), 0);

  const numero = (value: unknown, fallback: number) => (value === undefined || value === null ? fallback : Number(value) || 0);
  const manoObraFabricacion = numero(config?.manoObraFabricacion, 8000);
  const filmProtectorCristales = numero(config?.filmProtectorCristales, 1000);
  const materialInstalacion = numero(config?.materialInstalacion, 3100);
  const cantidadViajes = numero(config?.cantidadViajes, 0);
  const valorViaje = numero(config?.valorViaje, 80000);
  const valorInstalacionM2 = numero(config?.valorInstalacionM2, 1700);
  const valorInstalacionProtexM2 = numero(config?.valorInstalacionProtexM2, 25000);
  const margenVentaPct = numero(config?.margenVentaPct, 0);
  const extrasTotal = Array.isArray(config?.extras)
    ? config!.extras.reduce((acc, e) => acc + (Number(e.monto) || 0), 0)
    : 0;

  const costosComplementarios =
    manoObraFabricacion * m2Ventanas + filmProtectorCristales * m2Vidrios + materialInstalacion * m2Ventanas + extrasTotal;
  const costoFlete = cantidadViajes * valorViaje;
  const costoInstalacion = valorInstalacionM2 * m2Ventanas + valorInstalacionProtexM2 * m2Protex;
  const costoTotal = materialesTotal + costosComplementarios + costoFlete + costoInstalacion;
  const margen = Math.min(99, Math.max(0, margenVentaPct));
  const venta = margen < 100 ? costoTotal / (1 - margen / 100) : costoTotal;

  return { costoTotal, venta, margen };
}

/**
 * Costo real (CLP) de los materiales de UNA sola ventana/línea. Usado
 * SOLO como respaldo de peso de prorrateo para líneas PERSONALIZADO (ver
 * computePreciosVenta en presupuesto.ts) -- esas líneas nunca traen
 * Perfileria/Refuerzos en su receta (solo Vidrios y Herrajes), así que a
 * diferencia de una ventana HETMO real, sumar precio*cantidad por línea sí
 * da su costo correcto sin necesitar el resumen de barras a nivel de
 * proyecto. NO usar esta función para una ventana de origen HETMO.
 */
export function computeCostoVentanaCLP(
  ventana: Ventana,
  ajustesPorMaterial: Map<string, { precioPersonalizado?: number | null; monedaPersonalizada?: string | null; familiaPersonalizada?: string | null }>,
  tasaDolar: number,
  tasaEuro: number,
  tasaUf: number,
  monedas: MonedaHetmo[]
): number {
  const mats: MaterialVentana[] = ventana.materiales || [];
  return mats.reduce((acc, mv) => {
    const mat = mv.material;
    const ajuste = ajustesPorMaterial.get(mv.materialId);
    const familiaCruda = (ajuste?.familiaPersonalizada || mat?.familia || 'ACCESORIOS').toUpperCase().trim();
    const familia = normalizarFamilia(familiaCruda);
    const cantidad =
      familiaCruda === 'JUNTAS' || familiaCruda === 'VIDRIOS' ? Number(mv.longitudMm) || 0 : Number(mv.cantidad) || 0;
    const precioOrigen = ajuste?.precioPersonalizado ?? mv.precioOrigen ?? 0;
    const monedaBase = MONEDA_POR_FAMILIA[familia] || 'CLP';
    const monedaOrigen =
      familia === 'VIDRIOS'
        ? 'CLP'
        : ajuste?.precioPersonalizado != null
        ? ajuste.monedaPersonalizada || monedaBase
        : mv.origen === 'PERSONALIZADO' && mv.monedaOrigen
        ? mv.monedaOrigen
        : monedaBase;
    const iso = resolverMoneda(monedaOrigen, monedas).iso;
    let factorCLP = 1;
    if (iso === 'USD') factorCLP = tasaDolar;
    else if (iso === 'EUR') factorCLP = tasaEuro;
    else if (iso === 'UF') factorCLP = tasaUf;
    return acc + precioOrigen * factorCLP * cantidad;
  }, 0);
}

/**
 * Cantidad total de paños de vidrio (conteo de piezas, NO m²) de toda la
 * version. A diferencia de cantidadTotal en MaterialConsolidado -- que para
 * Vidrios usa mv.longitudMm (m² reales) -- este cuenta mv.cantidad, el
 * conteo de paños que Hetmo entrega para esa familia y que hoy no se usa en
 * ningun otro lado (ver comentario de computeMaterialesConsolidados).
 */
export function computeCantidadVidrios(activeVersion: ProyectoVersion | undefined): number {
  const ventanas = activeVersion?.ventanas || [];
  let total = 0;
  ventanas.forEach((v) => {
    (v.materiales || []).forEach((mv) => {
      const familia = (mv.material?.familia || '').toUpperCase().trim();
      if (familia === 'VIDRIOS') total += Number(mv.cantidad) || 0;
    });
  });
  return total;
}

/**
 * Cantidad total de cuadros (marcos de PVC soldados, ver cuadrosFor en
 * geometryCore.ts) de la version, multiplicado por las unidades fisicas de
 * cada linea. Misma formula que IndicadoresMetricos.tsx (Step1DatosCliente)
 * -- confirmada contra Casa La Aurora: una linea SOLO DVH sin marco real no
 * aporta cuadros, una hoja movil suma su propio marco soldado, y una linea
 * compuesta (paños pegados) suma un marco por cada paño propio.
 */
export function computeCantidadCuadros(activeVersion: ProyectoVersion | undefined): number {
  const ventanas = activeVersion?.ventanas || [];
  return ventanas.reduce((acc, v) => {
    const line = toWindowLine(v);
    const count = line ? cuadrosFor(line) : 0;
    return acc + count * (v.unidades || 1);
  }, 0);
}

export interface ItemFaseProveedor {
  materialId: string;
  descripcion: string;
  // Familia normalizada (PERFILERIA/HERRAJES/VIDRIOS/ACCESORIOS/REFUERZOS)
  // -- mismo dominio que CategoriaGasto, para poder resumir por categoria
  // en la pestaña Fases sin recalcular nada (ver FasesTab.tsx).
  familia: string;
  unidadMedida: string;
  cantidad: number;
  // Valor teorico antes de redondear a la unidad de compra -- solo se
  // completa para Perfileria/Refuerzos (se compran por barra entera).
  // Puramente informativo: no se usa en ningun otro calculo, ver
  // OrdenCompraItem.cantidadCalculada en mtw-api.
  cantidadCalculada: number | null;
  precioUnitario: number;
}

export interface GrupoFaseProveedor {
  proveedorId: string | null; // null = material sin proveedor asignado en el Maestro
  proveedorNombre: string;
  items: ItemFaseProveedor[];
}

const FAMILIAS_BARRA = new Set(['PERFILERIA', 'REFUERZOS']);

/**
 * Materiales necesarios para fabricar UNA fase (subconjunto de ventanas de
 * la version), agrupados por proveedor -- para armar una Orden de Compra
 * por proveedor desde Abastecimiento (ver NuevaOrdenCompraModal). Reusa
 * computeMaterialesConsolidados para que el precio unitario (conversion de
 * moneda, ajustes manuales, descuento/recargo por familia) y la cantidad
 * total de la version (barras para Perfileria/Refuerzos, m² reales para
 * Vidrios/Juntas) sean EXACTAMENTE los mismos que ve la Analítica de
 * Materiales -- no se reinventa un segundo calculo que podria desviarse
 * del oficial.
 *
 * La cantidad de cada material se prorratea por fase usando la MISMA base
 * que separa piezas de m² reales (longitudMm para Vidrios/Juntas, cantidad
 * para el resto): proporcion = base_de_la_fase / base_de_toda_la_version,
 * aplicada sobre cantidadTotal (que ya viene en la unidad de compra
 * correcta). Para Perfileria/Refuerzos esa cantidadTotal esta en BARRAS --
 * el numero real que HETMO optimizo para TODA la version, no algo que se
 * pueda recalcular por fase (la optimizacion de corte no es lineal:
 * sumar los metros de la fase y dividir por el largo de barra da un
 * numero MENOR y equivocado, ver conversacion en la tarea). Prorratear ese
 * total y redondear hacia arriba es una ESTIMACION deliberadamente
 * generosa (nunca deja corta a la fase), no una optimizacion de corte real
 * para ese subconjunto -- cantidadCalculada guarda el valor sin redondear
 * para poder auditar despues cuanto "de mas" se compro.
 */
export function computeMaterialesFasePorProveedor(
  activeVersion: ProyectoVersion | undefined,
  fase: Fase | undefined,
  tasaDolar: number,
  tasaEuro: number,
  tasaUf: number,
  monedas: MonedaHetmo[]
): GrupoFaseProveedor[] {
  if (!activeVersion || !fase) return [];

  const consolidados = computeMaterialesConsolidados(activeVersion, tasaDolar, tasaEuro, tasaUf, monedas);
  const consolidadoPorMaterial = new Map(consolidados.filter((m) => !m.excluido).map((m) => [m.materialId, m]));
  const aprobacionesPorFamilia = new Map((activeVersion.familiaAprobaciones || []).map((f) => [f.familia, f]));

  const baseDeVentana = (mv: MaterialVentana, familiaCruda: string) =>
    familiaCruda === 'JUNTAS' || familiaCruda === 'VIDRIOS' ? Number(mv.longitudMm) || 0 : Number(mv.cantidad) || 0;

  // Proveedor de cada material y base de cantidad (piezas o m² reales,
  // segun familia) sumada para TODA la version -- denominador para sacar
  // que proporcion de esa base cae en la fase elegida.
  const proveedorPorMaterial = new Map<string, { id: string | null; nombre: string }>();
  const baseVersionPorMaterial = new Map<string, number>();
  (activeVersion.ventanas || []).forEach((v) => {
    (v.materiales || []).forEach((mv) => {
      if (!mv.material) return;
      if (!proveedorPorMaterial.has(mv.materialId)) {
        proveedorPorMaterial.set(mv.materialId, {
          id: mv.material.proveedorId,
          nombre: mv.material.proveedor?.nombre || 'Sin proveedor asignado',
        });
      }
      const familiaCruda = consolidadoPorMaterial.get(mv.materialId)?.familiaCruda || (mv.material.familia || 'ACCESORIOS').toUpperCase().trim();
      baseVersionPorMaterial.set(mv.materialId, (baseVersionPorMaterial.get(mv.materialId) || 0) + baseDeVentana(mv, familiaCruda));
    });
  });

  // Misma base, pero solo para las ventanas/unidades asignadas a esta fase.
  const baseFasePorMaterial = new Map<string, number>();
  (fase.ventanasFase || []).forEach((vf) => {
    if (vf.unidades <= 0) return;
    const ventana = (activeVersion.ventanas || []).find((v) => v.id === vf.ventanaId);
    if (!ventana || !ventana.unidades) return;
    const factor = vf.unidades / ventana.unidades;
    (ventana.materiales || []).forEach((mv) => {
      if (!mv.material) return;
      const familiaCruda = consolidadoPorMaterial.get(mv.materialId)?.familiaCruda || (mv.material.familia || 'ACCESORIOS').toUpperCase().trim();
      baseFasePorMaterial.set(mv.materialId, (baseFasePorMaterial.get(mv.materialId) || 0) + baseDeVentana(mv, familiaCruda) * factor);
    });
  });

  const porProveedor = new Map<string, GrupoFaseProveedor>();
  baseFasePorMaterial.forEach((baseFase, materialId) => {
    if (baseFase <= 0) return;
    const consolidado = consolidadoPorMaterial.get(materialId);
    if (!consolidado) return; // excluido en la Analitica -- no se sugiere comprar
    const baseVersion = baseVersionPorMaterial.get(materialId) || 0;
    if (baseVersion <= 0) return;
    const proporcion = Math.min(1, baseFase / baseVersion);

    const cantidadTeorica = consolidado.cantidadTotal * proporcion;
    const esBarra = FAMILIAS_BARRA.has(consolidado.familiaCruda);
    const cantidad = esBarra ? Math.ceil(cantidadTeorica - 0.0001) : Math.round(cantidadTeorica * 100) / 100;

    const aprobacion = aprobacionesPorFamilia.get(consolidado.familia);
    const descuento = Number(aprobacion?.descuentoPct) || 0;
    const recargo = Number(aprobacion?.recargoPct) || 0;
    const precioUnitario = consolidado.precioCLP * (1 - descuento / 100) * (1 + recargo / 100);

    const proveedor = proveedorPorMaterial.get(materialId) || { id: null, nombre: 'Sin proveedor asignado' };
    const key = proveedor.id || '__sin_proveedor__';
    if (!porProveedor.has(key)) {
      porProveedor.set(key, { proveedorId: proveedor.id, proveedorNombre: proveedor.nombre, items: [] });
    }
    porProveedor.get(key)!.items.push({
      materialId,
      descripcion: `${consolidado.skuInterno} · ${consolidado.descripcion}`,
      familia: consolidado.familia,
      unidadMedida: esBarra ? 'BARRA' : consolidado.unidadMedida,
      cantidad,
      cantidadCalculada: esBarra && Math.abs(cantidad - cantidadTeorica) > 0.0001 ? Math.round(cantidadTeorica * 1000) / 1000 : null,
      precioUnitario: Math.round(precioUnitario),
    });
  });

  return [...porProveedor.values()].sort((a, b) => a.proveedorNombre.localeCompare(b.proveedorNombre));
}
