import { resolverMoneda, type MonedaHetmo } from '../../../lib/monedas';
import type { ProyectoVersion, MaterialVentana } from '../../../types';
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
      // de HETMO viene hardcodeado en '2' para todo material, nunca fue un
      // dato real (ver MONEDA_POR_FAMILIA).
      const precioOrigen = ajuste?.precioPersonalizado ?? mv.precioOrigen ?? 0;
      const monedaBase = MONEDA_POR_FAMILIA[familia] || 'CLP';
      const monedaOrigen = ajuste?.precioPersonalizado != null ? ajuste.monedaPersonalizada || monedaBase : monedaBase;

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
