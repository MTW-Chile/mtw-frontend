import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Calculator, Eye, Clock, Building2, Plus, Trash2 } from 'lucide-react';
import { getSyncLogs, triggerManualSync, createProyectoManual, eliminarProyecto } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS, BREAKPOINT_DESKTOP, STICKY_ACTIONS_CLASS } from '../../lib/designSystem';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { CotizacionDetalleModal } from './CotizacionDetalleModal';
import { CotizadorWorkspace } from './CotizadorWorkspace';
import type { Cliente, Proyecto } from '../../types';
import { ClientePicker } from '../clientes/ClientePicker';
import { useUrlParam, actualizarParams } from '../../lib/navigation';
import { HeaderSlot } from '../../components/layout/HeaderSlot';
import { esPresupuestoPrincipal, etiquetaEstadoProyecto, varianteEstadoProyecto } from '../../lib/estadosHetmo';
import { clavePresupuestos, consultarPresupuestos } from './presupuestosQuery';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { Buscador } from '../../components/ui/Buscador';
import { FiltroChips } from '../../components/ui/FiltroChips';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Aviso } from '../../components/ui/Aviso';
import { useConfirmar } from '../../components/ui/Confirmar';

// PRINCIPAL = presupuestos cerrados en HETMO (estado 2) + presupuestos
// manuales; TODOS = cualquier estado de HETMO. Ver esPresupuestoPrincipal.
// ACEPTADOS = los aceptados por el cliente (estado comercial interno): son
// obras en curso, así que salen de las demás vistas y solo se ven acá.
type EstadoFiltro = 'PRINCIPAL' | 'TODOS' | 'ACEPTADOS';

const ESTADOS_FILTRO: { id: EstadoFiltro; label: string }[] = [
  { id: 'PRINCIPAL', label: 'Cerrados y manuales' },
  { id: 'TODOS', label: 'Todos los estados' },
  { id: 'ACEPTADOS', label: 'Aceptado por Cliente' },
];

const estaAceptado = (p: Proyecto) => p.versiones[0]?.estadoAprobacion === 'ACEPTADO_CLIENTE';

export const CotizacionesPage: React.FC<{
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}> = ({ searchTerm: externalSearch = '', onSearchChange }) => {
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [internalSearch, setInternalSearch] = useState(externalSearch);
  // Por defecto: presupuestos cerrados (estado 2 de HETMO) y manuales.
  const [statusFilter, setStatusFilter] = useState<EstadoFiltro>('PRINCIPAL');
  const [selectedProyectoId, setSelectedProyectoId] = useState<string | null>(null);
  // El proyecto abierto en el Cotizador vive en la URL (?cotizar=<id>, y
  // el paso en ?paso=N) -- Atras del navegador vuelve al listado, F5 deja
  // el cotizador abierto, y el deep-link de las notificaciones (App.tsx >
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
  const handleEliminar = async (id: string, obra: string) => {
    const ok = await confirmar({ titulo: `¿Eliminar "${obra}" y todo su presupuesto?`, mensaje: 'Esta acción no se puede deshacer.', confirmar: 'Eliminar', peligro: true });
    if (ok) eliminarMutation.mutate(id);
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

  // El filtro por estado va en el SERVIDOR (ver presupuestosQuery.ts), no solo en el
  // navegador: un resync amplio puede llenar la pagina con otros estados.
  // Los aceptados por el cliente no tienen por qué estar en estado 2 de HETMO:
  // para ese filtro se trae todo y se filtra en el navegador.
  const filtroServidor = statusFilter === 'ACEPTADOS' ? 'TODOS' : statusFilter;
  const { data, isLoading, isError, refetch } = useQuery({
    // Misma clave y misma consulta que la insignia del menu (App.tsx) para el
    // filtro por defecto: lista e insignia comparten datos y siempre coinciden.
    queryKey: clavePresupuestos(filtroServidor),
    queryFn: () => consultarPresupuestos(filtroServidor),
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
  // presupuestos: viven solo en Obras (el servidor ya las excluye; el filtro
  // es una segunda guarda). Un presupuesto manual, aunque despues se acepte,
  // se queda aca como cualquier otro.
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

      if (statusFilter === 'ACEPTADOS') return estaAceptado(p);
      // Ocultos en todas las demás vistas: ya son obras en curso.
      if (estaAceptado(p)) return false;

      // Por el CODIGO de estado de HETMO, nunca por su glosa.
      if (statusFilter === 'PRINCIPAL') return esPresupuestoPrincipal(p);
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
      {/* Titulo y acciones viven en el Header del sitio (portal), no en una cabecera propia. */}
      <HeaderSlot>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="hidden @5xl:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs bg-white border border-slate-200 text-slate-600 shadow-xs">
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
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            aria-label="Sincronizar HETMO"
            leftIcon={<RotateCcw className={`w-3.5 h-3.5 text-brand-600 ${isSyncing ? 'animate-spin' : ''}`} />}
          >
            <span className="hidden @3xl:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar HETMO'}</span>
          </Button>
        </div>
      </HeaderSlot>

      {/* CONTENIDO: LISTADO DE PROYECTOS -- Maestro de Materiales vive solo en
          el menu lateral (ver Sidebar.tsx), ya no como sub-pestana aca. */}
      <div className="space-y-4">
          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <Buscador
                className="flex-1"
                valor={internalSearch}
                onChange={(v) => {
                  setInternalSearch(v);
                  onSearchChange?.(v);
                }}
                placeholder="Buscar obra, cliente, RUT o código…"
              />
            </div>

            {/* FILA INFERIOR: filtros de estado a la izquierda, acción principal a la derecha */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0 flex-1">
                <FiltroChips etiqueta="Filtrar por estado" opciones={ESTADOS_FILTRO} valor={statusFilter} onChange={setStatusFilter} />
              </div>

              <div className="ml-auto shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setMostrarModalManual(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Presupuesto manual
                </Button>
              </div>
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
                {statusFilter === 'PRINCIPAL'
                  ? 'No hay presupuestos cerrados (estado 2 de HETMO) ni presupuestos manuales. Puedes cambiar el filtro a "Todos los estados" para ver el resto.'
                  : statusFilter === 'ACEPTADOS'
                    ? 'No hay presupuestos aceptados por el cliente.'
                    : 'No hay presupuestos importados que coincidan con los filtros aplicados.'}
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
                <Tabla>
                  <Thead>
                    <Tr>
                      <Th className="px-5 py-3.5 w-32">Código</Th>
                      <Th className="px-5 py-3.5">Obra / Proyecto</Th>
                      <Th className="px-5 py-3.5">Cliente</Th>
                      <Th alinear="centro" className="px-5 py-3.5 w-24 hidden 2xl:table-cell">Versión</Th>
                      <Th alinear="derecha" className="px-5 py-3.5 w-28">Superficie</Th>
                      <Th alinear="centro" className="px-5 py-3.5 w-24 hidden 2xl:table-cell">Ventanas</Th>
                      <Th alinear="centro" className="px-5 py-3.5 w-36">Estado</Th>
                      <Th className={`px-5 py-3.5 text-center w-36 ${STICKY_ACTIONS_CLASS} bg-slate-50`}>Acciones</Th>
                    </Tr>
                    <Tr className="bg-white border-b border-slate-100">
                      {columnas.map((c) => (
                        <Th key={c.key} className="px-5">
                          <ColumnFilterHeader columna={c} valor={valores[c.key] || ''} onChange={(v) => setValor(c.key, v)} />
                        </Th>
                      ))}
                      <Th className="px-5 hidden 2xl:table-cell" colSpan={4} />
                      <Th className="px-5 2xl:hidden" colSpan={2} />
                      <Th className={`px-5 py-2.5 ${STICKY_ACTIONS_CLASS} bg-white`} />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {proyectosVisibles.map((p) => {
                      const activeVersion = p.versiones[0];

                      return (
                        <Tr
                          key={p.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => setCotizarProyectoId(p.id)}
                        >
                          <Td className="px-5 py-4 font-mono font-bold text-slate-500 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-[11px] whitespace-nowrap">
                              {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                            </span>
                          </Td>
                          <Td className="px-5 py-4 min-w-[15rem]">
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
                          </Td>
                          <Td className="px-5 py-4 min-w-[11rem]">
                            <div className="font-semibold text-slate-800 line-clamp-2" title={p.clienteNombreRaw}>
                              {p.clienteNombreRaw}
                            </div>
                            {p.clienteRutRaw && (
                              <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                {p.clienteRutRaw}
                              </div>
                            )}
                          </Td>
                          <Td alinear="centro" className="px-5 py-4 whitespace-nowrap hidden 2xl:table-cell">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
                              v{activeVersion?.versionNumero || 1}
                            </span>
                          </Td>
                          <Td alinear="derecha" className="px-5 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatNumber(activeVersion?.totalM2Ventanas, 2)}{' '}
                            <span className="text-[10px] font-normal text-slate-500">
                              m²
                            </span>
                          </Td>
                          <Td alinear="centro" className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap hidden 2xl:table-cell">
                            {activeVersion?.totalVentanas || 0}
                          </Td>
                          <Td alinear="centro" className="px-5 py-4 whitespace-nowrap">
                            <Badge variant={varianteEstadoProyecto(p)} size="sm" dot>
                              {etiquetaEstadoProyecto(p)}
                            </Badge>
                          </Td>
                          <Td
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
              <div className="space-y-3.5">
                {proyectosVisibles.map((p) => {
                  const activeVersion = p.versiones[0];

                  return (
                    <div
                      key={p.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 whitespace-nowrap">
                          {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                        </span>
                        <Badge variant={varianteEstadoProyecto(p)} size="sm" dot>
                          {etiquetaEstadoProyecto(p)}
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
        <Modal
          ancho="sm"
          titulo="Nuevo presupuesto manual"
          subtitulo="Solo líneas manuales (vidrio DVH, puerta Protex), sin obra sincronizada de HETMO"
          onClose={() => setMostrarModalManual(false)}
          cerrable={!crearManualMutation.isPending}
          pie={
            <Modal.Pie>
              <Button variant="outline" onClick={() => setMostrarModalManual(false)}>
                Cancelar
              </Button>
              <Button disabled={!obraManual.trim() || !clienteManual} isLoading={crearManualMutation.isPending} onClick={() => crearManualMutation.mutate()}>
                Crear y cotizar
              </Button>
            </Modal.Pie>
          }
        >
          <Input label="Obra" autoFocus value={obraManual} onChange={(e) => setObraManual(e.target.value)} placeholder="Nombre de la obra" />
          <ClientePicker value={clienteManual} onChange={setClienteManual} />
          <Input label="Dirección de la obra (opcional)" value={direccionManual} onChange={(e) => setDireccionManual(e.target.value)} placeholder="Si se deja vacía, se usa la del cliente" />
          {crearManualMutation.isError && <Aviso tono="peligro">No se pudo crear el presupuesto. Intenta de nuevo.</Aviso>}
        </Modal>
      )}
    </div>
  );
};
