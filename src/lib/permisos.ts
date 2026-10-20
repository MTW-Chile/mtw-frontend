import { useQuery } from '@tanstack/react-query';
import { getMisPermisos } from '../api/client';
import type { MisPermisos, Permiso } from '../types';

/**
 * Permisos del usuario actual. La decision real la toma siempre el backend
 * (cada ruta exige su permiso); aca solo se usa para mostrar u ocultar.
 *
 * Uso: const { tiene } = usePermisos(); if (tiene('compras.oc.emitir')) ...
 *
 * Las claves son las del catalogo de mtw-api (src/seguridad/permisos.ts).
 */
export function usePermisos(): {
  datos: MisPermisos | undefined;
  cargando: boolean;
  tiene: (permiso: Permiso) => boolean;
  tieneAlguno: (...permisos: Permiso[]) => boolean;
} {
  const { data, isLoading } = useQuery({ queryKey: ['misPermisos'], queryFn: getMisPermisos, staleTime: 60_000 });
  const conjunto = new Set(data?.permisos ?? []);
  return {
    datos: data,
    cargando: isLoading,
    tiene: (permiso) => conjunto.has(permiso),
    tieneAlguno: (...permisos) => permisos.some((p) => conjunto.has(p)),
  };
}
