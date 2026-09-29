import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, AlertCircle, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getCheckoutFactura, vincularFactura } from '../../api/client';
import { ESTADO_OC_LABEL } from '../abastecimiento/OrdenesCompraList';

const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { timeZone: 'UTC' });

interface CheckoutFacturaModalProps {
  ordenCompraId: string;
  ordenCompraNumero: string;
  clayTransactionId: string;
  // La factura es de otro RUT que el proveedor de la OC (se busco sin el
  // filtro de RUT) -- el backend lo exige explicito para aceptarla.
  permitirOtroRut: boolean;
  onClose: () => void;
  onConciliada: () => void;
}

// "Checkout" de la conciliacion: antes de escribir nada, muestra la
// factura, como queda la OC y el asiento EXACTO que se va a crear en Clay
// (cuenta contable y centro de costo por linea). Confirmar contabiliza en
// Clay con el token del usuario y vincula la factura a la OC.
export const CheckoutFacturaModal: React.FC<CheckoutFacturaModalProps> = ({
  ordenCompraId,
  ordenCompraNumero,
  clayTransactionId,
  permitirOtroRut,
  onClose,
  onConciliada,
}) => {
  const queryClient = useQueryClient();
  const [ajustarOC, setAjustarOC] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: errorCheckout } = useQuery({
    queryKey: ['checkoutFactura', ordenCompraId, clayTransactionId, permitirOtroRut],
    queryFn: () => getCheckoutFactura(ordenCompraId, clayTransactionId, permitirOtroRut),
    // Siempre fresco: es lo que se va a escribir en Clay.
    staleTime: 0,
    gcTime: 0,
  });

  const mutation = useMutation({
    mutationFn: () => vincularFactura(ordenCompraId, { clayTransactionId, ajustarOC, permitirOtroRut }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['facturasSugeridas'] });
      onConciliada();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo conciliar la factura.'),
  });

  const asiento = data?.asiento;
  const totalDebe = asiento?.lineas.reduce((s, l) => s + l.debe, 0) ?? 0;
  const totalHaber = asiento?.lineas.reduce((s, l) => s + l.haber, 0) ?? 0;
  const bloqueado = !data || (asiento?.errores.length ?? 0) > 0;
  const estadoFinal = data ? (data.cuadra || ajustarOC ? 'CONCILIADA' : data.estadoResultante) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={mutation.isPending ? undefined : onClose}
    >
      <div
        className="w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Conciliar factura con OC {ordenCompraNumero}</h2>
              <p className="text-[11px] text-slate-500">Revisa el asiento que se creará en Clay antes de confirmar.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {isLoading && (
            <div className="p-10 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

          {errorCheckout && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {(errorCheckout as any)?.response?.data?.error || 'No se pudo preparar la conciliación.'}
            </div>
          )}

          {data && asiento && (
            <>
              {/* Factura */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Factura en Clay</h3>
                <div className="p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="col-span-2">
                    <span className="block text-[11px] text-slate-400">Emisor</span>
                    <span className="font-semibold text-slate-800">{data.factura.issuer.company_name}</span>
                    <span className="text-slate-400">
                      {' '}
                      · {data.factura.issuer.rut}-{data.factura.issuer.dv}
                    </span>
                    {!data.mismoProveedor && (
                      <Badge variant="warning" size="sm" className="ml-1.5">
                        Otro RUT que el proveedor de la OC
                      </Badge>
                    )}
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400">Folio</span>
                    <span className="font-mono font-semibold text-slate-800">{data.factura.number}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400">Fecha</span>
                    <span className="font-semibold text-slate-800">{formatFecha(data.factura.issue_date)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400">Neto</span>
                    <span className="font-mono font-semibold text-slate-800">{formatCLP(data.netoFactura)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400">IVA</span>
                    <span className="font-mono text-slate-700">{formatCLP(data.factura.total.vat)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400">Total</span>
                    <span className="font-mono font-bold text-slate-900">{formatCLP(data.factura.total.total)}</span>
                  </div>
                </div>
              </section>

              {/* Cuadre con la OC */}
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cuadre con la OC (montos netos)</h3>
                <div className="p-3 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-400">Total OC</span>
                      <span className="font-mono font-semibold text-slate-800">{formatCLP(data.totalOC)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Ya facturado</span>
                      <span className="font-mono text-slate-700">{formatCLP(data.facturadoPrevio)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Facturado con esta</span>
                      <span className="font-mono font-semibold text-slate-800">{formatCLP(data.facturadoTotal)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400">Diferencia</span>
                      <span className={`font-mono font-bold ${data.cuadra ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {data.diferencia > 0 ? '+' : ''}
                        {formatCLP(data.diferencia)}
                      </span>
                    </div>
                  </div>

                  {data.cuadra ? (
                    <p className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> La factura cuadra con la OC.
                    </p>
                  ) : (
                    <label className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ajustarOC}
                        onChange={(e) => setAjustarOC(e.target.checked)}
                        className="mt-0.5 accent-[#E34A26]"
                      />
                      <span className="text-amber-900">
                        <strong>Ajustar la OC al monto facturado</strong> -- los precios de la OC se escalan proporcionalmente de{' '}
                        {formatCLP(data.totalOC)} a {formatCLP(data.facturadoTotal)}. Sin ajuste, la OC queda parcialmente conciliada (se
                        puede ajustar o completar con otra factura después).
                      </span>
                    </label>
                  )}

                  {estadoFinal && (
                    <p className="text-slate-600">
                      La OC quedará:{' '}
                      <Badge variant={estadoFinal === 'CONCILIADA' ? 'success' : 'warning'} size="sm">
                        {ESTADO_OC_LABEL[estadoFinal]}
                      </Badge>
                    </p>
                  )}
                </div>
              </section>

              {/* Asiento */}
              <section className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Asiento que se creará en Clay</h3>
                  <span className="text-[11px] text-slate-400">
                    Fecha contable {formatFecha(asiento.fecha)} · {asiento.glosa}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="px-3 py-2 font-bold">Cuenta contable</th>
                        <th className="px-3 py-2 font-bold">Centro de costo</th>
                        <th className="px-3 py-2 font-bold text-right">Debe</th>
                        <th className="px-3 py-2 font-bold text-right">Haber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asiento.lineas.map((l) => (
                        <tr key={`${l.cuenta}-${l.debe}-${l.haber}`} className="border-b border-slate-50">
                          <td className="px-3 py-2">
                            <span className="font-mono text-slate-500">{l.cuenta}</span>{' '}
                            <span className="font-semibold text-slate-800">{l.nombreCuenta}</span>
                            {l.partidas.length > 0 && <span className="block text-[11px] text-slate-400">Partida: {l.partidas.join(', ')}</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{l.centroCosto || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-800">{l.debe ? formatCLP(l.debe) : ''}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-800">{l.haber ? formatCLP(l.haber) : ''}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50/70 font-bold">
                        <td className="px-3 py-2 text-slate-600" colSpan={2}>
                          Totales
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{formatCLP(totalDebe)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{formatCLP(totalHaber)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {asiento.advertencias.map((a) => (
                  <div key={a} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {a}
                  </div>
                ))}
                {asiento.errores.map((e) => (
                  <div key={e} className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {e}
                  </div>
                ))}
              </section>
            </>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={bloqueado}
            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            Conciliar y contabilizar en Clay
          </Button>
        </div>
      </div>
    </div>
  );
};
