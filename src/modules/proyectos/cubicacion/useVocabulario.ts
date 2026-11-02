import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCubicacion } from '../../../api/client';
import type { Proyecto } from '../../../types';
import { vocabulario, type Vocabulario } from './vocabulario';

/** Las palabras del cubicador de una obra (edificio o casa), leídas de su configuración. */
export function useVocabulario(proyectoId: string): Vocabulario {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['cubicacion', proyectoId], queryFn: () => getCubicacion(proyectoId) });
  // La obra ya está cargada por la pantalla de la obra: su nombre da nombre a la torre única.
  const obra = queryClient.getQueryData<Proyecto>(['proyectoDetail', proyectoId])?.obra;
  return vocabulario(data?.cubicacion.modo, obra);
}
