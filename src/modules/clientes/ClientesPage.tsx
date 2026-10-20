import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Users, Trash2, Plus, Receipt } from 'lucide-react';
import { getClientes, eliminarCliente } from '../../api/client';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Cliente } from '../../types';
import { ClienteFormModal } from './ClienteFormModal';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS, BREAKPOINT_DESKTOP, STICKY_ACTIONS_CLASS } from '../../lib/designSystem';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { usePermisos } from '../../lib/permisos';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { mostrarToast } from '../../lib/toast';
import { useConfirmar } from '../../components/ui/Confirmar';
import { Buscador } from '../../components/ui/Buscador';

/**
 * Maestro de Clientes: quién es cada cliente y sus datos de contacto/
 * facturación -- hasta ahora solo se podían crear/vincular desde el
 * wizard de Cotizaciones (ver ClienteManager.tsx), sin forma de verlos o
 * editarlos todos juntos. La columna/pestaña "Cobranza" queda dispuesta a
 * propósito (sin datos todavía) para cuando este módulo se conecte con
 * Finanzas -- ver ClienteFormModal.
 */
export const ClientesPage: React.FC = () => {
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);
  // Monta sólo la vista de escritorio o la de mobile, nunca las dos -- ver
  // useMediaQuery.ts (mismo patrón que ProveedoresPanel/MaestroProductos).
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  const { data, isLoading, isError, refetch } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: async () => (await getClientes()).data,
  });

  // mismo queryKey que el resto de la app -- sale del cache, no pega de nuevo al backend.
  const { tiene } = usePermisos();
  const puedeEliminar = tiene('clientes.archivar');

  // Solo admin (ver requireAdmin en mtw-api) -- el backend responde 409 si
  // todavía tiene proyectos enlazados (hay que desvincularlos primero).
  const eliminarMutation = useMutation({
    mutationFn: (id: string) => eliminarCliente(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
    onError: (err: any) => mostrarToast(err?.response?.data?.error || 'No se pudo eliminar el cliente.'),
  });

  const clientes = useMemo(() => data || [], [data]);

  const filtrados = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        (c.rut || '').toLowerCase().includes(term) ||
        (c.giro || '').toLowerCase().includes(term) ||
        (c.contacto || '').toLowerCase().includes(term)
    );
  }, [clientes, searchTerm]);

  const columnas: ColumnFilterDef<Cliente>[] = useMemo(
    () => [
      { key: 'nombre', tipo: 'texto', label: 'Razón Social', accessor: (c) => c.nombre },
      { key: 'rut', tipo: 'texto', label: 'RUT', accessor: (c) => c.rut || '' },
      { key: 'giro', tipo: 'texto', label: 'Giro', accessor: (c) => c.giro || '' },
      { key: 'contacto', tipo: 'texto', label: 'Contacto', accessor: (c) => c.contacto || '' },
    ],
    []
  );
  const { valores, setValor, datosFiltrados: visibles } = useColumnFilters(filtrados, columnas);

  const CobranzaBadge = () => (
    <span
      title="Todavía no conectado con Finanzas"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200 text-[10px] font-semibold"
    >
      <Receipt className="w-2.5 h-2.5" /> Sin datos
    </span>
  );

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion
        titulo="Clientes"
        acciones={
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreando(true)}>
            Nuevo Cliente
          </Button>
        }
      />

      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <Buscador valor={searchTerm} onChange={setSearchTerm} placeholder="Buscar por razón social, RUT, giro o contacto…" />
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : isError ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
          <p className="text-sm font-bold text-rose-600">Error al consultar el maestro de clientes.</p>
          <Button variant="link" size="sm" onClick={() => refetch()}>Reintentar</Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No se encontraron clientes</h3>
        </div>
      ) : visibles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 text-center space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800">Ningún cliente coincide con los filtros de columna</h3>
        </div>
      ) : (
        <>
          {isDesktop && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <Tabla>
                <Thead>
                  <Tr>
                    <Th className="px-5 py-3.5">Razón Social</Th>
                    <Th className="px-5 py-3.5">RUT</Th>
                    <Th className="px-5 py-3.5">Giro</Th>
                    <Th className="px-5 py-3.5">Contacto</Th>
                    <Th className="px-5 py-3.5">Proyectos</Th>
                    <Th className="px-5 py-3.5 hidden 2xl:table-cell">Cobranza</Th>
                    <Th className={`px-5 py-3.5 text-right ${STICKY_ACTIONS_CLASS} bg-slate-50`}>Acciones</Th>
                  </Tr>
                  <Tr className="bg-white border-b border-slate-100">
                    {columnas.map((c) => (
                      <Th key={c.key} className="px-5">
                        <ColumnFilterHeader columna={c} valor={valores[c.key] || ''} onChange={(v) => setValor(c.key, v)} />
                      </Th>
                    ))}
                    <Th className="px-5" />
                    <Th className="px-5 hidden 2xl:table-cell" />
                    <Th className={`px-5 py-2.5 ${STICKY_ACTIONS_CLASS} bg-white`} />
                  </Tr>
                </Thead>
                <Tbody>
                  {visibles.map((c) => {
                    const sinUso = !!c._count && c._count.proyectos === 0;
                    return (
                      <Tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <Td className="px-5 py-3.5 font-semibold text-slate-900 min-w-[14rem]">
                          <div className="line-clamp-2 leading-snug" title={c.nombre}>{c.nombre}</div>
                          {/* Solo si dice algo distinto al nombre -- antes se repetia
                              tal cual en gris debajo en casi todas las filas. */}
                          {c.razonSocial && c.razonSocial !== c.nombre && (
                            <span className="block text-[11px] text-slate-400 font-normal truncate max-w-[18rem]" title={c.razonSocial}>
                              {c.razonSocial}
                            </span>
                          )}
                        </Td>
                        <Td className="px-5 py-3.5 text-slate-600 font-mono whitespace-nowrap">{c.rut || <span className="text-slate-300">—</span>}</Td>
                        <Td className="px-5 py-3.5 text-slate-600 min-w-[9rem]"><div className="line-clamp-2">{c.giro || <span className="text-slate-300">—</span>}</div></Td>
                        <Td className="px-5 py-3.5 text-slate-600 min-w-[9rem]"><div className="line-clamp-2">{c.contacto || <span className="text-slate-300">—</span>}</div></Td>
                        <Td className="px-5 py-3.5 whitespace-nowrap">
                          {c._count ? (
                            sinUso ? (
                              <Badge variant="warning" size="sm">Sin uso</Badge>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">{c._count.proyectos} proy.</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </Td>
                        <Td className="px-5 py-3.5 whitespace-nowrap hidden 2xl:table-cell">
                          <CobranzaBadge />
                        </Td>
                        <Td className={`px-5 py-3.5 text-right whitespace-nowrap ${STICKY_ACTIONS_CLASS} bg-white`}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(c)}>Editar</Button>
                            {puedeEliminar && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                                isLoading={eliminarMutation.isPending && eliminarMutation.variables === c.id}
                                onClick={async () => {
                                  if (await confirmar({ titulo: `¿Eliminar el cliente "${c.nombre}"?`, mensaje: `Esta acción no se puede deshacer.`, confirmar: 'Eliminar', peligro: true })) {
                                    eliminarMutation.mutate(c.id);
                                  }
                                }}
                                disabled={!sinUso}
                                title={sinUso ? undefined : 'Tiene proyectos enlazados: desvincúlalos primero'}
                                className="text-rose-600! hover:bg-rose-50!"
                              >
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Tabla>
            </div>
          )}

          {!isDesktop && (
            <div className="space-y-3">
              {visibles.map((c) => {
                const sinUso = !!c._count && c._count.proyectos === 0;
                return (
                  <div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{c.nombre}</h4>
                        {c.razonSocial && <p className="text-[11px] text-slate-400">{c.razonSocial}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sinUso && <Badge variant="warning" size="sm">Sin uso</Badge>}
                        <CobranzaBadge />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <div>
                        <span className="text-slate-400">RUT:</span> <span className="font-semibold text-slate-700">{c.rut || '—'}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-400">Contacto:</span>{' '}
                        <span className="font-semibold text-slate-700">{c.contacto || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Giro:</span> <span className="font-semibold text-slate-700">{c.giro || '—'}</span>
                      </div>
                      {c._count && !sinUso && (
                        <div className="col-span-2">
                          <span className="text-slate-400">Proyectos:</span>{' '}
                          <span className="font-semibold text-slate-700 font-mono">{c._count.proyectos}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex justify-end gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(c)}>Editar</Button>
                      {puedeEliminar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                          isLoading={eliminarMutation.isPending && eliminarMutation.variables === c.id}
                          onClick={async () => {
                            if (await confirmar({ titulo: `¿Eliminar el cliente "${c.nombre}"?`, mensaje: `Esta acción no se puede deshacer.`, confirmar: 'Eliminar', peligro: true })) {
                              eliminarMutation.mutate(c.id);
                            }
                          }}
                          disabled={!sinUso}
                          title={sinUso ? undefined : 'Tiene proyectos enlazados: desvincúlalos primero'}
                          className="text-rose-600! hover:bg-rose-50!"
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editando && <ClienteFormModal cliente={editando} onClose={() => setEditando(null)} />}
      {creando && <ClienteFormModal cliente={null} onClose={() => setCreando(false)} />}
    </div>
  );
};
