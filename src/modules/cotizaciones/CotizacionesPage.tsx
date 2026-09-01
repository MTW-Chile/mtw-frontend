import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RotateCcw,
  Calculator,
  Eye,
  Clock,
  Search,
  Building2,
  Package,
  X,
  ChevronDown,
} from 'lucide-react';
import { getProyectos, getSyncLogs, triggerManualSync } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { CotizacionDetalleModal } from './CotizacionDetalleModal';
import { CotizadorWorkspace } from './CotizadorWorkspace';
import { MaestroProductos } from './components/MaestroProductos';

type SubTab = 'proyectos' | 'maestro';
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
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('proyectos');
  const [internalSearch, setInternalSearch] = useState(externalSearch);
  // Por defecto muestra solo proyectos con estado 2 (Presupuesto Terminado)
  const [statusFilter, setStatusFilter] = useState<EstadoFiltro>('TERMINADOS');
  const [selectedProyectoId, setSelectedProyectoId] = useState<string | null>(null);
  const [cotizarProyectoId, setCotizarProyectoId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (externalSearch) {
      setInternalSearch(externalSearch);
    }
  }, [externalSearch]);

  const effectiveSearch = internalSearch;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['proyectos'],
    queryFn: () => getProyectos({ limit: 100 }),
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

  const proyectos = data?.data || [];
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
    <div className="p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-5 max-w-7xl mx-auto animate-fade-in">
      {/* NAVEGACIÓN DE SUB-PESTAÑAS: DESPLEGABLE EN MÓVILES / BOTONES EN DESKTOP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Desplegable para Móviles */}
        <div className="block sm:hidden relative w-full">
          <div className="relative">
            <select
              value={activeSubTab}
              onChange={(e) => setActiveSubTab(e.target.value as SubTab)}
              className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#E34A26] appearance-none cursor-pointer shadow-xs"
            >
              <option value="proyectos">Presupuestos & Obras HETMO ({proyectos.length})</option>
              <option value="maestro">Maestro de Productos (Catálogo)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Botones de Tab para Desktop / Tablet */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('proyectos')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'proyectos'
                ? 'bg-[#E34A26] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Presupuestos & Obras HETMO</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono shrink-0 ${
                activeSubTab === 'proyectos'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {proyectos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('maestro')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'maestro'
                ? 'bg-[#E34A26] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Maestro de Productos</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider shrink-0 ${
                activeSubTab === 'maestro'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              Items
            </span>
          </button>
        </div>

        {/* Sincronización Relay / HETMO */}
        {activeSubTab === 'proyectos' && (
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs bg-white border border-slate-200 text-slate-600 shadow-xs">
              <Clock className="w-3.5 h-3.5 text-[#E34A26]" />
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
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              leftIcon={
                <RotateCcw
                  className={`w-3.5 h-3.5 text-[#E34A26] ${
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
          </div>
        )}
      </div>

      {/* CONTENIDO SEGÚN SUB-PESTAÑA */}
      {activeSubTab === 'maestro' ? (
        <MaestroProductos />
      ) : (
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
                  className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#E34A26] transition-all"
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
                  className="w-full py-2.5 pl-3.5 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#E34A26] appearance-none cursor-pointer"
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
          ) : (
            <>
              {/* 1. VISTA TABLA AUTOMÁTICA EN DESKTOP/TABLET (System-Wide) */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 w-32">Código</th>
                        <th className="px-5 py-3.5">Obra / Proyecto</th>
                        <th className="px-5 py-3.5">Cliente</th>
                        <th className="px-5 py-3.5 text-center w-24">Versión</th>
                        <th className="px-5 py-3.5 text-right w-28">Superficie</th>
                        <th className="px-5 py-3.5 text-center w-24">Ventanas</th>
                        <th className="px-5 py-3.5 text-center w-36">Estado</th>
                        <th className="px-5 py-3.5 text-center w-36">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProyectos.map((p) => {
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
                            <td className="px-5 py-4">
                              <div className="font-bold text-sm text-slate-900 group-hover:text-[#E34A26] transition-colors">
                                {p.obra}
                              </div>
                              {p.clienteDireccionRaw && (
                                <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {p.clienteDireccionRaw}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-800">
                                {p.clienteNombreRaw}
                              </div>
                              {p.clienteRutRaw && (
                                <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                  {p.clienteRutRaw}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center whitespace-nowrap">
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
                            <td className="px-5 py-4 text-center font-bold text-slate-900 whitespace-nowrap">
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
                              className="px-5 py-4 text-center whitespace-nowrap"
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
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. VISTA TARJETAS AUTOMÁTICA EN MÓVILES (System-Wide por defecto) */}
              <div className="block md:hidden space-y-3.5">
                {filteredProyectos.map((p) => {
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Ficha Técnica */}
      <CotizacionDetalleModal
        proyectoId={selectedProyectoId}
        onClose={() => setSelectedProyectoId(null)}
      />
    </div>
  );
};
