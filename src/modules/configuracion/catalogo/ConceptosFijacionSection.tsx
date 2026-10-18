import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConceptosFijacion, getPartidas, updateConceptoFijacion } from '../../../api/client';
import { Seccion } from '../../../components/ui/Seccion';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { SelectCompacto } from '../../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { avisarError } from './comun';

/**
 * Partida a la que se carga por defecto cada concepto de la Hoja de Fijación
 * (mano de obra, flete, instalación...). Cada Hoja puede cambiarla; los extras
 * eligen la suya al agregarse. Sin partida: "Sin asignar".
 */
export const ConceptosFijacionSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const conceptosQuery = useQuery({ queryKey: ['conceptosFijacion'], queryFn: getConceptosFijacion });
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const sinAsignar = partidas.find((p) => p.porDefecto);

  const guardar = useMutation({
    mutationFn: ({ codigo, partidaPorDefectoId }: { codigo: string; partidaPorDefectoId: string | null }) =>
      updateConceptoFijacion(codigo, { partidaPorDefectoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conceptosFijacion'] });
      // Las Hojas sin partida propia para el concepto cambian de partida.
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail'] });
    },
    onError: avisarError,
  });

  if (conceptosQuery.isLoading) return <Cargando />;
  if (conceptosQuery.isError) return <ErrorCarga que="los conceptos de la Hoja de Fijación" onReintentar={conceptosQuery.refetch} />;

  return (
    <Seccion
      sinRelleno
      titulo="Hoja de Fijación"
      descripcion="Partida a la que se carga por defecto cada concepto de la Hoja de Fijación. Cada Hoja puede cambiarla, y los extras eligen la suya. Sin partida, el costo queda en “Sin asignar”."
    >
      <Tabla>
        <Thead>
          <Tr>
            <Th>Concepto</Th>
            <Th>Partida por defecto</Th>
          </Tr>
        </Thead>
        <Tbody>
            {(conceptosQuery.data ?? []).map((c) => {
              const valor = c.partidaPorDefectoId ?? '';
              return (
                <Tr key={c.codigo}>
                  <Td className="font-semibold text-slate-800">{c.nombre}</Td>
                  <Td>
                    {puedeEditar ? (
                      <SelectCompacto
                        aria-label={`Partida de ${c.nombre}`}
                        tono={valor ? undefined : 'advertencia'}
                        value={valor}
                        disabled={guardar.isPending && guardar.variables?.codigo === c.codigo}
                        onChange={(e) => guardar.mutate({ codigo: c.codigo, partidaPorDefectoId: e.target.value || null })}
                        className="w-full max-w-xs"
                      >
                        <option value="">{sinAsignar?.nombre ?? 'Sin asignar'}</option>
                        {partidas
                          .filter((p) => !p.porDefecto && (p.activa || p.id === valor))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                      </SelectCompacto>
                    ) : (
                      c.partidaPorDefecto?.nombre ?? sinAsignar?.nombre ?? 'Sin asignar'
                    )}
                  </Td>
                </Tr>
              );
            })}
        </Tbody>
      </Tabla>
    </Seccion>
  );
};
