import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  FileCheck2,
  AlertCircle,
  Search,
  RefreshCw,
  CheckCircle2,
  X as XIcon,
  Plus,
  KeyRound,
  Scale,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getOrdenesCompra, getFacturasSugeridas, refrescarConciliacion, getMisPermisos, ajustarOCAFacturado } from '../../api/client';
import { netoConciliacion, type EstadoConciliacionFactura, type EstadoOC, type FiltrosFacturas } from '../../types';
import { ESTADO_OC_LABEL, ESTADO_OC_VARIANT, DetalleItemsOC } from '../abastecimiento/OrdenesCompraList';
import { CheckoutFacturaModal } from './CheckoutFacturaModal';

const ESTADO_CUADRE_VARIANT: Record<EstadoConciliacionFactura, BadgeVariant> = {
  PENDIENTE: 'subtle',
  CUADRA: 'success',
  DIFERENCIA: 'danger',
};

const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { timeZone: 'UTC' });

// Solo tiene sentido vincular una OC que ya se recibio (parcial o total)
// -- antes de eso no hay contra que comparar la factura.
const ESTADOS_CONCILIABLES: EstadoOC[] = ['RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'PARCIALMENTE_CONCILIADA', 'CONCILIADA'];

const FILTROS_DEFAULT: FiltrosFacturas = { rut: true, monto: true };

// Chip de un prefiltro de la busqueda: activo se quita con la X; quitado
// queda punteado para volver a ponerlo.
const ChipFiltro: React.FC<{ activo: boolean; label: string; onToggle: () => void; disabled?: boolean }> = ({
  activo,
  label,
  onToggle,
  disabled,
}) =>
  activo ? (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[#E34A26]/10 border border-[#E34A26]/25 text-[11px] font-semibold text-[#B8391B]">
      {label}
      <button
        onClick={onToggle}
        disabled={disabled}
        title="Quitar filtro"
        className="w-4 h-4 rounded-full hover:bg-[#E34A26]/20 flex items-center justify-center disabled:opacity-50"
      >
        <XIcon className="w-3 h-3" />
      </button>
    </span>
  ) : (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-slate-300 text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:border-slate-400 disabled:opacity-50"
    >
      <Plus className="w-3 h-3" />
      {label}
    </button>
  );

// "Control de documentos": concilia cada OC ya recibida con su factura
// RECIBIDA real, que vive en Clay (sistema contable). La busqueda trae solo
// facturas SIN CONTABILIZAR (o con asientos pendientes), prefiltradas por
// RUT del proveedor y por monto -- cada filtro se quita con su X. Al elegir
// una se abre el checkout (CheckoutFacturaModal): muestra el asiento que se
// va a crear en Clay y, al confirmar, contabiliza la factura y concilia la
// OC. Todo lo que toca Clay va con el token de Clay del usuario.
//
// Vista global (todas las obras + "Obras Mayores" juntas) -- vive solo en
// Compras > Conciliación de Facturas (ver ComprasPage), ya no dentro de
// la ficha de un proyecto puntual (esa conciliación se centralizó acá).
export const ControlDocumentosTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [buscandoEnId, setBuscandoEnId] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosFacturas>(FILTROS_DEFAULT);
  const [checkout, setCheckout] = useState<{
    ordenCompraId: string;
    ordenCompraNumero: string;
    clayTransactionId: string;
    permitirOtroRut: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: permisos } = useQuery({ queryKey: ['misPermisos'], queryFn: getMisPermisos });
  const sinTokenClay = permisos ? !permisos.tieneTokenClay : false;

  const { data, isLoading } = useQuery({
    queryKey: ['ordenesCompra', { proyectoId: undefined, estado: '' }],
    queryFn: () => getOrdenesCompra({ limit: 200 }),
  });

  const {
    data: sugerenciasData,
    isFetching: buscandoFacturas,
    error: errorSugerencias,
  } = useQuery({
    queryKey: ['facturasSugeridas', buscandoEnId, filtros],
    queryFn: () => getFacturasSugeridas(buscandoEnId!, filtros),
    enabled: !!buscandoEnId && !sinTokenClay,
  });

  const refrescarMutation = useMutation({
    mutationFn: (conciliacionId: string) => refrescarConciliacion(conciliacionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo refrescar el estado de pago.'),
  });

  const ajustarMutation = useMutation({
    mutationFn: (ordenCompraId: string) => ajustarOCAFacturado(ordenCompraId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo ajustar la OC.'),
  });

  const ordenes = useMemo(() => (data?.data || []).filter((oc) => ESTADOS_CONCILIABLES.includes(oc.estado)), [data]);

  // Busqueda global, mismo patron que el resto de las listas (ClientesPage,
  // ProveedoresPanel, etc.) -- esta pantalla es una lista de tarjetas, no
  // una tabla, asi que no le corresponde filtro por columna (ver
  // useColumnFilters), pero si el buscador estandar.
  const ordenesFiltradas = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return ordenes;
    return ordenes.filter(
      (oc) =>
        oc.numero.toLowerCase().includes(term) ||
        (oc.proveedor?.nombre || '').toLowerCase().includes(term) ||
        (oc.proyecto?.obra || oc.centroCosto?.nombre || '').toLowerCase().includes(term)
    );
  }, [ordenes, searchTerm]);

  const toggleExpandida = (ordenCompraId: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(ordenCompraId)) next.delete(ordenCompraId);
      else next.add(ordenCompraId);
      return next;
    });
  };

  const abrirBusqueda = (ordenCompraId: string) => {
    setError(null);
    setFiltros(FILTROS_DEFAULT);
    setBuscandoEnId(ordenCompraId);
  };

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Conciliación de Órdenes de Compra con la factura real del proveedor en Clay -- se buscan facturas sin contabilizar,
        revisas el asiento y al confirmar se contabiliza en Clay y la OC queda conciliada.
      </p>

      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número de OC, proveedor u obra..."
            className="w-full pl-10 pr-9 py-2.5 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#E34A26] transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Limpiar búsqueda"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {sinTokenClay && (
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 shrink-0" />
          Para buscar y contabilizar facturas necesitas tu token de Clay. Cárgalo en el menú de usuario (arriba a la derecha) &gt; Editar mi usuario.
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {ordenes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          <FileCheck2 className="w-6 h-6 mx-auto mb-2 text-slate-300" />
          Todavía no hay OC recibidas para conciliar.
        </div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Ninguna OC coincide con la búsqueda.
        </div>
      ) : (
        <div className="space-y-3">
          {ordenesFiltradas.map((oc) => {
            const totalOC = oc.items.reduce((sum, i) => sum + Number(i.cantidad) * Number(i.precioUnitario), 0);
            const conciliaciones = oc.conciliaciones || [];
            const totalFacturado = conciliaciones.reduce((sum, c) => sum + netoConciliacion(c), 0);
            const totalPagado = conciliaciones.reduce((sum, c) => sum + Number(c.montoPagado), 0);
            const buscandoAqui = buscandoEnId === oc.id;
            const rutProveedor = oc.proveedor?.rut;

            return (
              <div key={oc.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap border-b border-slate-50">
                  <button
                    onClick={() => toggleExpandida(oc.id)}
                    className="flex items-center gap-2.5 flex-wrap text-left"
                    title="Ver items y su estado de conciliación"
                  >
                    {expandidas.has(oc.id) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="font-mono font-bold text-sm text-slate-900">{oc.numero}</span>
                    <span className="text-xs text-slate-500">{oc.proveedor?.nombre}</span>
                    <span className="text-xs text-slate-400">· {oc.proyecto?.obra || oc.centroCosto?.nombre || 'Obras Mayores'}</span>
                    <Badge variant={ESTADO_OC_VARIANT[oc.estado]} size="sm">
                      {ESTADO_OC_LABEL[oc.estado]}
                    </Badge>
                  </button>
                  <div className="text-xs text-slate-600">
                    OC (neto): <span className="font-bold text-slate-900">{formatCLP(totalOC)}</span> · Facturado (neto):{' '}
                    <span className="font-bold text-slate-900">{formatCLP(totalFacturado)}</span> · Pagado:{' '}
                    <span className="font-bold text-emerald-700">{formatCLP(totalPagado)}</span>
                  </div>
                </div>

                {expandidas.has(oc.id) && (
                  <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                    <DetalleItemsOC oc={oc} mostrarConciliacion />
                  </div>
                )}

                {oc.estado === 'PARCIALMENTE_CONCILIADA' && (
                  <div className="px-4 py-2.5 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between gap-3 flex-wrap text-xs">
                    <span className="text-amber-800">
                      Lo facturado no cuadra con la OC (diferencia {formatCLP(totalFacturado - totalOC)}). Puedes vincular otra factura o
                      ajustar la OC al monto facturado.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Scale className="w-3.5 h-3.5" />}
                      isLoading={ajustarMutation.isPending && ajustarMutation.variables === oc.id}
                      onClick={() => {
                        setError(null);
                        ajustarMutation.mutate(oc.id);
                      }}
                    >
                      Ajustar OC a {formatCLP(totalFacturado)}
                    </Button>
                  </div>
                )}

                {conciliaciones.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {conciliaciones.map((c) => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs flex-wrap">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-slate-700">Factura {c.folio}</span>
                          <Badge variant={ESTADO_CUADRE_VARIANT[c.estadoCuadre]} size="sm">
                            {c.estadoCuadre}
                          </Badge>
                          <Badge variant={c.clayAsientoId ? 'info' : 'subtle'} size="sm">
                            {c.clayAsientoId ? 'Contabilizada en Clay' : 'Sin contabilizar'}
                          </Badge>
                          <Badge variant={c.pagada ? 'success' : 'subtle'} size="sm">
                            {c.pagada ? 'Pagada' : 'Pendiente de pago'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-slate-800">
                            {formatCLP(netoConciliacion(c))} <span className="text-slate-400 font-normal">neto</span>
                            {!c.pagada && Number(c.montoPagado) > 0 && (
                              <span className="text-slate-400 font-normal"> · pagado {formatCLP(Number(c.montoPagado))}</span>
                            )}
                          </span>
                          <button
                            title="Refrescar estado de pago desde Clay"
                            onClick={() => refrescarMutation.mutate(c.id)}
                            disabled={refrescarMutation.isPending || sinTokenClay}
                            className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0 disabled:opacity-50"
                          >
                            {refrescarMutation.isPending && refrescarMutation.variables === c.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {buscandoAqui ? (
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Facturas sin contabilizar en Clay
                      </span>
                      <button onClick={() => setBuscandoEnId(null)} className="text-slate-400 hover:text-slate-700">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 mr-0.5">Filtros:</span>
                      <ChipFiltro
                        activo={filtros.rut}
                        label={filtros.rut ? `RUT ${rutProveedor || 'del proveedor'}` : 'RUT del proveedor'}
                        disabled={buscandoFacturas}
                        onToggle={() => setFiltros((f) => ({ ...f, rut: !f.rut }))}
                      />
                      <ChipFiltro
                        activo={filtros.monto}
                        label={
                          filtros.monto && sugerenciasData
                            ? `Monto ±${Math.round(sugerenciasData.filtros.toleranciaMonto * 100)}% de ${formatCLP(sugerenciasData.pendienteFacturar)}`
                            : 'Monto similar'
                        }
                        disabled={buscandoFacturas}
                        onToggle={() => setFiltros((f) => ({ ...f, monto: !f.monto }))}
                      />
                    </div>

                    {buscandoFacturas && (
                      <div className="p-6 flex items-center justify-center text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}

                    {errorSugerencias && !buscandoFacturas && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {(errorSugerencias as any)?.response?.data?.error || 'Error consultando Clay.'}
                      </div>
                    )}

                    {sugerenciasData && !buscandoFacturas && sugerenciasData.sugeridas.length === 0 && (
                      <p className="text-xs text-slate-400 px-1 py-3">
                        No hay facturas sin contabilizar {filtros.rut ? 'de este proveedor ' : ''}
                        {filtros.monto ? 'por un monto similar ' : ''}en el rango de fechas de la OC.
                        {(filtros.rut || filtros.monto) && ' Prueba quitando un filtro.'}
                      </p>
                    )}

                    {!buscandoFacturas &&
                      sugerenciasData?.sugeridas.map((s) => (
                        <div
                          key={s.factura.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-200 flex-wrap"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 text-xs flex-wrap">
                            <span className="font-mono font-bold text-slate-700 shrink-0">Folio {s.factura.number}</span>
                            <span className="text-slate-400 shrink-0">{formatFecha(s.factura.issue_date)}</span>
                            <span className="text-slate-500 truncate">{s.factura.issuer.company_name}</span>
                            {!s.mismoProveedor && (
                              <Badge variant="warning" size="sm">
                                Otro RUT
                              </Badge>
                            )}
                            <Badge variant={s.cuadra ? 'success' : 'subtle'} size="sm">
                              {s.cuadra ? 'Calza con la OC' : `Difiere ${formatCLP(s.diferenciaVsOC)}`}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-semibold text-slate-800">
                              {formatCLP(s.netoFactura)} <span className="text-slate-400 font-normal">neto</span>
                            </span>
                            <Button
                              size="sm"
                              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              onClick={() =>
                                setCheckout({
                                  ordenCompraId: oc.id,
                                  ordenCompraNumero: oc.numero,
                                  clayTransactionId: s.factura.id,
                                  permitirOtroRut: !s.mismoProveedor,
                                })
                              }
                            >
                              Conciliar
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="px-4 py-2.5 border-t border-slate-50">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Search className="w-3.5 h-3.5" />}
                      disabled={sinTokenClay}
                      onClick={() => abrirBusqueda(oc.id)}
                    >
                      Buscar factura en Clay
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {checkout && (
        <CheckoutFacturaModal
          {...checkout}
          onClose={() => setCheckout(null)}
          onConciliada={() => {
            setCheckout(null);
            setBuscandoEnId(null);
          }}
        />
      )}
    </div>
  );
};
