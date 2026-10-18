import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X } from 'lucide-react';
import { IconButton } from '../../../components/ui/IconButton';
import { createUnidadMedida, getUnidadesMedida, updateUnidadMedida } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import type { UnidadMedida } from '../../../types';
import { Seccion } from '../../../components/ui/Seccion';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { InputCompacto, Interruptor } from '../../../components/ui/Campos';
import { avisarError } from './comun';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';

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
      sinRelleno
      titulo="Unidades de medida"
      descripcion="Las usan los tipos de producto para medir el consumo, expresar el precio y comprar (ej. metro, barra, m²)."
      acciones={
        puedeEditar && !nueva ? (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNueva({ codigo: '', nombre: '', simbolo: '' })}>
            Nueva unidad
          </Button>
        ) : undefined
      }
    >
      <Tabla>
        <Thead>
          <Tr>
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th className="w-28">Símbolo</Th>
            <Th alinear="centro">Activa</Th>
            {puedeEditar && <Th alinear="derecha">Acciones</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {nueva && (
            <Tr tono="destacada">
              <Td>
                <InputCompacto aria-label="Código" autoFocus placeholder="EJ: ROLLO" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value.toUpperCase() })} className="w-full font-mono" />
              </Td>
              <Td>
                <InputCompacto aria-label="Nombre" placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className="w-full" />
              </Td>
              <Td>
                <InputCompacto aria-label="Símbolo" placeholder="Ej: rollo" value={nueva.simbolo} onChange={(e) => setNueva({ ...nueva, simbolo: e.target.value })} className="w-full" />
              </Td>
              <Td />
              <Td alinear="derecha" className="whitespace-nowrap">
                <Button size="sm" onClick={() => crear.mutate(nueva)} disabled={!nueva.codigo.trim() || !nueva.nombre.trim() || !nueva.simbolo.trim()} isLoading={crear.isPending}>
                  Crear
                </Button>
                <IconButton icono={X} etiqueta="Cancelar" className="ml-1" onClick={() => setNueva(null)} />
              </Td>
            </Tr>
          )}
          {unidades.map((u) => {
            const v = valor(u);
            const guardando = guardar.isPending && guardar.variables?.id === u.id;
            return (
              <Tr key={u.id} tono={u.activa ? undefined : 'atenuada'}>
                <Td className="font-mono text-[10px] text-slate-500">{u.codigo}</Td>
                <Td>
                  {puedeEditar ? <InputCompacto aria-label="Nombre" value={v.nombre} onChange={(e) => cambiar(u, 'nombre', e.target.value)} className="w-full" /> : u.nombre}
                </Td>
                <Td>
                  {puedeEditar ? <InputCompacto aria-label="Símbolo" value={v.simbolo} onChange={(e) => cambiar(u, 'simbolo', e.target.value)} className="w-full" /> : u.simbolo}
                </Td>
                <Td alinear="centro">
                  <Interruptor valor={u.activa} disabled={!puedeEditar} etiqueta={u.activa ? 'Desactivar' : 'Activar'} onChange={(activa) => guardar.mutate({ id: u.id, payload: { activa } })} />
                </Td>
                {puedeEditar && (
                  <Td alinear="derecha">
                    <Button
                     size="sm"
                     variant="ghost"
                     leftIcon={<Save className="w-3.5 h-3.5" />}
                     isLoading={guardando}
                     onClick={() => guardar.mutate({ id: u.id, payload: { nombre: v.nombre.trim(), simbolo: v.simbolo.trim() } })}
                     disabled={!sucia(u) || !v.nombre.trim() || !v.simbolo.trim()}
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
