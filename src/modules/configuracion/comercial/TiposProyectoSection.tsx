import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X, FolderKanban } from 'lucide-react';
import { createTipoProyecto, getTiposProyecto, updateTipoProyecto } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { TipoProyecto } from '../../../types';
import { IconButton } from '../../../components/ui/IconButton';
import { Seccion } from '../../../components/ui/Seccion';
import { InputCompacto, Interruptor } from '../../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { avisarError } from '../catalogo/comun';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';

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
      icono={FolderKanban}
      antetitulo="Comercial"
      titulo="Tipos de proyecto"
      descripcion="Cada proyecto tiene un tipo; define sus plantillas de textos por defecto. El tipo por defecto lo recibe todo proyecto nuevo de HETMO."
      sinRelleno
      acciones={
        puedeEditar && !nuevo ? (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNuevo({ codigo: '', nombre: '' })}>
            Nuevo tipo
          </Button>
        ) : undefined
      }
    >
      <Tabla>
        <Thead>
          <Tr>
            <Th>Código</Th>
            <Th>Nombre</Th>
            <Th alinear="derecha">Proyectos</Th>
            <Th alinear="centro">Por defecto</Th>
            <Th alinear="centro">Activo</Th>
            {puedeEditar && <Th alinear="derecha">Acciones</Th>}
          </Tr>
        </Thead>
        <Tbody>
          {nuevo && (
            <Tr tono="destacada">
              <Td>
                <InputCompacto aria-label="Código" autoFocus placeholder="EJ: INMOBILIARIA" value={nuevo.codigo} onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })} className="w-full font-mono" />
              </Td>
              <Td>
                <InputCompacto aria-label="Nombre" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="w-full" />
              </Td>
              <Td colSpan={3}  />
              <Td alinear="derecha" className="whitespace-nowrap">
                <Button size="sm" onClick={() => crear.mutate(nuevo)} disabled={!nuevo.codigo.trim() || !nuevo.nombre.trim()} isLoading={crear.isPending}>
                  Crear
                </Button>
                <IconButton icono={X} etiqueta="Cancelar" className="ml-1" onClick={() => setNuevo(null)} />
              </Td>
            </Tr>
          )}
          {tipos.map((t) => {
            const guardando = guardar.isPending && guardar.variables?.id === t.id;
            return (
              <Tr key={t.id} tono={t.activo ? undefined : 'atenuada'}>
                <Td className="font-mono text-[10px] text-slate-500">{t.codigo}</Td>
                <Td>
                  {puedeEditar ? (
                    <InputCompacto aria-label="Nombre" value={nombreDe(t)} onChange={(e) => setNombres((p) => ({ ...p, [t.id]: e.target.value }))} className="w-full" />
                  ) : (
                    t.nombre
                  )}
                </Td>
                <Td numero>{t._count?.proyectos ?? 0}</Td>
                <Td alinear="centro">
                  {t.porDefecto ? (
                    <Badge size="sm" variant="brand">Por defecto</Badge>
                  ) : puedeEditar && t.activo ? (
                    <Button size="sm" variant="ghost" onClick={() => guardar.mutate({ id: t.id, payload: { porDefecto: true } })}>
                      Marcar
                    </Button>
                  ) : null}
                </Td>
                <Td alinear="centro">
                  <Interruptor
                    valor={t.activo}
                    disabled={!puedeEditar || t.porDefecto}
                    etiqueta={t.porDefecto ? 'El tipo por defecto no se puede desactivar' : t.activo ? 'Desactivar' : 'Activar'}
                    onChange={(activo) => guardar.mutate({ id: t.id, payload: { activo } })}
                  />
                </Td>
                {puedeEditar && (
                  <Td alinear="derecha">
                    <Button
                     size="sm"
                     variant="ghost"
                     leftIcon={<Save className="w-3.5 h-3.5" />}
                     isLoading={guardando}
                     onClick={() => guardar.mutate({ id: t.id, payload: { nombre: nombreDe(t).trim() } })}
                     disabled={nombreDe(t) === t.nombre || !nombreDe(t).trim()}
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
