import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Loader2, X } from 'lucide-react';
import { createPartida, getPartidas, updatePartida, type PartidaPayload } from '../../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { Partida } from '../../../types';
import { CAMPO_CLASS, Cargando, ErrorCarga, Interruptor, Seccion, avisarError } from './comun';

type Edicion = { nombre: string; integracionClay: string; orden: string };

const edicionDe = (p: Partida): Edicion => ({ nombre: p.nombre, integracionClay: p.integracionClay || '', orden: String(p.orden) });

/**
 * Partidas de gasto: agrupan la Analítica de Materiales, la aprobación técnica,
 * las OC y el Control de Presupuesto. Cada tipo de producto pertenece a una.
 * El código no se edita (lo usan integraciones y reportes); una partida en uso
 * no se borra, se desactiva.
 */
export const PartidasSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { data: partidas = [], isLoading, isError, refetch } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});
  const [nueva, setNueva] = useState<(Edicion & { codigo: string }) | null>(null);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['partidas'] });

  const guardar = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PartidaPayload> }) => updatePartida(id, payload),
    onSuccess: (_d, { id }) => {
      invalidar();
      setEdiciones(({ [id]: _, ...resto }) => resto);
    },
    onError: avisarError,
  });

  const crear = useMutation({
    mutationFn: (n: Edicion & { codigo: string }) =>
      createPartida({
        codigo: n.codigo.trim(),
        nombre: n.nombre.trim(),
        integracionClay: n.integracionClay.trim() || null,
        orden: Number(n.orden) || 0,
      }),
    onSuccess: () => {
      invalidar();
      setNueva(null);
    },
    onError: avisarError,
  });

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="las partidas" onReintentar={refetch} />;

  const valor = (p: Partida) => ediciones[p.id] ?? edicionDe(p);
  const cambiar = (p: Partida, campo: keyof Edicion, v: string) => setEdiciones((prev) => ({ ...prev, [p.id]: { ...valor(p), [campo]: v } }));
  const sucia = (p: Partida) => {
    const e = ediciones[p.id];
    return !!e && JSON.stringify(e) !== JSON.stringify(edicionDe(p));
  };

  return (
    <Seccion
      titulo="Partidas"
      descripcion="Agrupan la Analítica, la Hoja de Fijación, las OC y el Control de Presupuesto. El orden es el de la Analítica; el código Clay es la cuenta contable de la integración."
      accion={
        puedeEditar && !nueva ? (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNueva({ codigo: '', nombre: '', integracionClay: '', orden: String(partidas.length * 10) })}>
            Nueva partida
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
              <th className="py-3">Código Clay</th>
              <th className="py-3 w-20">Orden</th>
              <th className="py-3">Uso</th>
              <th className="py-3 text-center">Activa</th>
              {puedeEditar && <th className="py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nueva && (
              <tr className="bg-brand-50/40">
                <td className="py-2">
                  <input autoFocus placeholder="EJ: SELLANTES" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value.toUpperCase() })} className={`${CAMPO_CLASS} font-mono`} />
                </td>
                <td className="py-2">
                  <input placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className={CAMPO_CLASS} />
                </td>
                <td className="py-2">
                  <input placeholder="Sin código" value={nueva.integracionClay} onChange={(e) => setNueva({ ...nueva, integracionClay: e.target.value })} className={`${CAMPO_CLASS} font-mono`} />
                </td>
                <td className="py-2">
                  <input type="number" min={0} value={nueva.orden} onChange={(e) => setNueva({ ...nueva, orden: e.target.value })} className={`${CAMPO_CLASS} text-right`} />
                </td>
                <td className="py-2 text-slate-400">—</td>
                <td className="py-2" />
                <td className="py-2 text-right whitespace-nowrap">
                  <Button size="sm" onClick={() => crear.mutate(nueva)} disabled={!nueva.codigo.trim() || !nueva.nombre.trim()} isLoading={crear.isPending}>
                    Crear
                  </Button>
                  <button onClick={() => setNueva(null)} className="ml-1 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Cancelar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            )}
            {partidas.map((p) => {
              const v = valor(p);
              const guardando = guardar.isPending && guardar.variables?.id === p.id;
              return (
                <tr key={p.id} className={`hover:bg-slate-50/80 ${p.activa ? '' : 'opacity-60'}`}>
                  <td className="py-2 font-mono text-[10px] text-slate-500">
                    {p.codigo}
                    {p.porDefecto && (
                      <Badge size="sm" variant="warning" className="ml-1.5" title="Recibe lo que todavía no tiene partida">
                        Por defecto
                      </Badge>
                    )}
                  </td>
                  <td className="py-2">
                    {puedeEditar ? <input value={v.nombre} onChange={(e) => cambiar(p, 'nombre', e.target.value)} className={CAMPO_CLASS} /> : <span className="font-semibold text-slate-900">{p.nombre}</span>}
                  </td>
                  <td className="py-2">
                    {puedeEditar ? (
                      <input value={v.integracionClay} placeholder="Sin código" onChange={(e) => cambiar(p, 'integracionClay', e.target.value)} className={`${CAMPO_CLASS} font-mono`} />
                    ) : (
                      <span className="font-mono text-slate-600">{p.integracionClay || '—'}</span>
                    )}
                  </td>
                  <td className="py-2">
                    {puedeEditar ? <input type="number" min={0} value={v.orden} onChange={(e) => cambiar(p, 'orden', e.target.value)} className={`${CAMPO_CLASS} text-right`} /> : p.orden}
                  </td>
                  <td className="py-2 text-[11px] text-slate-500 whitespace-nowrap">
                    {p._count?.tiposProducto ?? 0} tipos · {p._count?.ordenCompraItems ?? 0} ítems OC
                  </td>
                  <td className="py-2 text-center">
                    {puedeEditar ? (
                      <Interruptor
                        valor={p.activa}
                        disabled={p.porDefecto}
                        etiqueta={p.porDefecto ? 'La partida por defecto no se puede desactivar' : p.activa ? 'Desactivar' : 'Activar'}
                        onChange={(activa) => guardar.mutate({ id: p.id, payload: { activa } })}
                      />
                    ) : (
                      <Badge size="sm" variant={p.activa ? 'success' : 'default'}>{p.activa ? 'Activa' : 'Inactiva'}</Badge>
                    )}
                  </td>
                  {puedeEditar && (
                    <td className="py-2 text-right">
                      <button
                        onClick={() =>
                          guardar.mutate({
                            id: p.id,
                            payload: { nombre: v.nombre.trim(), integracionClay: v.integracionClay.trim() || null, orden: Number(v.orden) || 0 },
                          })
                        }
                        disabled={!sucia(p) || guardando || !v.nombre.trim()}
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
