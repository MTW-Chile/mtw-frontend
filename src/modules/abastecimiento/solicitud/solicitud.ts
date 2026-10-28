import type { ItemOrdenCompraPayload } from '../../../api/client';
import type { RequerimientoFase } from '../../../types';

/**
 * Lógica de la solicitud de materiales desde la obra: qué necesita la fase,
 * cuánto hay en la bodega de la obra y en Obras Mayores, y cuánto se pide.
 * Sin proveedor ni precio: eso lo pone Compras al completarla.
 */

export interface FilaSolicitud {
  clave: string;
  materialId?: string;
  descripcion: string;
  partida?: string;
  unidad: string;
  /** Necesidad bruta de la fase (0 para lo agregado a mano). */
  necesario: number;
  obra: number;
  obrasMayores: number;
  /** Pieza a medida (vidrios): una fila por ventana; no se contrasta contra stock. */
  pieza: { anchoMm: number; altoMm: number; ventanaId: string | null; referenciaVentana: string | null } | null;
  sinMedidas: boolean;
  precioReferencial: number | null;
  cantidadCalculada: number | null;
  origen: 'fase' | 'catalogo' | 'texto' | 'pendiente';
  /** Solo ítems de texto libre (sin material): partida elegida a mano. */
  partidaId?: string;
}

export interface EstadoFilaSolicitud {
  marcada: boolean;
  cantidad: number;
}
export type EstadoSolicitud = Record<string, EstadoFilaSolicitud>;

export type CategoriaSolicitud = 'todos' | 'faltan' | 'con-stock';

const r2 = (n: number) => Math.round(n * 100) / 100;

export function filasDesdeRequerimiento(
  requerimiento: RequerimientoFase | undefined,
  stockObra: Map<string, number>,
  stockObrasMayores: Map<string, number>,
  partidaFiltro?: string
): FilaSolicitud[] {
  if (!requerimiento) return [];
  const filas: FilaSolicitud[] = [];
  for (const grupo of requerimiento.grupos) {
    for (const it of grupo.items) {
      if (partidaFiltro && it.partida.codigo !== partidaFiltro) continue;
      const pieza = it.anchoMm && it.altoMm ? { anchoMm: it.anchoMm, altoMm: it.altoMm, ventanaId: it.ventanaId, referenciaVentana: it.referenciaVentana } : null;
      filas.push({
        clave: pieza ? `${it.materialId}:${it.ventanaId ?? it.referenciaVentana ?? filas.length}` : it.materialId,
        materialId: it.materialId,
        descripcion: it.descripcion,
        partida: it.partida.nombre,
        unidad: it.unidad,
        necesario: it.cantidad,
        obra: pieza || it.sinMedidas ? 0 : Math.max(0, stockObra.get(it.materialId) ?? 0),
        obrasMayores: pieza || it.sinMedidas ? 0 : Math.max(0, stockObrasMayores.get(it.materialId) ?? 0),
        pieza,
        sinMedidas: it.sinMedidas,
        precioReferencial: it.precioUnitario || null,
        cantidadCalculada: it.cantidadCalculada,
        origen: 'fase',
      });
    }
  }
  return filas;
}

/** Cuánto falta después del stock: lo que se precarga en "A pedir". */
export function faltante(f: FilaSolicitud): number {
  if (f.pieza) return f.necesario;
  return Math.max(0, r2(f.necesario - f.obra - f.obrasMayores));
}

export function categoriaDe(f: FilaSolicitud): Exclude<CategoriaSolicitud, 'todos'> {
  return f.necesario > 0 && faltante(f) <= 0 ? 'con-stock' : 'faltan';
}

export function filtrarFilas(filas: FilaSolicitud[], categoria: CategoriaSolicitud): FilaSolicitud[] {
  return categoria === 'todos' ? filas : filas.filter((f) => categoriaDe(f) === categoria);
}

export function conteoCategorias(filas: FilaSolicitud[]): Record<CategoriaSolicitud, number> {
  const c = { todos: filas.length, faltan: 0, 'con-stock': 0 };
  for (const f of filas) c[categoriaDe(f)] += 1;
  return c;
}

/** Al abrir: marcado lo que falta, con la cantidad faltante; lo cubierto queda sin marcar con su necesidad completa. */
export function estadoInicialSolicitud(filas: FilaSolicitud[]): EstadoSolicitud {
  return Object.fromEntries(
    filas.map((f) => {
      const falta = faltante(f);
      return [f.clave, { marcada: f.origen !== 'fase' || falta > 0, cantidad: falta > 0 ? falta : f.necesario || 1 }];
    })
  );
}

export interface ResumenSolicitud {
  items: number;
  unidades: number;
  totalReferencial: number;
}

export function resumenSolicitud(filas: FilaSolicitud[], estado: EstadoSolicitud): ResumenSolicitud {
  let items = 0;
  let unidades = 0;
  let totalReferencial = 0;
  for (const f of filas) {
    const e = estado[f.clave];
    if (!e?.marcada || !(e.cantidad > 0)) continue;
    items += 1;
    unidades += e.cantidad;
    totalReferencial += e.cantidad * (f.precioReferencial ?? 0);
  }
  return { items, unidades: r2(unidades), totalReferencial: Math.round(totalReferencial) };
}

export function itemsSolicitud(filas: FilaSolicitud[], estado: EstadoSolicitud): ItemOrdenCompraPayload[] {
  return filas
    .filter((f) => estado[f.clave]?.marcada && estado[f.clave].cantidad > 0 && f.descripcion.trim())
    .map((f) => ({
      materialId: f.materialId,
      descripcion: f.descripcion.trim(),
      unidadMedida: f.unidad || 'UN',
      cantidad: estado[f.clave].cantidad,
      cantidadCalculada: f.cantidadCalculada ?? undefined,
      precioUnitario: f.precioReferencial ?? undefined,
      partidaId: f.materialId ? undefined : f.partidaId,
      ...(f.pieza ? { anchoMm: f.pieza.anchoMm, altoMm: f.pieza.altoMm, ventanaId: f.pieza.ventanaId, referenciaVentana: f.pieza.referenciaVentana } : {}),
    }));
}

/** Qué impide enviar, o null si está lista. */
export function validarSolicitud(filas: FilaSolicitud[], estado: EstadoSolicitud, opciones: { adicional: boolean; adicionalId: string }): string | null {
  const items = itemsSolicitud(filas, estado);
  if (items.length === 0) return 'Marca al menos un material con la cantidad a pedir.';
  if (opciones.adicional && !opciones.adicionalId) return 'Elige el adicional que cubre esta compra.';
  const sinPartida = filas.find((f) => estado[f.clave]?.marcada && estado[f.clave].cantidad > 0 && !f.materialId && !f.partidaId);
  if (sinPartida) return `"${sinPartida.descripcion || 'El ítem de texto libre'}" necesita una partida para el Control de Presupuesto.`;
  return null;
}
