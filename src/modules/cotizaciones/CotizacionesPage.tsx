import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  Calculator,
  Eye,
  Clock,
  Search,
  Building2,
  Plus,
  Loader2,
  Trash2,
  X,
  ChevronDown,
} from 'lucide-react';
import { getProyectos, getSyncLogs, triggerManualSync, createProyectoManual, eliminarProyecto } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS, BREAKPOINT_DESKTOP, TABLE_CLASS, TABLE_WRAPPER_CLASS, STICKY_ACTIONS_CLASS } from '../../lib/designSystem';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { CotizacionDetalleModal } from './CotizacionDetalleModal';
import { CotizadorWorkspace } from './CotizadorWorkspace';
import type { Cliente, Proyecto } from '../../types';
import { ClientePicker } from '../clientes/ClientePicker';
import { useUrlParam, actualizarParams } from '../../lib/navigation';
import { PageHeader } from '../../components/ui/PageHeader';

type EstadoFiltro = 'TERMINADOS' | 'PEDIDOS' | 'TODOS';

const ESTADOS_FILTRO: { id: EstadoFiltro; label: string }[] = [
  { id: 'TERMINADOS', label: 'Presupuesto Terminado' },
  { id: 'PEDIDOS', label: 'Pedidos / Aprobados' },
  { id: 'TODOS', label: 'Todos los Estados' },
];

export const CotizacionesPage: React.FC<{
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}> = ({ searchTerm: externalSearch = '', onSearchChange }) => {
  const queryClient = useQueryClient();
  const [internalSearch, setInternalSearch] = useState(externalSearch);
  // Por defecto muestra solo proyectos con estado 2 (Presupuesto Terminado)
  const [statusFilter, setStatusFilter] = useState<EstadoFiltro>('TERMINADOS');
  const [selectedProyectoId, setSelectedProyectoId] = useState<string | null>(null);
  // El proyecto abierto en el Cotizador vive en la URL (?cotizar=<id>, y
  // el paso en ?paso=N) -- Atras del navegador vuelve al listado, F5 deja
  // el cotizador abierto, y el deep-link de la campanita (App.tsx >
  // abrirCotizacion) es solo navegar a esa URL.
  const [cotizarProyectoId] = useUrlParam('cotizar');
  const setCotizarProyectoId = (id: string | null) => actualizarParams({ cotizar: id, paso: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [mostrarModalManual, setMostrarModalManual] = useState(false);
  const [obraManual, setObraManual] = useState('');
  // Igual que la obra manual (Obras): pide un cliente del maestro (adjuntar o
  // crear) y una direccion opcional -- misma estructura, distinto origen.
  const [clienteManual, setClienteManual] = useState<Cliente | null>(null);
  const [direccionManual, setDireccionManual] = useState('');
  const crearManualMutation = useMutation({
    mutationFn: () =>
      createProyectoManual({
        obra: obraManual.trim(),
        clienteId: clienteManual!.id,
        direccion: direccionManual.trim() || undefined,
      }),
    onSuccess: ({ proyecto }) => {
      setMostrarModalManual(false);
      setObraManual('');
      setClienteManual(null);
      setDireccionManual('');
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setCotizarProyectoId(proyecto.id);
    },
  });
  const eliminarMutation = useMutation({
    mutationFn: (id: string) => eliminarProyecto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });
  const handleEliminar = (id: string, obra: string) => {
    if (window.confirm(`¿Eliminar "${obra}" y todo su presupuesto? Esta acción no se puede deshacer.`)) {
      eliminarMutation.mutate(id);
    }
  };
  // Monta sólo la vista de escritorio o la de mobile, nunca las dos -- ver
  // useMediaQuery.ts.
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  useEffect(() => {
    if (externalSearch) {
      setInternalSearch(externalSearch);
    }
  }, [externalSearch]);

  const effectiveSearch = internalSearch;

  // Filtro por estado en el SERVIDOR, no en el navegador -- el listado
  // pagina por actualizadoEn desc (mas recientes primero), asi que si se
  // filtrara solo del lado del cliente, un resync amplio que toque muchos
  // proyectos de golpe puede llenar toda la pagina con proyectos de OTRO
  // estado y dejar la pestana actual vacia aunque los proyectos reales
  // sigan intactos en la base (confirmado en produccion).
  const estadoServidor = statusFilter === 'TERMINADOS' ? 2 : statusFilter === 'PEDIDOS' ? 30 : undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['proyectos', statusFilter],
    queryFn: () => getProyectos({ limit: 100, estado: estadoServidor }),
    // El default global (5 min, sin refetch al volver a la pestaña) dejaba
    // esta lista mostrando el estado de HETMO desactualizado por minutos
    // despues de una resincronizacion (automatica o manual) -- incluida la
    // que se dispara fuera de la app via /api/debug/resync, que no tiene
    // forma de invalidar la cache del navegador. Se pisa el default aca
    // para que este listado en particular se refresque solo.
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  const { data: syncLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['syncLogsRecent'],
    queryFn: () => getSyncLogs(1),
  });

  // Las obras manuales (creadas desde Obras, nunca cotizadas) no son
  // presupuestos: viven solo en Obras. Un presupuesto manual, aunque despues
  // se acepte, se queda aca como cualquier otro.
  const proyectos = (data?.data || []).filter((p) => p.origen !== 'MANUAL_OBRA');
  const lastSync = syncLogs?.[0];

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await triggerManualSync(false);
      setTimeout(() => {
        refetch();
        refetchLogs();
        setIsSyncing(false);
      }, 3000);
    } catch {
      setIsSyncing(false);
    }
  };

  const filteredProyectos = useMemo(() => {
    return proyectos.filter((p) => {
      const term = effectiveSearch.toLowerCase().trim();
      const matchSearch =
        !term ||
        p.obra?.toLowerCase().includes(term) ||
        p.clienteNombreRaw?.toLowerCase().includes(term) ||
        p.codigoInterno?.toLowerCase().includes(term) ||
        p.clienteRutRaw?.toLowerCase().includes(term);

      if (!matchSearch) return false;

      const activeVersion = p.versiones[0];
      const estado = activeVersion?.estadoHetmo;
      const glosa = activeVersion?.estadoGlosa?.toLowerCase() || '';

      const isTerminado = estado === 2 || glosa.includes('terminado');
      const isPedido = estado === 30 || glosa.includes('pedido');

      if (statusFilter === 'TERMINADOS') return isTerminado;
      if (statusFilter === 'PEDIDOS') return isPedido;
      if (statusFilter === 'TODOS') return true;
      return true;
    });
  }, [proyectos, effectiveSearch, statusFilter]);

  const columnas: ColumnFilterDef<Proyecto>[] = useMemo(
    () => [
      { key: 'codigo', tipo: 'texto', label: 'Código', accessor: (p) => p.codigoInterno || `PRJ-${p.numeroPresupuesto}` },
      { key: 'obra', tipo: 'texto', label: 'Obra / Proyecto', accessor: (p) => p.obra || '' },
      { key: 'cliente', tipo: 'texto', label: 'Cliente', accessor: (p) => p.clienteNombreRaw || '' },
    ],
    []
  );
  const { valores, setValor, datosFiltrados: proyectosVisibles } = useColumnFilters(filteredProyectos, columnas);

  if (cotizarProyectoId) {
    return (
      <CotizadorWorkspace
        proyectoId={cotizarProyectoId}
        onBack={() => {
          setCotizarProyectoId(null);
          refetch();
        }}
      />
    );
  }

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      {/* ENCABEZADO: TITULO + SINCRONIZACIÓN RELAY / HETMO */}
      <PageHeader
        title="Cotizaciones"
        description="Presupuestos y obras importados desde HETMO."
        icon={Building2}
        count={proyectos.length}
        actions={
        <>
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs bg-white border border-slate-200 text-slate-600 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-brand-600" />
            <span>
              Última importación:{' '}
              <strong className="font-mono text-slate-900">
                {lastSync?.finalizadoEn
                  ? new Date(lastSync.finalizadoEn).toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Reciente'}
              </strong>
            </span>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setMostrarModalManual(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            <span className="hidden sm:inline">Presupuesto Manual</span>
            <span className="sm:hidden">Manual</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            leftIcon={
              <RotateCcw
                className={`w-3.5 h-3.5 text-brand-600 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
            }
          >
            <span className="hidden sm:inline">
              {isSyncing ? 'Sincronizando...' : 'Sincronizar HETMO'}
            </span>
            <span className="sm:hidden">{isSyncing ? 'Sync...' : 'Sync'}</span>
          </Button>
        </>
        }
      />

      {/* CONTENIDO: LISTADO DE PROYECTOS -- Maestro de Materiales vive solo en
          el menu lateral (ver Sidebar.tsx), ya no como sub-pestana aca. */}
      <div className="space-y-4">
          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Buscador */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={internalSearch}
                  onChange={(e) => {
                    setInternalSearch(e.target.value);
                    onSearchChange?.(e.target.value);
                  }}
                  placeholder="Buscar obra, cliente, RUT o código..."
                  className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 transition-all"
                />
                {internalSearch && (
                  <button
                    onClick={() => {
                      setInternalSearch('');
                      onSearchChange?.('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* FILTRO EN FORMATO DESPLEGABLE PARA MÓVILES (System-Wide) */}
              <div className="block md:hidden relative w-full sm:w-64">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as EstadoFiltro)}
                  className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-600 appearance-none cursor-pointer"
                >
                  {ESTADOS_FILTRO.map((est) => (
                    <option key={est.id} value={est.id}>
                      {est.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* FILTROS EN CHIPS HORIZONTALES PARA PANTALLAS GRANDES (System-Wide) */}
            <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-1 pt-1 -mx-1 px-1 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                Estado:
              </span>
              {ESTADOS_FILTRO.map((pill) => {
                const isActive = statusFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => setStatusFilter(pill.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LISTADO DE PROYECTOS */}
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : isError ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
              <p className="text-sm font-bold text-rose-600">
                Error al conectar con la base de datos Relay.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Comprueba que el backend de Railway esté en línea y conectado a PostgreSQL.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          ) : filteredProyectos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-12 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                No se encontraron obras
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {statusFilter === 'TERMINADOS'
                  ? 'No hay obras en estado "Presupuesto Terminado" (Estado 2). Puedes cambiar el filtro a "Todos los Estados" para ver otros proyectos.'
                  : 'No hay proyectos importados que coincidan con los filtros aplicados.'}
              </p>
              {(effectiveSearch || statusFilter !== 'TODOS') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInternalSearch('');
                    setStatusFilter('TODOS');
                  }}
                >
                  Ver Todos los Estados
                </Button>
              )}
            </div>
          ) : proyectosVisibles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-12 text-center space-y-3 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800">Ningún proyecto coincide con los filtros de columna</h3>
            </div>
          ) : (
            <>
              {/* 1. VISTA TABLA AUTOMÁTICA EN DESKTOP/TABLET (System-Wide) */}
              {isDesktop && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className={TABLE_WRAPPER_CLASS}>
                  <table className={TABLE_CLASS + ' text-left text-slate-700'}>
                    <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 w-32">Código</th>
                        <th className="px-5 py-3.5">Obra / Proyecto</th>
                        <th className="px-5 py-3.5">Cliente</th>
                        <th className="px-5 py-3.5 text-center w-24 hidden 2xl:table-cell">Versión</th>
                        <th className="px-5 py-3.5 text-right w-28">Superficie</th>
                        <th className="px-5 py-3.5 text-center w-24 hidden 2xl:table-cell">Ventanas</th>
                        <th className="px-5 py-3.5 text-center w-36">Estado</th>
                        <th className={`px-5 py-3.5 text-center w-36 ${STICKY_ACTIONS_CLASS} bg-slate-50`}>Acciones</th>
                      </tr>
                      <tr className="bg-white border-b border-slate-100">
                        {columnas.map((c) => (
                          <th key={c.key} className="px-5 py-2.5">
                            <ColumnFilterHeader columna={c} valor={valores[c.key] || ''} onChange={(v) => setValor(c.key, v)} />
                          </th>
                        ))}
                        <th className="px-5 py-2.5 hidden 2xl:table-cell" colSpan={4} />
                        <th className="px-5 py-2.5 2xl:hidden" colSpan={2} />
                        <th className={`px-5 py-2.5 ${STICKY_ACTIONS_CLASS} bg-white`} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proyectosVisibles.map((p) => {
                        const activeVersion = p.versiones[0];
                        const isPedido =
                          activeVersion?.estadoHetmo === 30 ||
                          activeVersion?.estadoGlosa?.toLowerCase().includes('pedido');

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                            onClick={() => setCotizarProyectoId(p.id)}
                          >
                            <td className="px-5 py-4 font-mono font-bold text-slate-500 whitespace-nowrap">
                              <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-[11px] whitespace-nowrap">
                                {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                              </span>
                            </td>
                            <td className="px-5 py-4 min-w-[15rem]">
                              <div
                                className="font-bold text-[13px] leading-snug text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2"
                                title={p.obra}
                              >
                                {p.obra}
                              </div>
                              {p.clienteDireccionRaw && (
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {p.clienteDireccionRaw}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 min-w-[11rem]">
                              <div className="font-semibold text-slate-800 line-clamp-2" title={p.clienteNombreRaw}>
                                {p.clienteNombreRaw}
                              </div>
                              {p.clienteRutRaw && (
                                <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                  {p.clienteRutRaw}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center whitespace-nowrap hidden 2xl:table-cell">
                              <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
                                v{activeVersion?.versionNumero || 1}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatNumber(activeVersion?.totalM2Ventanas, 2)}{' '}
                              <span className="text-[10px] font-normal text-slate-500">
                                m²
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center font-bold text-slate-900 whitespace-nowrap hidden 2xl:table-cell">
                              {activeVersion?.totalVentanas || 0}
                            </td>
                            <td className="px-5 py-4 text-center whitespace-nowrap">
                              <Badge
                                variant={isPedido ? 'success' : 'info'}
                                size="sm"
                                dot
                              >
                                {activeVersion?.estadoGlosa || 'Terminado'}
                              </Badge>
                            </td>
                            <td
                              className={`px-5 py-4 text-center whitespace-nowrap ${STICKY_ACTIONS_CLASS} bg-white`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  leftIcon={<Calculator className="w-3.5 h-3.5" />}
                                  onClick={() => setCotizarProyectoId(p.id)}
                                >
                                  Cotizar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setSelectedProyectoId(p.id)}
                                  title="Ver Ficha Técnica"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEliminar(p.id, p.obra)}
                                  disabled={eliminarMutation.isPending}
                                  title="Eliminar proyecto"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                </Button>
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

              {/* 2. VISTA TARJETAS AUTOMÁTICA EN MÓVILES (System-Wide por defecto) */}
              {!isDesktop && (
              <div className="space-y-3.5">
                {proyectosVisibles.map((p) => {
                  const activeVersion = p.versiones[0];
                  const isPedido =
                    activeVersion?.estadoHetmo === 30 ||
                    activeVersion?.estadoGlosa?.toLowerCase().includes('pedido');

                  return (
                    <div
                      key={p.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 whitespace-nowrap">
                          {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                        </span>
                        <Badge
                          variant={isPedido ? 'success' : 'info'}
                          size="sm"
                          dot
                        >
                          {activeVersion?.estadoGlosa || 'Terminado'}
                        </Badge>
                      </div>

                      <div>
                        <h3 className="font-black text-sm text-slate-900 line-clamp-1">
                          {p.obra}
                        </h3>
                        <p className="text-xs text-slate-600 font-medium">
                          {p.clienteNombreRaw}
                        </p>
                        {p.clienteDireccionRaw && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {p.clienteDireccionRaw}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">
                            Versión
                          </div>
                          <div className="font-mono font-bold text-xs text-slate-800 whitespace-nowrap">
                            v{activeVersion?.versionNumero || 1}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">
                            Superficie
                          </div>
                          <div className="font-mono font-bold text-xs text-slate-800 whitespace-nowrap">
                            {formatNumber(activeVersion?.totalM2Ventanas, 1)} m²
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">
                            Ventanas
                          </div>
                          <div className="font-mono font-bold text-xs text-slate-800 whitespace-nowrap">
                            {activeVersion?.totalVentanas || 0} un
                          </div>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Calculator className="w-3.5 h-3.5" />}
                          onClick={() => setCotizarProyectoId(p.id)}
                          className="flex-1"
                        >
                          Cotizar Obra
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setSelectedProyectoId(p.id)}
                          title="Ver Ficha Técnica"
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEliminar(p.id, p.obra)}
                          disabled={eliminarMutation.isPending}
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </>
          )}
      </div>

      {/* Modal Ficha Técnica */}
      <CotizacionDetalleModal
        proyectoId={selectedProyectoId}
        onClose={() => setSelectedProyectoId(null)}
      />

      {/* Modal Presupuesto Manual -- proyecto 100% lineas manuales (Vidrio
          DVH, Puerta Protex), sin pasar por HETMO. Crea el proyecto y salta
          directo al cotizador para agregar lineas de inmediato. */}
      {mostrarModalManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Nuevo Presupuesto Manual</h3>
              <button
                onClick={() => setMostrarModalManual(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Crea un presupuesto vacío para cotizar solo con líneas manuales (Vidrio DVH, Puerta Protex), sin obra sincronizada de HETMO.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Obra</label>
                <input
                  autoFocus
                  value={obraManual}
                  onChange={(e) => setObraManual(e.target.value)}
                  placeholder="Nombre de la obra"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600"
                />
              </div>
              <ClientePicker value={clienteManual} onChange={setClienteManual} />
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Dirección de la obra (opcional)</label>
                <input
                  value={direccionManual}
                  onChange={(e) => setDireccionManual(e.target.value)}
                  placeholder="Si se deja vacía, se usa la del cliente"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600"
                />
              </div>
            </div>
            {crearManualMutation.isError && (
              <p className="text-xs text-rose-600 font-semibold">No se pudo crear el presupuesto. Intenta de nuevo.</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setMostrarModalManual(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!obraManual.trim() || !clienteManual || crearManualMutation.isPending}
                onClick={() => crearManualMutation.mutate()}
                leftIcon={crearManualMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              >
                Crear y cotizar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
