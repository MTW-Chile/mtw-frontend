import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, FileCheck2, AlertCircle, Search, RefreshCw, CheckCircle2, X as XIcon } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getOrdenesCompra, getFacturasSugeridas, vincularFactura, refrescarConciliacion } from '../../api/client';
import type { EstadoConciliacionFactura } from '../../types';

const ESTADO_CUADRE_VARIANT: Record<EstadoConciliacionFactura, BadgeVariant> = {
  PENDIENTE: 'subtle',
  CUADRA: 'success',
  DIFERENCIA: 'danger',
};

const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL');

// "Control de documentos": vincula cada OC ya recibida con su factura RECIBIDA
// real, que vive en Clay (sistema contable) -- mtw-api nunca la genera ni la
// edita. Se busca por RUT del proveedor, se sugiere el mejor calce por
// cercania de monto, y una persona confirma cual es. El estado de pago
// (pagada/montoPagado) tambien viene de Clay -- "Refrescar" lo vuelve a
// consultar (nada lo hace solo todavia, no hay cron ni webhook).
export const ControlDocumentosTab: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const queryClient = useQueryClient();
  const [buscandoEnId, setBuscandoEnId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ordenesCompra', { proyectoId, estado: '' }],
    queryFn: () => getOrdenesCompra({ proyectoId, limit: 200 }),
  });

  const {
    data: sugerenciasData,
    isFetching: buscandoFacturas,
    error: errorSugerencias,
  } = useQuery({
    queryKey: ['facturasSugeridas', buscandoEnId],
    queryFn: () => getFacturasSugeridas(buscandoEnId!),
    enabled: !!buscandoEnId,
  });

  const vincularMutation = useMutation({
    mutationFn: ({ ordenCompraId, clayTransactionId }: { ordenCompraId: string; clayTransactionId: string }) =>
      vincularFactura(ordenCompraId, { clayTransactionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      setBuscandoEnId(null);
      setError(null);
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo vincular la factura.'),
  });

  const refrescarMutation = useMutation({
    mutationFn: (conciliacionId: string) => refrescarConciliacion(conciliacionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo refrescar el estado de pago.'),
  });

  // Solo tiene sentido vincular una OC que ya se recibio (parcial o
  // total) -- antes de eso no hay contra que comparar la factura.
  const ordenes = (data?.data || []).filter((oc) => ['RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'CONCILIADA'].includes(oc.estado));

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-black text-slate-900">Control de documentos</h2>
        <p className="text-xs text-slate-500">
          Vinculación de Órdenes de Compra con la factura real del proveedor en Clay -- se busca por RUT y se sugiere el
          mejor calce, tú confirmas cuál es.
        </p>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {ordenes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          <FileCheck2 className="w-6 h-6 mx-auto mb-2 text-slate-300" />
          Todavía no hay OC recibidas de este proyecto para vincular.
        </div>
      ) : (
        <div className="space-y-3">
          {ordenes.map((oc) => {
            const totalOC = oc.items.reduce((sum, i) => sum + Number(i.cantidad) * Number(i.precioUnitario), 0);
            const conciliaciones = oc.conciliaciones || [];
            const totalFacturado = conciliaciones.reduce((sum, c) => sum + Number(c.montoFactura), 0);
            const totalPagado = conciliaciones.reduce((sum, c) => sum + Number(c.montoPagado), 0);
            const buscandoAqui = buscandoEnId === oc.id;

            return (
              <div key={oc.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap border-b border-slate-50">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-slate-900">{oc.numero}</span>
                    <span className="text-xs text-slate-500">{oc.proveedor?.nombre}</span>
                    <Badge variant={oc.estado === 'CONCILIADA' ? 'success' : 'warning'} size="sm">
                      {oc.estado === 'CONCILIADA' ? 'Conciliada' : 'Recibida'}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600">
                    OC: <span className="font-bold text-slate-900">{formatCLP(totalOC)}</span> · Facturado:{' '}
                    <span className="font-bold text-slate-900">{formatCLP(totalFacturado)}</span> · Pagado:{' '}
                    <span className="font-bold text-emerald-700">{formatCLP(totalPagado)}</span>
                  </div>
                </div>

                {conciliaciones.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {conciliaciones.map((c) => (
                      <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-slate-700">Factura {c.folio}</span>
                          <Badge variant={ESTADO_CUADRE_VARIANT[c.estadoCuadre]} size="sm">
                            {c.estadoCuadre}
                          </Badge>
                          <Badge variant={c.pagada ? 'success' : 'subtle'} size="sm">
                            {c.pagada ? 'Pagada' : 'Pendiente de pago'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-slate-800">
                            {formatCLP(Number(c.montoFactura))}
                            {!c.pagada && Number(c.montoPagado) > 0 && (
                              <span className="text-slate-400 font-normal"> · pagado {formatCLP(Number(c.montoPagado))}</span>
                            )}
                          </span>
                          <button
                            title="Refrescar estado de pago desde Clay"
                            onClick={() => refrescarMutation.mutate(c.id)}
                            disabled={refrescarMutation.isPending}
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
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Facturas sugeridas en Clay</span>
                      <button onClick={() => setBuscandoEnId(null)} className="text-slate-400 hover:text-slate-700">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {buscandoFacturas && (
                      <div className="p-6 flex items-center justify-center text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}

                    {errorSugerencias && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {(errorSugerencias as any)?.response?.data?.error || 'Error consultando Clay.'}
                      </div>
                    )}

                    {sugerenciasData && sugerenciasData.sugeridas.length === 0 && (
                      <p className="text-xs text-slate-400 px-1 py-3">
                        No se encontraron facturas recibidas de este proveedor en Clay en el rango de fechas de la OC.
                      </p>
                    )}

                    {sugerenciasData?.sugeridas.map((s) => (
                      <div
                        key={s.factura.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-200"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 text-xs">
                          <span className="font-mono font-bold text-slate-700 shrink-0">Folio {s.factura.number}</span>
                          <span className="text-slate-400 shrink-0">{formatFecha(s.factura.issue_date)}</span>
                          <span className="text-slate-500 truncate">{s.factura.issuer.company_name}</span>
                          <Badge variant={s.cuadra ? 'success' : 'warning'} size="sm">
                            {s.cuadra ? 'Calza con la OC' : `Difiere ${formatCLP(s.diferenciaVsOC)}`}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-semibold text-slate-800">{formatCLP(s.factura.total.total)}</span>
                          <Button
                            size="sm"
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            isLoading={vincularMutation.isPending && vincularMutation.variables?.clayTransactionId === s.factura.id}
                            onClick={() => vincularMutation.mutate({ ordenCompraId: oc.id, clayTransactionId: s.factura.id })}
                          >
                            Vincular
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
                      onClick={() => {
                        setError(null);
                        setBuscandoEnId(oc.id);
                      }}
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
    </div>
  );
};
