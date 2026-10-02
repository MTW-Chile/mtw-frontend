import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, AlertCircle, AlertTriangle, Loader2, CheckCircle2, Plus, Trash2, Upload, FileCode2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getCheckoutFactura, vincularFactura, importarXmlFactura } from '../../api/client';
import { ESTADO_OC_LABEL } from '../abastecimiento/OrdenesCompraList';
import type { ItemOCCheckout, ClayDteLinea } from '../../types';

const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { timeZone: 'UTC' });

// Browser-only (sin Buffer): base64 en chunks para no reventar el stack con
// String.fromCharCode(...bytes) en un XML grande (tope 1MB, pero igual).
function arrayBufferABase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binario);
}

interface VinculoEditable {
  ordenCompraItemId: string;
  // Texto libre -- NO es un indice de una linea de Clay (varias facturas
  // reales no traen ningun detalle en Clay). Una linea de Clay, cuando
  // existe, es solo un atajo para copiar descripcion/cantidad/monto aca.
  descripcion: string;
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
  const [modo, setModo] = useState<'item' | 'monto'>('item');
  const [ajustarOC, setAjustarOC] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vinculos, setVinculos] = useState<VinculoEditable[]>([]);
  // itemsOC/lineasFactura empiezan con lo que trae el checkout (desde
  // Clay), pero se reemplazan enteros si se importa un XML (fuente mas
  // confiable -- ver importarXmlMutation).
  const [fuente, setFuente] = useState<{ itemsOC: ItemOCCheckout[]; lineasFactura: ClayDteLinea[] } | null>(null);
  const [xmlNombre, setXmlNombre] = useState<string | null>(null);
  const inicializado = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setFuente({ itemsOC: data.itemsOC, lineasFactura: data.lineasFactura });
      setVinculos(data.sugerencias.map((s) => ({ ordenCompraItemId: s.ordenCompraItemId, descripcion: s.descripcion, cantidad: s.cantidad, monto: s.monto })));
    }
  }, [data]);

  const importarXmlMutation = useMutation({
    mutationFn: async (file: File) => {
      const buffer = await file.arrayBuffer();
      return { file, resp: await importarXmlFactura(ordenCompraId, clayTransactionId, arrayBufferABase64(buffer), permitirOtroRut) };
    },
    onSuccess: ({ file, resp }) => {
      setFuente({ itemsOC: resp.itemsOC, lineasFactura: resp.lineasFactura });
      setVinculos(resp.sugerencias.map((s) => ({ ordenCompraItemId: s.ordenCompraItemId, descripcion: s.descripcion, cantidad: s.cantidad, monto: s.monto })));
      setXmlNombre(file.name);
      setError(null);
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo leer el XML.'),
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (modo === 'monto') {
        return vincularFactura(ordenCompraId, { clayTransactionId, modo: 'monto', ajustarOC, permitirOtroRut });
      }
      const items = vinculos
        .filter((v) => v.ordenCompraItemId && v.descripcion.trim() && v.cantidad > 0 && v.monto > 0)
        .map((v) => ({ ordenCompraItemId: v.ordenCompraItemId, descripcion: v.descripcion.trim(), cantidad: v.cantidad, monto: v.monto }));
      return vincularFactura(ordenCompraId, { clayTransactionId, modo: 'item', items, ajustarOC, permitirOtroRut });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['facturasSugeridas'] });
      onConciliada();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo conciliar la factura.'),
  });

  const itemsOC = fuente?.itemsOC ?? [];
  const lineasFactura = fuente?.lineasFactura ?? [];
  const vinculosValidos = vinculos.filter((v) => v.ordenCompraItemId && v.descripcion.trim() && v.cantidad > 0 && v.monto > 0);
  const cantidadUsadaPorItem = new Map<string, number>();
  for (const v of vinculosValidos) {
    cantidadUsadaPorItem.set(v.ordenCompraItemId, (cantidadUsadaPorItem.get(v.ordenCompraItemId) ?? 0) + v.cantidad);
  }
  const itemsPendientes = itemsOC.filter((i) => i.pendienteCantidad - (cantidadUsadaPorItem.get(i.id) ?? 0) > 0.001);

  const actualizarVinculo = (idx: number, cambios: Partial<VinculoEditable>) => {
    setVinculos((prev) => {
      const next = [...prev];
      const actual = { ...next[idx], ...cambios };
      // Al elegir un item nuevo, prellenar cantidad (y descripcion, si
      // todavia estaba vacia) con lo pendiente -- la persona lo puede
      // seguir editando a mano.
      if (cambios.ordenCompraItemId !== undefined) {
        const item = itemsOC.find((i) => i.id === cambios.ordenCompraItemId);
        if (item) {
          actual.cantidad = item.pendienteCantidad;
          if (!actual.descripcion.trim()) actual.descripcion = item.descripcion;
        }
      }
      next[idx] = actual;
      return next;
    });
  };

  // Atajo: copiar descripcion/cantidad/monto de una linea real de Clay a
  // un vinculo -- no "consume" la linea (Clay no es una fuente confiable
  // de a cuanto suma cada una, ver comentario grande en sugerirVinculos()
  // del backend), asi que la misma linea se puede copiar mas de una vez.
  const copiarDeLinea = (idx: number, facturaLineaIndex: number) => {
    const linea = lineasFactura.find((l) => l.indice === facturaLineaIndex);
    if (linea) actualizarVinculo(idx, { descripcion: linea.descripcion, cantidad: linea.cantidad ?? vinculos[idx].cantidad, monto: linea.monto });
  };

  const quitarVinculo = (idx: number) => setVinculos((prev) => prev.filter((_, i) => i !== idx));
  const agregarVinculo = () => setVinculos((prev) => [...prev, { ordenCompraItemId: '', descripcion: '', cantidad: 0, monto: 0 }]);

  const asiento = data?.asiento;
  const totalDebe = asiento?.lineas.reduce((s, l) => s + l.debe, 0) ?? 0;
  const totalHaber = asiento?.lineas.reduce((s, l) => s + l.haber, 0) ?? 0;
  // modo "monto": mismo criterio de antes de la conciliacion item a item
  // (cuadra el total, o se fuerza con el ajuste). modo "item": cobertura
  // real por item, calculada en vivo mientras se edita.
  const estadoFinal = !data
    ? null
    : modo === 'monto'
      ? data.cuadra || ajustarOC
        ? 'CONCILIADA'
        : 'PARCIALMENTE_CONCILIADA'
      : simularEstadoLocal(itemsOC, vinculos) === 'completa'
        ? 'CONCILIADA'
        : 'PARCIALMENTE_CONCILIADA';
  const bloqueado = !data || (asiento?.errores.length ?? 0) > 0 || (modo === 'item' && vinculosValidos.length === 0);

  const onArchivoXml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo despues
    if (file) {
      setError(null);
      importarXmlMutation.mutate(file);
    }
  };

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

              {/* Modo de conciliación */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 w-fit">
                <button
                  onClick={() => setModo('item')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    modo === 'item' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Por ítem (XML)
                </button>
                <button
                  onClick={() => setModo('monto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    modo === 'monto' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Por monto
                </button>
              </div>

              {modo === 'item' && (
              <>
              {/* Vinculación item a item */}
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vinculación con la factura</h3>
                  <span className="text-[11px] text-slate-400">Sugerido por monto -- revisa y ajusta antes de confirmar.</span>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
                  <input ref={fileInputRef} type="file" accept=".xml,text/xml,application/xml" onChange={onArchivoXml} className="hidden" />
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={importarXmlMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    disabled={importarXmlMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Importar XML del SII
                  </Button>
                  {xmlNombre ? (
                    <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                      <FileCode2 className="w-3.5 h-3.5" /> {xmlNombre}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Sube el XML original del documento para traer sus líneas reales.
                    </span>
                  )}
                </div>

                {lineasFactura.length === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    Todavía no hay detalle línea a línea de esta factura (ni en Clay ni importado). Completa la descripción y el monto de
                    cada vínculo a mano, usando la factura real (PDF/papel) como referencia, o importa el XML de arriba -- se prellenó un
                    vínculo por cada ítem pendiente de la OC, al precio comprometido, como punto de partida.
                  </p>
                )}

                {vinculos.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 rounded-xl border border-dashed border-slate-200">
                    No hay ningún vínculo todavía. Agrega uno a mano.
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {vinculos.map((v, idx) => {
                      const opcionesItem = itemsOC.filter(
                        (i) => i.id === v.ordenCompraItemId || i.pendienteCantidad - (cantidadUsadaPorItem.get(i.id) ?? 0) > 0.001
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
                          <input
                            type="text"
                            value={v.descripcion}
                            onChange={(e) => actualizarVinculo(idx, { descripcion: e.target.value })}
                            placeholder="Descripción"
                            className="flex-1 min-w-[140px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white"
                          />
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
                          {lineasFactura.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => e.target.value && copiarDeLinea(idx, Number(e.target.value))}
                              className="w-full rounded-lg border border-dashed border-slate-200 px-2 py-1 text-[11px] bg-slate-50 text-slate-500"
                            >
                              <option value="">Copiar de una línea de Clay...</option>
                              {lineasFactura.map((l) => (
                                <option key={l.indice} value={l.indice}>
                                  {l.descripcion} ({formatCLP(l.monto)}){!l.reconocida ? ' ⚠' : ''}
                                </option>
                              ))}
                            </select>
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
              </section>
              </>
              )}

              {modo === 'monto' && (
                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  Conciliación por monto total -- sin vínculo item a item. Compara el neto de la factura contra el neto de la OC completa
                  (mismo mecanismo de antes).
                </p>
              )}

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
