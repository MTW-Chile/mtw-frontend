import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Building2, Trash2, GitMerge, EyeOff, Eye } from 'lucide-react';
import { getProveedores, eliminarProveedor, ocultarProveedor } from '../../../api/client';
import { TableSkeleton } from '../../../components/ui/Skeleton';
import { Badge } from '../../../components/ui/Badge';
import type { Proveedor } from '../../../types';
import { ProveedorEditModal } from './ProveedorEditModal';
import { FusionarProveedorModal } from './FusionarProveedorModal';
import { RepararDuplicadosModal } from './RepararDuplicadosModal';
import { Button } from '../../../components/ui/Button';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../../components/ui/ColumnFilterHeader';
import { BREAKPOINT_DESKTOP } from '../../../lib/designSystem';
import { usePermisos } from '../../../lib/permisos';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { IconButton } from '../../../components/ui/IconButton';
import { Buscador } from '../../../components/ui/Buscador';
import { ErrorCarga } from '../../../components/ui/Estados';
import { mostrarToast } from '../../../lib/toast';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { Seccion } from '../../../components/ui/Seccion';
import { Lista, FilaLista } from '../../../components/ui/Lista';

/**
 * Maestro de Proveedores: quién es cada proveedor y sus datos de
 * facturación (RUT, dirección, email, forma de pago, cuenta bancaria). Los
 * vinculados a HETMO (por código) reciben de HETMO solo los campos vacíos;
 * lo que se edita acá manda.
 */
export const ProveedoresPanel: React.FC = () => {
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [fusionando, setFusionando] = useState<Proveedor | null>(null);
  const [reparando, setReparando] = useState(false);
  // Monta sólo la vista de escritorio o la de mobile, nunca las dos -- ver
  // useMediaQuery.ts (mismo patrón que MaestroProductos y CotizacionesPage).
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  const { data, isLoading, isError, refetch } = useQuery<Proveedor[]>({
    queryKey: ['proveedores'],
    queryFn: async () => (await getProveedores()).data,
  });

  // mismo queryKey que App.tsx/Header.tsx -- sale del cache, no pega de
  // nuevo al backend.
  const { tiene } = usePermisos();
  const puedeFusionar = tiene('catalogo.proveedores.fusionar');
  // Solo un superadministrador oculta proveedores (los de HETMO que no se usan o vienen mal) y ve los ocultos.
  const puedeOcultar = tiene('sistema.proveedores');
  const ocultos = useQuery<Proveedor[]>({
    queryKey: ['proveedores', 'ocultos'],
    queryFn: async () => (await getProveedores({ ocultos: true })).data,
    enabled: puedeOcultar,
  });
  const ocultarMutation = useMutation({
    mutationFn: ({ id, oculto }: { id: string; oculto: boolean }) => ocultarProveedor(id, oculto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proveedores'] }),
    onError: (err: any) => mostrarToast(err?.response?.data?.error || 'No se pudo cambiar la visibilidad del proveedor.'),
  });

  // Borra un proveedor sin materiales, OC ni vinculo con HETMO. El backend
  // responde 409 si tiene algo enlazado (hay que fusionarlo).
  const eliminarMutation = useMutation({
    mutationFn: (id: string) => eliminarProveedor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proveedores'] }),
    onError: (err: any) => mostrarToast(err?.response?.data?.error || 'No se pudo eliminar el proveedor.'),
  });

  const pedirEliminar = async (p: Proveedor) => {
    const ok = await confirmar({ titulo: `¿Eliminar el proveedor "${p.nombre}"?`, mensaje: 'Esta acción no se puede deshacer.', confirmar: 'Eliminar', peligro: true });
    if (ok) eliminarMutation.mutate(p.id);
  };

  const proveedores = useMemo(() => data || [], [data]);

  const filtrados = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return proveedores;
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(term) ||
        (p.rut || '').toLowerCase().includes(term) ||
        (p.email || '').toLowerCase().includes(term)
    );
  }, [proveedores, searchTerm]);

  const columnas: ColumnFilterDef<Proveedor>[] = useMemo(
    () => [
      { key: 'nombre', tipo: 'texto', label: 'Nombre', accessor: (p) => p.nombre },
      { key: 'rut', tipo: 'texto', label: 'RUT', accessor: (p) => p.rut || '' },
      { key: 'email', tipo: 'texto', label: 'Email', accessor: (p) => p.email || '' },
    ],
    []
  );
  const { valores, setValor, datosFiltrados: visibles } = useColumnFilters(filtrados, columnas);

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      <Seccion
        titulo={
          <span className="flex items-center gap-2">
            Proveedores
            <Badge size="sm" className="normal-case tracking-normal font-mono">
              {visibles.length}
            </Badge>
          </span>
        }
        descripcion="Datos de facturación de cada proveedor. Los que vienen de HETMO conservan lo que edites aquí."
        acciones={
          puedeFusionar && (
            <Button variant="outline" size="sm" leftIcon={<GitMerge className="w-3.5 h-3.5" />} onClick={() => setReparando(true)}>
              Reparar duplicados
            </Button>
          )
        }
      >
        <Buscador valor={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre, RUT o email…" />
      </Seccion>
      {reparando && <RepararDuplicadosModal onClose={() => setReparando(false)} />}

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : isError ? (
        <ErrorCarga que="el maestro de proveedores" onReintentar={refetch} />
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No se encontraron proveedores</h3>
        </div>
      ) : visibles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800">Ningún proveedor coincide con los filtros de columna</h3>
        </div>
      ) : (
        <>
          {/* 1. VISTA TABLA AUTOMÁTICA EN DESKTOP/TABLET (System-Wide) */}
          {isDesktop && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <Tabla>
              <Thead>
                <Tr>
                  <Th className="px-5 py-3.5">Nombre</Th>
                  <Th className="px-5 py-3.5">Origen</Th>
                  <Th className="px-5 py-3.5">RUT</Th>
                  <Th className="px-5 py-3.5">Email</Th>
                  <Th className="px-5 py-3.5">Condiciones de Pago</Th>
                  <Th className="px-5 py-3.5">Uso</Th>
                  <Th alinear="derecha" className="px-5 py-3.5">Acciones</Th>
                </Tr>
                <Tr className="bg-white border-b border-slate-100">
                  <Th className="px-5">
                    <ColumnFilterHeader columna={columnas[0]} valor={valores.nombre || ''} onChange={(v) => setValor('nombre', v)} />
                  </Th>
                  <Th className="px-5" />
                  <Th className="px-5">
                    <ColumnFilterHeader columna={columnas[1]} valor={valores.rut || ''} onChange={(v) => setValor('rut', v)} />
                  </Th>
                  <Th className="px-5">
                    <ColumnFilterHeader columna={columnas[2]} valor={valores.email || ''} onChange={(v) => setValor('email', v)} />
                  </Th>
                  <Th className="px-5" colSpan={3} />
                </Tr>
              </Thead>
              <Tbody>
                {visibles.map((p) => {
                  const sinUso = !!p._count && p._count.materiales === 0 && p._count.ordenesCompra === 0;
                  return (
                  <Tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <Td className="px-5 py-3.5 font-semibold text-slate-900">{p.nombre}</Td>
                    <Td className="px-5 py-3.5">
                      {(p.origenesHetmo?.length ?? 0) > 0 ? (
                        <Badge variant="info" size="sm" title={`Código HETMO: ${p.origenesHetmo!.map((o) => o.codigoHetmo).join(', ')}`}>HETMO</Badge>
                      ) : (
                        <Badge variant="default" size="sm">Manual</Badge>
                      )}
                    </Td>
                    <Td className="px-5 py-3.5 text-slate-600">{p.rut || <span className="text-slate-300">—</span>}</Td>
                    <Td className="px-5 py-3.5 text-slate-600">{p.email || <span className="text-slate-300">—</span>}</Td>
                    <Td className="px-5 py-3.5 text-slate-600">{p.condicionesPago || <span className="text-slate-300">—</span>}</Td>
                    <Td className="px-5 py-3.5">
                      {p._count ? (
                        sinUso ? (
                          <Badge variant="warning" size="sm">Sin uso</Badge>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {p._count.materiales} mat · {p._count.ordenesCompra} OC
                          </span>
                        )
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td alinear="derecha" className="px-5 py-3.5">
                      <AccionesProveedor
                        proveedor={p}
                        sinUso={sinUso}
                        puedeFusionar={puedeFusionar}
                        eliminando={eliminarMutation.isPending && eliminarMutation.variables === p.id}
                        onEditar={() => setEditando(p)}
                        onFusionar={() => setFusionando(p)}
                        onEliminar={() => pedirEliminar(p)}
                        onOcultar={puedeOcultar ? () => ocultarMutation.mutate({ id: p.id, oculto: true }) : undefined}
                      />
                    </Td>
                  </Tr>
                  );
                })}
              </Tbody>
            </Tabla>
          </div>
          )}

          {/* 2. VISTA TARJETAS AUTOMÁTICA EN MÓVILES (System-Wide por defecto) */}
          {!isDesktop && (
          <div className="space-y-3">
            {visibles.map((p) => {
              const sinUso = !!p._count && p._count.materiales === 0 && p._count.ordenesCompra === 0;
              return (
              <div
                key={p.id}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">{p.nombre}</h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sinUso && <Badge variant="warning" size="sm">Sin uso</Badge>}
                    {(p.origenesHetmo?.length ?? 0) > 0 ? (
                      <Badge variant="info" size="sm">HETMO</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Manual</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-400">RUT:</span>{' '}
                    <span className="font-semibold text-slate-700">{p.rut || '—'}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-400">Email:</span>{' '}
                    <span className="font-semibold text-slate-700">{p.email || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Condiciones de Pago:</span>{' '}
                    <span className="font-semibold text-slate-700">{p.condicionesPago || '—'}</span>
                  </div>
                  {p._count && !sinUso && (
                    <div className="col-span-2">
                      <span className="text-slate-400">Uso:</span>{' '}
                      <span className="font-semibold text-slate-700 font-mono">
                        {p._count.materiales} mat · {p._count.ordenesCompra} OC
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex justify-end gap-1 flex-wrap">
                  <AccionesProveedor
                    proveedor={p}
                    sinUso={sinUso}
                    puedeFusionar={puedeFusionar}
                    eliminando={eliminarMutation.isPending && eliminarMutation.variables === p.id}
                    onEditar={() => setEditando(p)}
                    onFusionar={() => setFusionando(p)}
                    onEliminar={() => pedirEliminar(p)}
                    onOcultar={puedeOcultar ? () => ocultarMutation.mutate({ id: p.id, oculto: true }) : undefined}
                  />
                </div>
              </div>
              );
            })}
          </div>
          )}
        </>
      )}

      {puedeOcultar && (ocultos.data?.length ?? 0) > 0 && (
        <Seccion
          icono={EyeOff}
          titulo={`Proveedores ocultos (${ocultos.data!.length})`}
          descripcion="No se ofrecen en el maestro ni en los selectores; sus materiales y OC siguen igual. Solo los ven los superadministradores."
          sinRelleno
        >
          <Lista>
            {ocultos.data!.map((p) => (
              <FilaLista
                key={p.id}
                titulo={p.nombre}
                insignias={<Badge variant={(p.origenesHetmo?.length ?? 0) > 0 ? 'info' : 'default'} size="sm">{(p.origenesHetmo?.length ?? 0) > 0 ? 'HETMO' : 'Manual'}</Badge>}
                acciones={
                  <Button size="sm" variant="ghost" leftIcon={<Eye className="w-3 h-3" />} isLoading={ocultarMutation.isPending && ocultarMutation.variables?.id === p.id} onClick={() => ocultarMutation.mutate({ id: p.id, oculto: false })}>
                    Mostrar
                  </Button>
                }
              >
                {p._count && (
                  <span className="font-mono">
                    {p._count.materiales} mat · {p._count.ordenesCompra} OC
                  </span>
                )}
              </FilaLista>
            ))}
          </Lista>
        </Seccion>
      )}

      {editando && <ProveedorEditModal proveedor={editando} onClose={() => setEditando(null)} />}
      {fusionando && (
        <FusionarProveedorModal origen={fusionando} proveedores={proveedores} onClose={() => setFusionando(null)} />
      )}
    </div>
  );
};

const AccionesProveedor: React.FC<{
  proveedor: Proveedor;
  sinUso: boolean;
  puedeFusionar: boolean;
  eliminando: boolean;
  onEditar: () => void;
  onFusionar: () => void;
  onEliminar: () => void;
  /** Solo superadministrador: ocultar del maestro y los selectores. */
  onOcultar?: () => void;
}> = ({ proveedor, sinUso, puedeFusionar, eliminando, onEditar, onFusionar, onEliminar, onOcultar }) => (
  <div className="flex items-center justify-end gap-1">
    <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3 h-3" />} onClick={onEditar}>
      Editar
    </Button>
    {onOcultar && <IconButton icono={EyeOff} etiqueta={`Ocultar ${proveedor.nombre} del maestro y los selectores`} onClick={onOcultar} />}
    {puedeFusionar && (
      <>
        <Button size="sm" variant="ghost" leftIcon={<GitMerge className="w-3 h-3" />} title="Fusionar dentro de otro proveedor (reasigna materiales y OC)" onClick={onFusionar}>
          Fusionar
        </Button>
        <IconButton
          icono={Trash2}
          tono="peligro"
          etiqueta={sinUso ? `Eliminar ${proveedor.nombre}` : 'Tiene materiales u OC enlazados: fusiónalo primero'}
          disabled={!sinUso}
          cargando={eliminando}
          onClick={onEliminar}
        />
      </>
    )}
  </div>
);
