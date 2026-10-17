import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Loader2, X } from 'lucide-react';
import { createUnidadMedida, getUnidadesMedida, updateUnidadMedida } from '../../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { Button } from '../../../components/ui/Button';
import type { UnidadMedida } from '../../../types';
import { CAMPO_CLASS, Cargando, ErrorCarga, Interruptor, Seccion, avisarError } from './comun';

type Edicion = { nombre: string; simbolo: string };

/**
 * Unidades de medida que usan los tipos de producto (consumo, precio y
 * compra). El código no se edita; una unidad en uso se desactiva.
 */
export const UnidadesSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { data: unidades = [], isLoading, isError, refetch } = useQuery({ queryKey: ['unidadesMedida'], queryFn: getUnidadesMedida });
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});
  const [nueva, setNueva] = useState<(Edicion & { codigo: string }) | null>(null);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['unidadesMedida'] });
    queryClient.invalidateQueries({ queryKey: ['tiposProducto'] });
  };

  const guardar = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Edicion & { activa: boolean }> }) => updateUnidadMedida(id, payload),
    onSuccess: (_d, { id }) => {
      invalidar();
      setEdiciones(({ [id]: _, ...resto }) => resto);
    },
    onError: avisarError,
  });

  const crear = useMutation({
    mutationFn: (n: Edicion & { codigo: string }) => createUnidadMedida({ codigo: n.codigo.trim(), nombre: n.nombre.trim(), simbolo: n.simbolo.trim() }),
    onSuccess: () => {
      invalidar();
      setNueva(null);
    },
    onError: avisarError,
  });

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="las unidades" onReintentar={refetch} />;

  const valor = (u: UnidadMedida) => ediciones[u.id] ?? { nombre: u.nombre, simbolo: u.simbolo };
  const cambiar = (u: UnidadMedida, campo: keyof Edicion, v: string) => setEdiciones((prev) => ({ ...prev, [u.id]: { ...valor(u), [campo]: v } }));
  const sucia = (u: UnidadMedida) => {
    const e = ediciones[u.id];
    return !!e && (e.nombre !== u.nombre || e.simbolo !== u.simbolo);
  };

  return (
    <Seccion
      titulo="Unidades de medida"
      descripcion="Las usan los tipos de producto para medir el consumo, expresar el precio y comprar (ej. metro, barra, m²)."
      accion={
        puedeEditar && !nueva ? (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNueva({ codigo: '', nombre: '', simbolo: '' })}>
            Nueva unidad
          </Button>
        ) : undefined
      }
    >
      <div className={TABLE_WRAPPER_CLASS}>
        <table className={`${TABLE_CLASS} text-left text-slate-700`}>
          <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
            <tr>
              <th className="py-3">Código</th>
              <th className="py-3">Nombre</th>
              <th className="py-3 w-28">Símbolo</th>
              <th className="py-3 text-center">Activa</th>
              {puedeEditar && <th className="py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nueva && (
              <tr className="bg-brand-50/40">
                <td className="py-2">
                  <input autoFocus placeholder="EJ: ROLLO" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value.toUpperCase() })} className={`${CAMPO_CLASS} font-mono`} />
                </td>
                <td className="py-2">
                  <input placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className={CAMPO_CLASS} />
                </td>
                <td className="py-2">
                  <input placeholder="Ej: rollo" value={nueva.simbolo} onChange={(e) => setNueva({ ...nueva, simbolo: e.target.value })} className={CAMPO_CLASS} />
                </td>
                <td className="py-2" />
                <td className="py-2 text-right whitespace-nowrap">
                  <Button size="sm" onClick={() => crear.mutate(nueva)} disabled={!nueva.codigo.trim() || !nueva.nombre.trim() || !nueva.simbolo.trim()} isLoading={crear.isPending}>
                    Crear
                  </Button>
                  <button onClick={() => setNueva(null)} className="ml-1 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Cancelar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )}
            {unidades.map((u) => {
              const v = valor(u);
              const guardando = guardar.isPending && guardar.variables?.id === u.id;
              return (
                <tr key={u.id} className={`hover:bg-slate-50/80 ${u.activa ? '' : 'opacity-60'}`}>
                  <td className="py-2 font-mono text-[10px] text-slate-500">{u.codigo}</td>
                  <td className="py-2">
                    {puedeEditar ? <input value={v.nombre} onChange={(e) => cambiar(u, 'nombre', e.target.value)} className={CAMPO_CLASS} /> : u.nombre}
                  </td>
                  <td className="py-2">
                    {puedeEditar ? <input value={v.simbolo} onChange={(e) => cambiar(u, 'simbolo', e.target.value)} className={CAMPO_CLASS} /> : u.simbolo}
                  </td>
                  <td className="py-2 text-center">
                    <Interruptor valor={u.activa} disabled={!puedeEditar} etiqueta={u.activa ? 'Desactivar' : 'Activar'} onChange={(activa) => guardar.mutate({ id: u.id, payload: { activa } })} />
                  </td>
                  {puedeEditar && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => guardar.mutate({ id: u.id, payload: { nombre: v.nombre.trim(), simbolo: v.simbolo.trim() } })}
                        disabled={!sucia(u) || guardando || !v.nombre.trim() || !v.simbolo.trim()}
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
          </tbody>
        </table>
      </div>
    </Seccion>
  );
};
