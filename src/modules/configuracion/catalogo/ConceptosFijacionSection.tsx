import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConceptosFijacion, getPartidas, updateConceptoFijacion } from '../../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { CAMPO_CLASS, Cargando, ErrorCarga, Seccion, avisarError } from './comun';

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
      titulo="Hoja de Fijación"
      descripcion="Partida a la que se carga por defecto cada concepto de la Hoja de Fijación. Cada Hoja puede cambiarla, y los extras eligen la suya. Sin partida, el costo queda en “Sin asignar”."
    >
      <div className={TABLE_WRAPPER_CLASS}>
        <table className={`${TABLE_CLASS} text-left text-slate-700`}>
          <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
            <tr>
              <th className="py-3">Concepto</th>
              <th className="py-3">Partida por defecto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(conceptosQuery.data ?? []).map((c) => {
              const valor = c.partidaPorDefectoId ?? '';
              return (
                <tr key={c.codigo} className="hover:bg-slate-50/80">
                  <td className="py-2.5 font-semibold text-slate-800">{c.nombre}</td>
                  <td className="py-2.5">
                    {puedeEditar ? (
                      <select
                        value={valor}
                        disabled={guardar.isPending && guardar.variables?.codigo === c.codigo}
                        onChange={(e) => guardar.mutate({ codigo: c.codigo, partidaPorDefectoId: e.target.value || null })}
                        className={`${CAMPO_CLASS} max-w-xs ${valor ? '' : 'border-amber-300 bg-amber-50 text-amber-800'}`}
                      >
                        <option value="">{sinAsignar?.nombre ?? 'Sin asignar'}</option>
                        {partidas
                          .filter((p) => !p.porDefecto && (p.activa || p.id === valor))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                      </select>
                    ) : (
                      c.partidaPorDefecto?.nombre ?? sinAsignar?.nombre ?? 'Sin asignar'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Seccion>
  );
};
