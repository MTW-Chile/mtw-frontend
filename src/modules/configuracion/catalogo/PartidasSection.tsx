import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X, Tags } from 'lucide-react';
import { createPartida, getPartidas, updatePartida, type PartidaPayload } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { Partida } from '../../../types';
import { IconButton } from '../../../components/ui/IconButton';
import { Seccion } from '../../../components/ui/Seccion';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { InputCompacto, Interruptor } from '../../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { avisarError } from './comun';

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
      icono={Tags}
      antetitulo="Catálogo"
      sinRelleno
      titulo="Partidas"
      descripcion="Agrupan la Analítica, la Hoja de Fijación, las OC y el Control de Presupuesto. El orden es el de la Analítica; el código Clay es la cuenta contable de la integración."
      acciones={
        puedeEditar && !nueva ? (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNueva({ codigo: '', nombre: '', integracionClay: '', orden: String(partidas.length * 10) })}>
            Nueva partida
          </Button>
        ) : undefined
      }
    >
      <Tabla>
          <Thead>
            <Tr>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Código Clay</Th>
              <Th className="w-20">Orden</Th>
              <Th>Uso</Th>
              <Th alinear="centro">Activa</Th>
              {puedeEditar && <Th alinear="derecha">Acciones</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {nueva && (
              <Tr tono="destacada">
                <Td>
                  <InputCompacto aria-label="Código" autoFocus placeholder="EJ: SELLANTES" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value.toUpperCase() })} className="w-full font-mono" />
                </Td>
                <Td>
                  <InputCompacto aria-label="Nombre" placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className="w-full" />
                </Td>
                <Td>
                  <InputCompacto aria-label="Código Clay" placeholder="Sin código" value={nueva.integracionClay} onChange={(e) => setNueva({ ...nueva, integracionClay: e.target.value })} className="w-full font-mono" />
                </Td>
                <Td>
                  <InputCompacto aria-label="Orden" type="number" min={0} value={nueva.orden} onChange={(e) => setNueva({ ...nueva, orden: e.target.value })} className="w-full text-right" />
                </Td>
                <Td className="text-slate-400">—</Td>
                <Td />
                <Td className="text-right whitespace-nowrap">
                  <Button size="sm" onClick={() => crear.mutate(nueva)} disabled={!nueva.codigo.trim() || !nueva.nombre.trim()} isLoading={crear.isPending}>
                    Crear
                  </Button>
                  <IconButton icono={X} etiqueta="Cancelar" className="ml-1" onClick={() => setNueva(null)} />
                </Td>
              </Tr>
            )}
            {partidas.map((p) => {
              const v = valor(p);
              const guardando = guardar.isPending && guardar.variables?.id === p.id;
              return (
                <Tr key={p.id} tono={p.activa ? undefined : 'atenuada'}>
                  <Td className="font-mono text-[10px] text-slate-500">
                    {p.codigo}
                    {p.porDefecto && (
                      <Badge size="sm" variant="warning" className="ml-1.5" title="Recibe lo que todavía no tiene partida">
                        Por defecto
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {puedeEditar ? <InputCompacto aria-label="Nombre" value={v.nombre} onChange={(e) => cambiar(p, 'nombre', e.target.value)} className="w-full" /> : <span className="font-semibold text-slate-900">{p.nombre}</span>}
                  </Td>
                  <Td>
                    {puedeEditar ? (
                      <InputCompacto aria-label="Código Clay" value={v.integracionClay} placeholder="Sin código" onChange={(e) => cambiar(p, 'integracionClay', e.target.value)} className="w-full font-mono" />
                    ) : (
                      <span className="font-mono text-slate-600">{p.integracionClay || '—'}</span>
                    )}
                  </Td>
                  <Td>
                    {puedeEditar ? <InputCompacto aria-label="Orden" type="number" min={0} value={v.orden} onChange={(e) => cambiar(p, 'orden', e.target.value)} className="w-full text-right" /> : p.orden}
                  </Td>
                  <Td className="text-[11px] text-slate-500 whitespace-nowrap">
                    {p._count?.tiposProducto ?? 0} tipos · {p._count?.ordenCompraItems ?? 0} ítems OC
                  </Td>
                  <Td className="text-center">
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
                  </Td>
                  {puedeEditar && (
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Save className="w-3.5 h-3.5" />}
                        isLoading={guardando}
                        onClick={() =>
                          guardar.mutate({
                            id: p.id,
                            payload: { nombre: v.nombre.trim(), integracionClay: v.integracionClay.trim() || null, orden: Number(v.orden) || 0 },
                          })
                        }
                        disabled={!sucia(p) || !v.nombre.trim()}
                      >
                        Guardar
                      </Button>
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
      </Tabla>
    </Seccion>
  );
};
