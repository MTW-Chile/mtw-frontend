import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { getFamiliasHetmo, getTiposProducto, updateFamiliaHetmo } from '../../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { mostrarToast } from '../../../lib/toast';
import type { FamiliaHetmo } from '../../../types';
import { CAMPO_CLASS, Cargando, ErrorCarga, Seccion, avisarError } from './comun';

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
      titulo="Familias de HETMO"
      descripcion="Tipo de producto que recibe cada material nuevo que llega de HETMO, según su familia. Los materiales existentes conservan su tipo salvo que marques aplicarlo."
    >
      <div className={TABLE_WRAPPER_CLASS}>
        <table className={`${TABLE_CLASS} text-left text-slate-700`}>
          <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
            <tr>
              <th className="py-3">Familia HETMO</th>
              <th className="py-3 text-right">Materiales</th>
              <th className="py-3">Tipo de producto</th>
              {puedeEditar && <th className="py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {familias.map((f) => {
              const v = valor(f);
              const cambia = v.tipoProductoId !== f.tipoProductoId;
              const guardando = guardar.isPending && guardar.variables?.codigo === f.codigo;
              return (
                <tr key={f.codigo} className="hover:bg-slate-50/80 align-top">
                  <td className="py-2.5 font-mono text-[11px] font-semibold text-slate-800">{f.codigo}</td>
                  <td className="py-2.5 text-right tabular-nums">{f.materiales}</td>
                  <td className="py-2.5">
                    {puedeEditar ? (
                      <div className="space-y-1.5 max-w-sm">
                        <select
                          value={v.tipoProductoId}
                          onChange={(e) => setEdiciones((prev) => ({ ...prev, [f.codigo]: { ...v, tipoProductoId: e.target.value } }))}
                          className={CAMPO_CLASS}
                        >
                          {tipos
                            .filter((t) => t.activo || t.id === f.tipoProductoId)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.nombre} · {t.partida.nombre}
                              </option>
                            ))}
                        </select>
                        {cambia && f.materiales > 0 && (
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-brand-600"
                              checked={v.aplicarAExistentes}
                              onChange={(e) => setEdiciones((prev) => ({ ...prev, [f.codigo]: { ...v, aplicarAExistentes: e.target.checked } }))}
                            />
                            Cambiar también los materiales existentes que siguen en “{f.tipoProducto.nombre}”
                          </label>
                        )}
                      </div>
                    ) : (
                      f.tipoProducto.nombre
                    )}
                  </td>
                  {puedeEditar && (
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => guardar.mutate({ codigo: f.codigo, edicion: v })}
                        disabled={!cambia || guardando}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      >
                        {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {familias.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  Todavía no llegan familias desde HETMO.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Seccion>
  );
};
