import { useEffect, useState } from 'react';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { getAnalitica, getRequerimientoFase, simularAnalitica } from '../../../api/client';
import type { Analitica, FijacionBorrador } from '../../../types';

/**
 * Analitica de materiales de una version, calculada por mtw-api (motor unico:
 * cantidades, precios, totales por partida, costo y venta). El frontend no
 * repite la formula: solo la muestra.
 *
 * La key cuelga de ['proyectoDetail', proyectoId], asi que todo lo que ya
 * invalida el detalle del proyecto (ajustes, aprobaciones, fijacion, resync)
 * recalcula tambien la Analitica.
 *
 * tasas: las que se estan editando en pantalla (previsualizacion sin guardar);
 * sin ellas, mtw-api usa las guardadas en la version.
 */
export type TasasAnalitica = { dolar: number; euro: number; uf: number };

export const analiticaKey = (proyectoId: string, versionId: string | undefined, tasas?: Partial<TasasAnalitica>) => [
  'proyectoDetail',
  proyectoId,
  'analitica',
  versionId,
  tasas ?? null,
];

export function useAnalitica(proyectoId: string, versionId: string | undefined, tasas?: Partial<TasasAnalitica>) {
  return useQuery({
    queryKey: analiticaKey(proyectoId, versionId, tasas),
    queryFn: () => getAnalitica(versionId!, tasas),
    enabled: !!versionId,
    // Al cambiar una tasa se sigue mostrando el calculo anterior hasta que llega el nuevo.
    placeholderData: keepPreviousData,
  });
}

/**
 * Misma Analitica con una Hoja de Fijacion en borrador (sin guardar). Espera a
 * que el usuario deje de escribir (debounce) antes de pedir el calculo.
 */
export function useAnaliticaSimulada(
  proyectoId: string,
  versionId: string | undefined,
  tasas: TasasAnalitica,
  fijacion: FijacionBorrador | null,
  esperaMs = 500
) {
  const [borrador, setBorrador] = useState(fijacion);
  useEffect(() => {
    const t = setTimeout(() => setBorrador(fijacion), esperaMs);
    return () => clearTimeout(t);
  }, [fijacion, esperaMs]);

  return useQuery({
    queryKey: ['proyectoDetail', proyectoId, 'analitica-simulada', versionId, tasas, borrador],
    queryFn: () => simularAnalitica(versionId!, { tasas, fijacion: borrador! }),
    enabled: !!versionId && !!borrador,
    placeholderData: keepPreviousData,
  });
}

/** Decimales para mostrar una cantidad: enteras sin decimales, el resto con 2. */
export const decimalesCantidad = (cantidad: number) => (Number.isInteger(Math.round(cantidad * 1000) / 1000) ? 0 : 2);

/**
 * Materiales que faltan para fabricar una fase (cantidad prorrateada de la
 * Analitica, neta del stock de la obra y de Obras Mayores), agrupados por
 * proveedor. Lo calcula mtw-api (GET /fases/:id/requerimiento).
 */
export const requerimientoKey = (proyectoId: string, faseId: string | undefined, descontarStock = true) => [
  'proyectoDetail',
  proyectoId,
  'requerimiento',
  faseId,
  descontarStock,
];

export function useRequerimientoFase(proyectoId: string, faseId: string | undefined, descontarStock = true) {
  return useQuery({
    queryKey: requerimientoKey(proyectoId, faseId, descontarStock),
    queryFn: () => getRequerimientoFase(faseId!, descontarStock),
    enabled: !!faseId,
  });
}

export function useRequerimientosFases(proyectoId: string, faseIds: string[]) {
  return useQueries({
    queries: faseIds.map((faseId) => ({
      queryKey: requerimientoKey(proyectoId, faseId),
      queryFn: () => getRequerimientoFase(faseId),
    })),
  });
}

export type { Analitica };
