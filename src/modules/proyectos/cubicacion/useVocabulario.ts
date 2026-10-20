import { useQuery } from '@tanstack/react-query';
import { getCubicacion } from '../../../api/client';
import { vocabulario, type Vocabulario } from './vocabulario';

/** Las palabras del cubicador de una obra (edificio o casa), leídas de su configuración. */
export function useVocabulario(proyectoId: string): Vocabulario {
  const { data } = useQuery({ queryKey: ['cubicacion', proyectoId], queryFn: () => getCubicacion(proyectoId) });
  return vocabulario(data?.cubicacion.modo);
}
