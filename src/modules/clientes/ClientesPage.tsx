import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Pencil, Users, X, Trash2, Plus, Loader2, Receipt } from 'lucide-react';
import { getClientes, getMisPermisos, eliminarCliente } from '../../api/client';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Cliente } from '../../types';
import { ClienteFormModal } from './ClienteFormModal';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS, BREAKPOINT_DESKTOP, TABLE_CLASS, TABLE_WRAPPER_CLASS, STICKY_ACTIONS_CLASS } from '../../lib/designSystem';
import { PageHeader } from '../../components/ui/PageHeader';

/**
 * Maestro de Clientes: quién es cada cliente y sus datos de contacto/
 * facturación -- hasta ahora solo se podían crear/vincular desde el
 * wizard de Cotizaciones (ver ClienteManager.tsx), sin forma de verlos o
 * editarlos todos juntos. La columna/pestaña "Cobranza" queda dispuesta a
 * propósito (sin datos todavía) para cuando este módulo se conecte con
 * Finanzas -- ver ClienteFormModal.
 */
export const ClientesPage: React.FC = () => {
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
  const { data: permisos } = useQuery({ queryKey: ['misPermisos'], queryFn: getMisPermisos });

  // Solo admin (ver requireAdmin en mtw-api) -- el backend responde 409 si
  // todavía tiene proyectos enlazados (hay que desvincularlos primero).
  const eliminarMutation = useMutation({
    mutationFn: (id: string) => eliminarCliente(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
    onError: (err: any) => window.alert(err?.response?.data?.error || 'No se pudo eliminar el cliente.'),
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
      <PageHeader
        title="Clientes"
        description="Maestro de clientes: datos de contacto y facturación."
        icon={Users}
        actions={
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreando(true)}>
            Nuevo Cliente
          </Button>
        }
      />

      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por razón social, RUT, giro o contacto..."
            className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : isError ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
          <p className="text-sm font-bold text-rose-600">Error al consultar el maestro de clientes.</p>
          <button onClick={() => refetch()} className="text-xs font-bold text-brand-600 hover:underline cursor-pointer">
            Reintentar
          </button>
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
              <div className={TABLE_WRAPPER_CLASS}>
                <table className={TABLE_CLASS + ' text-left text-slate-700'}>
                  <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Razón Social</th>
                      <th className="px-5 py-3.5">RUT</th>
                      <th className="px-5 py-3.5">Giro</th>
                      <th className="px-5 py-3.5">Contacto</th>
                      <th className="px-5 py-3.5">Proyectos</th>
                      <th className="px-5 py-3.5 hidden 2xl:table-cell">Cobranza</th>
                      <th className={`px-5 py-3.5 text-right ${STICKY_ACTIONS_CLASS} bg-slate-50`}>Acciones</th>
                    </tr>
                    <tr className="bg-white border-b border-slate-100">
                      {columnas.map((c) => (
                        <th key={c.key} className="px-5 py-2.5">
                          <ColumnFilterHeader columna={c} valor={valores[c.key] || ''} onChange={(v) => setValor(c.key, v)} />
                        </th>
                      ))}
                      <th className="px-5 py-2.5" />
                      <th className="px-5 py-2.5 hidden 2xl:table-cell" />
                      <th className={`px-5 py-2.5 ${STICKY_ACTIONS_CLASS} bg-white`} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibles.map((c) => {
                      const sinUso = !!c._count && c._count.proyectos === 0;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-slate-900 min-w-[14rem]">
                            <div className="line-clamp-2 leading-snug" title={c.nombre}>{c.nombre}</div>
                            {/* Solo si dice algo distinto al nombre -- antes se repetia
                                tal cual en gris debajo en casi todas las filas. */}
                            {c.razonSocial && c.razonSocial !== c.nombre && (
                              <span className="block text-[11px] text-slate-400 font-normal truncate max-w-[18rem]" title={c.razonSocial}>
                                {c.razonSocial}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 font-mono whitespace-nowrap">{c.rut || <span className="text-slate-300">—</span>}</td>
                          <td className="px-5 py-3.5 text-slate-600 min-w-[9rem]"><div className="line-clamp-2">{c.giro || <span className="text-slate-300">—</span>}</div></td>
                          <td className="px-5 py-3.5 text-slate-600 min-w-[9rem]"><div className="line-clamp-2">{c.contacto || <span className="text-slate-300">—</span>}</div></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {c._count ? (
                              sinUso ? (
                                <Badge variant="warning" size="sm">Sin uso</Badge>
                              ) : (
                                <span className="text-[11px] text-slate-500 font-mono">{c._count.proyectos} proy.</span>
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap hidden 2xl:table-cell">
                            <CobranzaBadge />
                          </td>
                          <td className={`px-5 py-3.5 text-right whitespace-nowrap ${STICKY_ACTIONS_CLASS} bg-white`}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditando(c)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Editar</span>
                              </button>
                              {permisos?.esAdmin && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`¿Eliminar el cliente "${c.nombre}"? Esta acción no se puede deshacer.`)) {
                                      eliminarMutation.mutate(c.id);
                                    }
                                  }}
                                  disabled={!sinUso || (eliminarMutation.isPending && eliminarMutation.variables === c.id)}
                                  title={sinUso ? undefined : 'Tiene proyectos enlazados -- desvincúlalos primero'}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  {eliminarMutation.isPending && eliminarMutation.variables === c.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                  <span>Eliminar</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                      <button
                        onClick={() => setEditando(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      {permisos?.esAdmin && (
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Eliminar el cliente "${c.nombre}"? Esta acción no se puede deshacer.`)) {
                              eliminarMutation.mutate(c.id);
                            }
                          }}
                          disabled={!sinUso || (eliminarMutation.isPending && eliminarMutation.variables === c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        >
                          {eliminarMutation.isPending && eliminarMutation.variables === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>Eliminar</span>
                        </button>
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
