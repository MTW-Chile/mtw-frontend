import type { OrdenCompra } from '../../../types';

/**
 * Lógica de una "lista de recepción": marcar qué llegó de lo pedido, con
 * cuánto, y qué queda pendiente. La usan la recepción de una OC en bodega
 * (RecepcionOCPage) y el acuse de un despacho en obra (RecibirDespachoModal).
 */

/** Una línea por recibir: lo pedido, lo ya recibido y lo que falta. */
export interface FilaRecepcion {
  id: string;
  descripcion: string;
  /** Segunda línea (pieza a medida, ventana de destino, parte). */
  detalle?: string | null;
  unidad: string;
  pedido: number;
  yaRecibido: number;
  pendiente: number;
  /** Se cuenta de a uno (unidades individualizadas, piezas, ventanas). */
  enteros: boolean;
}

export interface EstadoFilaRecepcion {
  marcada: boolean;
  cantidad: number;
  danado: boolean;
  observacion: string;
}

export type EstadoRecepcion = Record<string, EstadoFilaRecepcion>;

const redondear = (n: number) => Math.round(n * 10000) / 10000;

export function filasDesdeOC(oc: Pick<OrdenCompra, 'items'>): FilaRecepcion[] {
  return oc.items.map((item) => {
    const pedido = Number(item.cantidad);
    const yaRecibido = (item.recepciones || []).reduce((s, r) => s + Number(r.cantidadRecibida), 0);
    const pieza = !!(item.anchoMm && item.altoMm);
    return {
      id: item.id,
      descripcion: item.descripcion,
      detalle: pieza ? `Pieza ${item.anchoMm} × ${item.altoMm} mm${item.referenciaVentana ? ` · ${item.referenciaVentana}` : ''}` : null,
      unidad: item.unidadMedida,
      pedido,
      yaRecibido: redondear(yaRecibido),
      pendiente: Math.max(0, redondear(pedido - yaRecibido)),
      enteros: !!item.material?.individualizado || pieza,
    };
  });
}

/** Al abrir: todo lo pendiente marcado con su cantidad completa ("llegó todo"). */
export function estadoInicialRecepcion(filas: FilaRecepcion[], marcarPendientes = true): EstadoRecepcion {
  return Object.fromEntries(
    filas.map((f) => [f.id, { marcada: marcarPendientes && f.pendiente > 0, cantidad: f.pendiente, danado: false, observacion: '' }])
  );
}

/** "Llegó todo" / "Nada": marca o desmarca todas las pendientes; al marcar, vuelve a la cantidad completa. */
export function marcarTodas(filas: FilaRecepcion[], estado: EstadoRecepcion, marcada: boolean): EstadoRecepcion {
  const nuevo: EstadoRecepcion = { ...estado };
  for (const f of filas) {
    const actual = estado[f.id] ?? { marcada: false, cantidad: f.pendiente, danado: false, observacion: '' };
    nuevo[f.id] = { ...actual, marcada: marcada && f.pendiente > 0, cantidad: marcada ? f.pendiente : actual.cantidad };
  }
  return nuevo;
}

export function acotarCantidad(fila: FilaRecepcion, valor: number): number {
  const v = fila.enteros ? Math.round(valor) : Math.round(valor * 100) / 100;
  return Math.min(fila.pendiente, Math.max(0, Number.isFinite(v) ? v : 0));
}

export interface ResumenRecepcion {
  /** Filas que todavía tienen algo por recibir. */
  pendientes: number;
  /** Filas marcadas con cantidad > 0 (las que se van a registrar). */
  marcadas: number;
  unidades: number;
  /** Filas que seguirán pendientes después de confirmar (no marcadas o parciales). */
  quedaranPendientes: number;
}

export function resumenRecepcion(filas: FilaRecepcion[], estado: EstadoRecepcion): ResumenRecepcion {
  let pendientes = 0;
  let marcadas = 0;
  let unidades = 0;
  let quedaranPendientes = 0;
  for (const f of filas) {
    if (f.pendiente <= 0) continue;
    pendientes += 1;
    const e = estado[f.id];
    const cantidad = e?.marcada ? acotarCantidad(f, e.cantidad) : 0;
    if (cantidad > 0) {
      marcadas += 1;
      unidades += cantidad;
    }
    if (cantidad < f.pendiente - 0.0001) quedaranPendientes += 1;
  }
  return { pendientes, marcadas, unidades: redondear(unidades), quedaranPendientes };
}

export const OBSERVACION_DANADO = 'Llegó dañado / incompleto';

/** Lo que se manda a la API: solo lo marcado con cantidad, con su observación si la hubo. */
export function itemsRecepcion(filas: FilaRecepcion[], estado: EstadoRecepcion): { id: string; cantidad: number; observacion: string | null }[] {
  return filas
    .filter((f) => f.pendiente > 0 && estado[f.id]?.marcada)
    .map((f) => {
      const e = estado[f.id];
      // Marcado como dañado sin texto: igual queda constancia.
      return { id: f.id, cantidad: acotarCantidad(f, e.cantidad), observacion: e.danado ? e.observacion.trim() || OBSERVACION_DANADO : null };
    })
    .filter((i) => i.cantidad > 0);
}
