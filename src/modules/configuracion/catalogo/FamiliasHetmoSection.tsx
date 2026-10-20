import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { getFamiliasHetmo, getTiposProducto, updateFamiliaHetmo } from '../../../api/client';
import { mostrarToast } from '../../../lib/toast';
import type { FamiliaHetmo } from '../../../types';
import { Seccion } from '../../../components/ui/Seccion';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { Casilla, SelectCompacto } from '../../../components/ui/Campos';
import { avisarError } from './comun';
import { FilaVacia, Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';

type Edicion = { tipoProductoId: string; aplicarAExistentes: boolean };

/**
 * Qué tipo de producto recibe cada material nuevo que llega de HETMO, según
 * su familia. Cambiar el mapeo afecta a los materiales que se creen después;
 * los existentes conservan su tipo salvo que se aplique explícitamente.
 */
export const FamiliasHetmoSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const familiasQuery = useQuery({ queryKey: ['familiasHetmo'], queryFn: getFamiliasHetmo });
  const { data: tipos = [] } = useQuery({ queryKey: ['tiposProducto'], queryFn: getTiposProducto });
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});

  const guardar = useMutation({
    mutationFn: ({ codigo, edicion }: { codigo: string; edicion: Edicion }) => updateFamiliaHetmo(codigo, edicion),
    onSuccess: (resultado, { codigo }) => {
      queryClient.invalidateQueries({ queryKey: ['familiasHetmo'] });
      queryClient.invalidateQueries({ queryKey: ['tiposProducto'] });
      if (resultado.materialesActualizados > 0) {
        queryClient.invalidateQueries({ queryKey: ['proyectoDetail'] });
        mostrarToast(`${resultado.materialesActualizados} materiales de ${codigo} cambiaron de tipo.`, { tipo: 'info' });
      }
      setEdiciones(({ [codigo]: _, ...resto }) => resto);
    },
    onError: avisarError,
  });

  if (familiasQuery.isLoading) return <Cargando />;
  if (familiasQuery.isError) return <ErrorCarga que="las familias de HETMO" onReintentar={familiasQuery.refetch} />;
  const familias = familiasQuery.data ?? [];

  const valor = (f: FamiliaHetmo) => ediciones[f.codigo] ?? { tipoProductoId: f.tipoProductoId, aplicarAExistentes: false };

  return (
    <Seccion
      sinRelleno
      titulo="Familias de HETMO"
      descripcion="Tipo de producto que recibe cada material nuevo que llega de HETMO, según su familia. Los materiales existentes conservan su tipo salvo que marques aplicarlo."
    >
      <Tabla>
        <Thead>
          <Tr>
            <Th>Familia HETMO</Th>
            <Th alinear="derecha">Materiales</Th>
            <Th>Tipo de producto</Th>
            {puedeEditar && <Th alinear="derecha">Acciones</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {familias.map((f) => {
            const v = valor(f);
            const cambia = v.tipoProductoId !== f.tipoProductoId;
            const guardando = guardar.isPending && guardar.variables?.codigo === f.codigo;
            return (
              <Tr key={f.codigo} className="align-top">
                <Td className="font-mono text-[11px] font-semibold text-slate-800">{f.codigo}</Td>
                <Td numero>{f.materiales}</Td>
                <Td>
                  {puedeEditar ? (
                    <div className="space-y-1.5 max-w-sm">
                      <SelectCompacto
                        aria-label={`Tipo de producto de ${f.codigo}`}
                        value={v.tipoProductoId}
                        onChange={(e) => setEdiciones((prev) => ({ ...prev, [f.codigo]: { ...v, tipoProductoId: e.target.value } }))}
                        className="w-full"
                      >
                        {tipos
                          .filter((t) => t.activo || t.id === f.tipoProductoId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nombre} · {t.partida.nombre}
                            </option>
                          ))}
                      </SelectCompacto>
                      {cambia && f.materiales > 0 && (
                        <Casilla
                          checked={v.aplicarAExistentes}
                          onChange={(aplicarAExistentes) => setEdiciones((prev) => ({ ...prev, [f.codigo]: { ...v, aplicarAExistentes } }))}
                          label={<>Cambiar también los materiales existentes que siguen en “{f.tipoProducto.nombre}”</>}
                        />
                      )}
                    </div>
                  ) : (
                    f.tipoProducto.nombre
                  )}
                </Td>
                {puedeEditar && (
                  <Td alinear="derecha">
                    <Button
                     size="sm"
                     variant="ghost"
                     leftIcon={<Save className="w-3.5 h-3.5" />}
                     isLoading={guardando}
                     onClick={() => guardar.mutate({ codigo: f.codigo, edicion: v })}
                     disabled={!cambia}
                   >
                     Guardar
                   </Button>
                  </Td>
                )}
              </Tr>
            );
          })}
          {familias.length === 0 && <FilaVacia columnas={puedeEditar ? 4 : 3}>Todavía no llegan familias desde HETMO.</FilaVacia>}
        </Tbody>
        </Tabla>
    </Seccion>
  );
};
