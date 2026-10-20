import { useQuery } from '@tanstack/react-query';
import { getConfiguracionGeneral } from '../api/client';
import type { ParametrosGenerales } from '../types';

/**
 * Parametros comerciales (Configuracion > Comercial): IVA, tasas de respaldo,
 * Hoja de Fijacion por defecto... Los define mtw-api; ninguna pantalla los
 * escribe en el codigo. Mientras cargan se usa null: quien muestra montos
 * espera a tenerlos.
 */
export function useParametrosGenerales(): ParametrosGenerales | null {
  const { data } = useQuery({ queryKey: ['configuracionGeneral'], queryFn: getConfiguracionGeneral, staleTime: 5 * 60_000 });
  return data ?? null;
}
