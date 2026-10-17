import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Loader2, X } from 'lucide-react';
import { createTipoProyecto, getTiposProyecto, updateTipoProyecto } from '../../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { TipoProyecto } from '../../../types';
import { CAMPO_CLASS, Cargando, ErrorCarga, Interruptor, Seccion, avisarError } from '../catalogo/comun';

/**
 * Tipos de proyecto (Retail, Obra, ...): definen la plantilla de textos por
 * defecto y diferencian reglas comerciales. Uno es el por defecto (lo recibe
 * todo proyecto nuevo de HETMO); no se borran, se desactivan.
 */
export const TiposProyectoSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { data: tipos = [], isLoading, isError, refetch } = useQuery({ queryKey: ['tiposProyecto'], queryFn: getTiposProyecto });
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [nuevo, setNuevo] = useState<{ codigo: string; nombre: string } | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['tiposProyecto'] });
  const guardar = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTipoProyecto>[1] }) => updateTipoProyecto(id, payload),
    onSuccess: (_d, { id }) => {
      invalidar();
      setNombres(({ [id]: _, ...resto }) => resto);
    },
    onError: avisarError,
  });
  const crear = useMutation({
    mutationFn: (n: { codigo: string; nombre: string }) => createTipoProyecto({ codigo: n.codigo.trim(), nombre: n.nombre.trim(), orden: tipos.length + 1 }),
    onSuccess: () => {
      invalidar();
      setNuevo(null);
    },
    onError: avisarError,
  });

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="los tipos de proyecto" onReintentar={refetch} />;

  const nombreDe = (t: TipoProyecto) => nombres[t.id] ?? t.nombre;

  return (
    <Seccion
      titulo="Tipos de proyecto"
      descripcion="Cada proyecto tiene un tipo; define sus plantillas de textos por defecto. El tipo por defecto lo recibe todo proyecto nuevo de HETMO."
      accion={
        puedeEditar && !nuevo ? (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNuevo({ codigo: '', nombre: '' })}>
            Nuevo tipo
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
              <th className="py-3 text-right">Proyectos</th>
              <th className="py-3 text-center">Por defecto</th>
              <th className="py-3 text-center">Activo</th>
              {puedeEditar && <th className="py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nuevo && (
              <tr className="bg-brand-50/40">
                <td className="py-2">
                  <input autoFocus placeholder="EJ: INMOBILIARIA" value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} className={`${CAMPO_CLASS} font-mono`} />
                </td>
                <td className="py-2">
                  <input placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={CAMPO_CLASS} />
                </td>
                <td colSpan={3} />
                <td className="py-2 text-right whitespace-nowrap">
                  <Button size="sm" onClick={() => crear.mutate(nuevo)} disabled={!nuevo.codigo.trim() || !nuevo.nombre.trim()} isLoading={crear.isPending}>
                    Crear
                  </Button>
                  <button onClick={() => setNuevo(null)} className="ml-1 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Cancelar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )}
            {tipos.map((t) => {
              const guardando = guardar.isPending && guardar.variables?.id === t.id;
              return (
                <tr key={t.id} className={`hover:bg-slate-50/80 ${t.activo ? '' : 'opacity-60'}`}>
                  <td className="py-2 font-mono text-[10px] text-slate-500">{t.codigo}</td>
                  <td className="py-2">
                    {puedeEditar ? (
                      <input value={nombreDe(t)} onChange={(e) => setNombres((p) => ({ ...p, [t.id]: e.target.value }))} className={CAMPO_CLASS} />
                    ) : (
                      t.nombre
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{t._count?.proyectos ?? 0}</td>
                  <td className="py-2 text-center">
                    {t.porDefecto ? (
                      <Badge size="sm" variant="brand">Por defecto</Badge>
                    ) : puedeEditar && t.activo ? (
                      <button onClick={() => guardar.mutate({ id: t.id, payload: { porDefecto: true } })} className="text-[11px] font-semibold text-brand-600 hover:underline cursor-pointer">
                        Marcar
                      </button>
                    ) : null}
                  </td>
                  <td className="py-2 text-center">
                    <Interruptor
                      valor={t.activo}
                      disabled={!puedeEditar || t.porDefecto}
                      etiqueta={t.porDefecto ? 'El tipo por defecto no se puede desactivar' : t.activo ? 'Desactivar' : 'Activar'}
                      onChange={(activo) => guardar.mutate({ id: t.id, payload: { activo } })}
                    />
                  </td>
                  {puedeEditar && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() => guardar.mutate({ id: t.id, payload: { nombre: nombreDe(t).trim() } })}
                        disabled={nombreDe(t) === t.nombre || !nombreDe(t).trim() || guardando}
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
