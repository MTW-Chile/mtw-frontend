import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, AlertCircle, AlertTriangle, Loader2, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getCheckoutFactura, vincularFactura } from '../../api/client';
import { ESTADO_OC_LABEL } from '../abastecimiento/OrdenesCompraList';
import type { ItemOCCheckout } from '../../types';

const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { timeZone: 'UTC' });

interface VinculoEditable {
  ordenCompraItemId: string;
  facturaLineaIndex: number;
  cantidad: number;
  monto: number;
}

// Cobertura resultante si se aplicaran estos vinculos -- mismo criterio que
// simularCobertura() en mtw-api/src/index.ts, hecho aca en vivo para que la
// persona vea el estado final mientras edita (el que devuelve el checkout
// es solo un preview con las sugerencias por defecto).
function simularEstadoLocal(itemsOC: ItemOCCheckout[], vinculos: VinculoEditable[]): 'completa' | 'parcial' | 'sinCambios' {
  const propuestoPorItem = new Map<string, number>();
  for (const v of vinculos) {
    if (!v.ordenCompraItemId || !(v.cantidad > 0)) continue;
    propuestoPorItem.set(v.ordenCompraItemId, (propuestoPorItem.get(v.ordenCompraItemId) ?? 0) + v.cantidad);
  }
  let algoVinculado = false;
  let completa = true;
  for (const item of itemsOC) {
    const propuesto = propuestoPorItem.get(item.id) ?? 0;
    if (propuesto > 0) algoVinculado = true;
    if (item.pendienteCantidad - propuesto > 0.001) completa = false;
  }
  return completa ? 'completa' : algoVinculado ? 'parcial' : 'sinCambios';
}

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
  const [vinculos, setVinculos] = useState<VinculoEditable[]>([]);
  const inicializado = useRef(false);

  const { data, isLoading, error: errorCheckout } = useQuery({
    queryKey: ['checkoutFactura', ordenCompraId, clayTransactionId, permitirOtroRut],
    queryFn: () => getCheckoutFactura(ordenCompraId, clayTransactionId, permitirOtroRut),
    // Siempre fresco: es lo que se va a escribir en Clay.
    staleTime: 0,
    gcTime: 0,
  });

  // Precarga con las sugerencias por monto -- una sola vez (si la query se
  // refresca despues, no se pisan los vinculos que la persona ya edito).
  useEffect(() => {
    if (data && !inicializado.current) {
      inicializado.current = true;
      setVinculos(data.sugerencias.map((s) => ({ ...s })));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
      const items = vinculos.filter((v) => v.ordenCompraItemId && v.facturaLineaIndex != null && v.cantidad > 0 && v.monto > 0);
      return vincularFactura(ordenCompraId, { clayTransactionId, items, ajustarOC, permitirOtroRut });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['facturasSugeridas'] });
      onConciliada();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo conciliar la factura.'),
  });

  const itemsOC = data?.itemsOC ?? [];
  const lineasFactura = data?.lineasFactura ?? [];
  const vinculosValidos = vinculos.filter((v) => v.ordenCompraItemId && v.facturaLineaIndex != null && v.cantidad > 0 && v.monto > 0);
  const cantidadUsadaPorItem = new Map<string, number>();
  const montoUsadoPorLinea = new Map<number, number>();
  for (const v of vinculosValidos) {
    cantidadUsadaPorItem.set(v.ordenCompraItemId, (cantidadUsadaPorItem.get(v.ordenCompraItemId) ?? 0) + v.cantidad);
    montoUsadoPorLinea.set(v.facturaLineaIndex, (montoUsadoPorLinea.get(v.facturaLineaIndex) ?? 0) + v.monto);
  }
  const itemsPendientes = itemsOC.filter((i) => i.pendienteCantidad - (cantidadUsadaPorItem.get(i.id) ?? 0) > 0.001);
  const lineasSinVincular = lineasFactura.filter((l) => l.monto - (montoUsadoPorLinea.get(l.indice) ?? 0) > 1);

  const actualizarVinculo = (idx: number, cambios: Partial<VinculoEditable>) => {
    setVinculos((prev) => {
      const next = [...prev];
      const actual = { ...next[idx], ...cambios };
      // Al elegir item/linea nuevos, prellenar cantidad/monto con lo
      // pendiente -- la persona los puede seguir editando a mano.
      if (cambios.ordenCompraItemId !== undefined) {
        const item = itemsOC.find((i) => i.id === cambios.ordenCompraItemId);
        if (item) actual.cantidad = item.pendienteCantidad;
      }
      if (cambios.facturaLineaIndex !== undefined) {
        const linea = lineasFactura.find((l) => l.indice === cambios.facturaLineaIndex);
        if (linea) actual.monto = linea.monto;
      }
      next[idx] = actual;
      return next;
    });
  };

  const quitarVinculo = (idx: number) => setVinculos((prev) => prev.filter((_, i) => i !== idx));
  const agregarVinculo = () => setVinculos((prev) => [...prev, { ordenCompraItemId: '', facturaLineaIndex: -1, cantidad: 0, monto: 0 }]);

  const asiento = data?.asiento;
  const totalDebe = asiento?.lineas.reduce((s, l) => s + l.debe, 0) ?? 0;
  const totalHaber = asiento?.lineas.reduce((s, l) => s + l.haber, 0) ?? 0;
  const estadoLocal = data ? simularEstadoLocal(itemsOC, vinculos) : 'sinCambios';
  const estadoFinal = data ? (estadoLocal === 'completa' ? 'CONCILIADA' : 'PARCIALMENTE_CONCILIADA') : null;
  const bloqueado = !data || (asiento?.errores.length ?? 0) > 0 || vinculosValidos.length === 0;

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

              {/* Vinculación item a item */}
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vinculación con la factura</h3>
                  <span className="text-[11px] text-slate-400">Sugerido por monto -- revisa y ajusta antes de confirmar.</span>
                </div>

                {vinculos.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 rounded-xl border border-dashed border-slate-200">
                    No se encontró ninguna sugerencia automática. Agrega un vínculo a mano.
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {vinculos.map((v, idx) => {
                      const itemSeleccionado = itemsOC.find((i) => i.id === v.ordenCompraItemId);
                      const lineaSeleccionada = lineasFactura.find((l) => l.indice === v.facturaLineaIndex);
                      const opcionesItem = itemsOC.filter(
                        (i) => i.id === v.ordenCompraItemId || i.pendienteCantidad - (cantidadUsadaPorItem.get(i.id) ?? 0) > 0.001
                      );
                      const opcionesLinea = lineasFactura.filter(
                        (l) => l.indice === v.facturaLineaIndex || l.monto - (montoUsadoPorLinea.get(l.indice) ?? 0) > 1
                      );
                      return (
                        <div key={idx} className="p-2.5 flex items-center gap-2 flex-wrap text-xs">
                          <select
                            value={v.ordenCompraItemId}
                            onChange={(e) => actualizarVinculo(idx, { ordenCompraItemId: e.target.value })}
                            className="flex-1 min-w-[160px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white"
                          >
                            <option value="">Item de la OC...</option>
                            {opcionesItem.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.descripcion} ({i.pendienteCantidad.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {i.unidadMedida} pend.)
                              </option>
                            ))}
                          </select>
                          <span className="text-slate-300">↔</span>
                          <select
                            value={v.facturaLineaIndex}
                            onChange={(e) => actualizarVinculo(idx, { facturaLineaIndex: Number(e.target.value) })}
                            className="flex-1 min-w-[160px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white"
                          >
                            <option value={-1}>Línea de la factura...</option>
                            {opcionesLinea.map((l) => (
                              <option key={l.indice} value={l.indice}>
                                {l.descripcion} ({formatCLP(l.monto)}){!l.reconocida ? ' ⚠' : ''}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={v.cantidad || ''}
                            onChange={(e) => actualizarVinculo(idx, { cantidad: Number(e.target.value) })}
                            placeholder="Cantidad"
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-mono text-right"
                          />
                          <input
                            type="number"
                            value={v.monto || ''}
                            onChange={(e) => actualizarVinculo(idx, { monto: Number(e.target.value) })}
                            placeholder="Monto"
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-mono text-right"
                          />
                          <button
                            onClick={() => quitarVinculo(idx)}
                            title="Quitar vínculo"
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {itemSeleccionado && lineaSeleccionada && !lineaSeleccionada.reconocida && (
                            <p className="w-full text-[11px] text-amber-700">
                              Clay no trajo esta línea en un formato reconocido -- revisa la descripción/monto a mano.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={agregarVinculo}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E34A26] hover:text-[#B8391B]"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar vínculo manual
                </button>

                {(itemsPendientes.length > 0 || lineasSinVincular.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {itemsPendientes.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-[11px] font-bold text-slate-500 mb-1">Items de la OC sin vincular</p>
                        <ul className="space-y-0.5">
                          {itemsPendientes.map((i) => (
                            <li key={i.id} className="text-[11px] text-slate-600 flex items-center justify-between gap-2">
                              <span className="truncate">{i.descripcion}</span>
                              <span className="font-mono shrink-0">
                                {(i.pendienteCantidad - (cantidadUsadaPorItem.get(i.id) ?? 0)).toLocaleString('es-CL', { maximumFractionDigits: 2 })}{' '}
                                {i.unidadMedida}
                                {i.pendienteRecepcionar > 0 && <span className="text-amber-600"> · sin recepcionar</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lineasSinVincular.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-[11px] font-bold text-slate-500 mb-1">Líneas de la factura sin vincular</p>
                        <ul className="space-y-0.5">
                          {lineasSinVincular.map((l) => (
                            <li key={l.indice} className="text-[11px] text-slate-600 flex items-center justify-between gap-2">
                              <span className="truncate">{l.descripcion}</span>
                              <span className="font-mono shrink-0">{formatCLP(l.monto - (montoUsadoPorLinea.get(l.indice) ?? 0))}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
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
                      <CheckCircle2 className="w-3.5 h-3.5" /> El monto total cuadra con la OC.
                    </p>
                  ) : (
                    <p className="text-amber-700">
                      El monto total no cuadra exactamente -- ya no bloquea nada: el estado final de la OC lo decide la vinculación item a
                      item de arriba, no este total.
                    </p>
                  )}

                  <label className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ajustarOC}
                      onChange={(e) => setAjustarOC(e.target.checked)}
                      className="mt-0.5 accent-[#E34A26]"
                    />
                    <span className="text-slate-700">
                      <strong>Ajustar precios al monto vinculado</strong> -- por cada item que quede completo con esta vinculación, su
                      precio unitario se actualiza al monto realmente vinculado (si difiere del comprometido en la OC).
                    </span>
                  </label>

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
