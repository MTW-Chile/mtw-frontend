import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Receipt, AlertCircle, AlertTriangle, Loader2, CheckCircle2, Upload, FileCode2, Wand2, Hash } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getCheckoutFactura, vincularFactura, importarXmlFactura } from '../../api/client';
import { ESTADO_OC_LABEL } from '../abastecimiento/OrdenesCompraList';
import type { ItemOCCheckout, ClayDteLinea, VinculoSugerido } from '../../types';

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

type FuenteFila = 'ninguna' | 'xml' | 'manual';

// Una fila por item PENDIENTE de la OC (no una lista libre de "vinculos") --
// cantidad es editable (recepcion/facturacion parcial), y se empareja con a
// lo sumo una linea de la factura (del XML importado, o de Clay si no se
// importo nada) o con una entrada manual.
interface FilaConciliacion {
  ordenCompraItemId: string;
  cantidad: number;
  fuente: FuenteFila;
  facturaLineaIndex: number | null;
  descripcionManual: string;
  montoManual: number;
}

function filasIniciales(itemsOC: ItemOCCheckout[]): FilaConciliacion[] {
  return itemsOC
    .filter((i) => i.pendienteCantidad > 0.001)
    .map((i) => ({
      ordenCompraItemId: i.id,
      cantidad: i.pendienteCantidad,
      fuente: 'ninguna' as const,
      facturaLineaIndex: null,
      descripcionManual: '',
      montoManual: 0,
    }));
}

// Descripcion/monto que efectivamente se van a mandar para esta fila, segun
// su fuente -- null si todavia no tiene con que emparejarse.
function resolverFila(fila: FilaConciliacion, lineasFactura: ClayDteLinea[]): { descripcion: string; monto: number } | null {
  if (fila.fuente === 'xml' && fila.facturaLineaIndex != null) {
    const linea = lineasFactura.find((l) => l.indice === fila.facturaLineaIndex);
    return linea ? { descripcion: linea.descripcion, monto: linea.monto } : null;
  }
  if (fila.fuente === 'manual') {
    return fila.descripcionManual.trim() && fila.montoManual > 0 ? { descripcion: fila.descripcionManual.trim(), monto: fila.montoManual } : null;
  }
  return null;
}

// Cobertura resultante si se aplicaran estos pares -- mismo criterio que
// simularCobertura() en mtw-api/src/index.ts, hecho aca en vivo para que la
// persona vea el estado final mientras edita (el que devuelve el checkout
// es solo un preview con las sugerencias por defecto).
function calcularEstado(itemsOC: ItemOCCheckout[], pares: { ordenCompraItemId: string; cantidad: number }[]): 'completa' | 'parcial' | 'sinCambios' {
  const propuestoPorItem = new Map<string, number>();
  for (const p of pares) propuestoPorItem.set(p.ordenCompraItemId, (propuestoPorItem.get(p.ordenCompraItemId) ?? 0) + p.cantidad);
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
  const [filas, setFilas] = useState<FilaConciliacion[]>([]);
  const [sugerencias, setSugerencias] = useState<VinculoSugerido[]>([]);
  const [sugerenciasPorCodigo, setSugerenciasPorCodigo] = useState<VinculoSugerido[]>([]);
  // itemsOC/lineasFactura empiezan con lo que trae el checkout (desde
  // Clay), pero se reemplazan enteras si se importa un XML (fuente mas
  // confiable -- ver importarXmlMutation).
  const [fuenteDatos, setFuenteDatos] = useState<{ itemsOC: ItemOCCheckout[]; lineasFactura: ClayDteLinea[] } | null>(null);
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

  // Carga inicial: una fila por item pendiente, SIN aplicar sugerencias --
  // la persona las pide a mano con el botón "Sugerir por monto".
  useEffect(() => {
    if (data && !inicializado.current) {
      inicializado.current = true;
      setFuenteDatos({ itemsOC: data.itemsOC, lineasFactura: data.lineasFactura });
      setFilas(filasIniciales(data.itemsOC));
      setSugerencias(data.sugerencias);
      setSugerenciasPorCodigo(data.sugerenciasPorCodigo);
    }
  }, [data]);

  const importarXmlMutation = useMutation({
    mutationFn: async (file: File) => {
      const buffer = await file.arrayBuffer();
      return { file, resp: await importarXmlFactura(ordenCompraId, clayTransactionId, arrayBufferABase64(buffer), permitirOtroRut) };
    },
    onSuccess: ({ file, resp }) => {
      setFuenteDatos({ itemsOC: resp.itemsOC, lineasFactura: resp.lineasFactura });
      // Los indices de linea de antes (si habia) ya no son validos contra
      // este nuevo set de lineas -- se resetean las filas.
      setFilas(filasIniciales(resp.itemsOC));
      setSugerencias(resp.sugerencias);
      setSugerenciasPorCodigo(resp.sugerenciasPorCodigo);
      setXmlNombre(file.name);
      setError(null);
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo leer el XML.'),
  });

  const itemsOC = fuenteDatos?.itemsOC ?? [];
  const lineasFactura = fuenteDatos?.lineasFactura ?? [];

  const itemsParaEnviar = filas
    .map((fila) => {
      const resuelto = resolverFila(fila, lineasFactura);
      if (!resuelto || !(fila.cantidad > 0)) return null;
      return { ordenCompraItemId: fila.ordenCompraItemId, descripcion: resuelto.descripcion, cantidad: fila.cantidad, monto: resuelto.monto };
    })
    .filter((x): x is { ordenCompraItemId: string; descripcion: string; cantidad: number; monto: number } => x !== null);

  const mutation = useMutation({
    mutationFn: () => {
      if (modo === 'monto') {
        return vincularFactura(ordenCompraId, { clayTransactionId, modo: 'monto', ajustarOC, permitirOtroRut });
      }
      return vincularFactura(ordenCompraId, { clayTransactionId, modo: 'item', items: itemsParaEnviar, ajustarOC, permitirOtroRut });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['facturasSugeridas'] });
      onConciliada();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo conciliar la factura.'),
  });

  const actualizarFila = (idx: number, cambios: Partial<FilaConciliacion>) => {
    setFilas((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...cambios };
      return next;
    });
  };

  // "Sugerir por monto" / "Sugerir por códigos": aplica el set de
  // sugerencias elegido sobre las filas actuales -- accion explicita, no
  // automatica, para no pisar lo que la persona ya haya tocado sin avisar.
  // Por monto cae a "1 vinculo por item pendiente al precio comprometido"
  // cuando no hay ninguna linea reconocida; por codigo solo sugiere cuando
  // encuentra un match de codigo (ver sugerirVinculosPorCodigo en el
  // backend) -- puede no sugerir nada si ningun codigo matchea.
  const aplicarSugerencias = (lista: VinculoSugerido[]) => {
    setFilas((prev) =>
      prev.map((fila) => {
        const sug = lista.find((s) => s.ordenCompraItemId === fila.ordenCompraItemId);
        if (!sug) return fila;
        return sug.facturaLineaIndex != null
          ? { ...fila, cantidad: sug.cantidad, fuente: 'xml', facturaLineaIndex: sug.facturaLineaIndex, descripcionManual: '', montoManual: 0 }
          : { ...fila, cantidad: sug.cantidad, fuente: 'manual', facturaLineaIndex: null, descripcionManual: sug.descripcion, montoManual: sug.monto };
      })
    );
  };

  const lineasSinUsar = lineasFactura.filter((l) => !filas.some((f) => f.fuente === 'xml' && f.facturaLineaIndex === l.indice));
  const totalComprometido = filas.reduce((s, f) => {
    const item = itemsOC.find((i) => i.id === f.ordenCompraItemId);
    return s + f.cantidad * Number(item?.precioUnitario ?? 0);
  }, 0);
  const totalFacturado = itemsParaEnviar.reduce((s, i) => s + i.monto, 0);
  // Solo lo efectivamente emparejado (a diferencia de totalComprometido de
  // arriba, que incluye items sin seleccionar todavia con su cantidad
  // pendiente por defecto) -- esto es lo que va al resumen de abajo.
  const comprometidoPareado = itemsParaEnviar.reduce((s, i) => {
    const item = itemsOC.find((x) => x.id === i.ordenCompraItemId);
    return s + i.cantidad * Number(item?.precioUnitario ?? 0);
  }, 0);
  const facturadoPareado = totalFacturado;
  const itemsSinParear = filas
    .map((f) => {
      const item = itemsOC.find((i) => i.id === f.ordenCompraItemId);
      if (!item) return null;
      const parejado = resolverFila(f, lineasFactura) ? f.cantidad : 0;
      const restante = item.pendienteCantidad - parejado;
      return restante > 0.001 ? { item, restante } : null;
    })
    .filter((x): x is { item: ItemOCCheckout; restante: number } => x !== null);

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
      : calcularEstado(itemsOC, itemsParaEnviar) === 'completa'
        ? 'CONCILIADA'
        : 'PARCIALMENTE_CONCILIADA';
  const bloqueado = !data || (asiento?.errores.length ?? 0) > 0 || (modo === 'item' && itemsParaEnviar.length === 0);

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
        className="w-full sm:max-w-5xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
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
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vinculación con la factura</h3>

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
                      <Button size="sm" variant="ghost" leftIcon={<Wand2 className="w-3.5 h-3.5" />} onClick={() => aplicarSugerencias(sugerencias)}>
                        Sugerir por monto
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Hash className="w-3.5 h-3.5" />}
                        onClick={() => aplicarSugerencias(sugerenciasPorCodigo)}
                        title="Compara el código del proveedor en la factura contra el código interno de cada item -- no es una regla fija, solo prueba coincidencias."
                      >
                        Sugerir por códigos
                      </Button>
                      {xmlNombre ? (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                          <FileCode2 className="w-3.5 h-3.5" /> {xmlNombre}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Sube el XML original del documento para traer sus líneas reales.</span>
                      )}
                    </div>

                    {lineasFactura.length === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        Todavía no hay detalle línea a línea de esta factura (ni en Clay ni importado). Importa el XML de arriba, o completa
                        la descripción y el monto de cada fila a mano usando la factura real (PDF/papel) como referencia.
                      </p>
                    )}

                    {filas.length === 0 ? (
                      <p className="text-xs text-slate-400 p-3 rounded-xl border border-dashed border-slate-200">
                        No hay items pendientes de conciliar en esta OC.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-slate-200 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                              <th className="px-3 py-2 font-bold">Item de la OC</th>
                              <th className="px-3 py-2 font-bold text-right">Cantidad</th>
                              <th className="px-3 py-2 font-bold">Línea de la factura</th>
                              <th className="px-3 py-2 font-bold text-right">Cant. factura</th>
                              <th className="px-3 py-2 font-bold text-right">Comprometido</th>
                              <th className="px-3 py-2 font-bold text-right">Facturado</th>
                              <th className="px-3 py-2 font-bold text-right">Dif. %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filas.map((fila, idx) => {
                              const item = itemsOC.find((i) => i.id === fila.ordenCompraItemId);
                              if (!item) return null;
                              const resuelto = resolverFila(fila, lineasFactura);
                              const montoComprometido = fila.cantidad * Number(item.precioUnitario ?? 0);
                              const montoFacturado = resuelto?.monto ?? null;
                              const diffPct = montoFacturado != null && montoComprometido > 0 ? (montoFacturado - montoComprometido) / montoComprometido : null;
                              const usadasPorOtras = new Set(
                                filas.filter((f, i) => i !== idx && f.fuente === 'xml' && f.facturaLineaIndex != null).map((f) => f.facturaLineaIndex)
                              );
                              const lineasDisponibles = lineasFactura.filter((l) => l.indice === fila.facturaLineaIndex || !usadasPorOtras.has(l.indice));
                              const valorSelect = fila.fuente === 'xml' ? String(fila.facturaLineaIndex) : fila.fuente === 'manual' ? 'manual' : '';

                              return (
                                <tr key={fila.ordenCompraItemId} className="border-b border-slate-50 align-top">
                                  <td className="px-3 py-2">
                                    <span className="font-semibold text-slate-800">{item.descripcion}</span>
                                    <span className="block text-[10px] text-slate-400">
                                      {item.codigo && <span className="font-mono">{item.codigo} · </span>}
                                      {item.unidadMedida} · {formatCLP(Number(item.precioUnitario ?? 0))} c/u
                                      {item.pendienteRecepcionar > 0 && <span className="text-amber-600"> · sin recepcionar</span>}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <input
                                      type="number"
                                      value={fila.cantidad || ''}
                                      onChange={(e) => actualizarFila(idx, { cantidad: Number(e.target.value) })}
                                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono text-right"
                                    />
                                  </td>
                                  <td className="px-3 py-2 min-w-[220px]">
                                    <select
                                      value={valorSelect}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '') actualizarFila(idx, { fuente: 'ninguna', facturaLineaIndex: null });
                                        else if (v === 'manual') actualizarFila(idx, { fuente: 'manual', facturaLineaIndex: null });
                                        else actualizarFila(idx, { fuente: 'xml', facturaLineaIndex: Number(v) });
                                      }}
                                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white"
                                    >
                                      <option value="">Sin seleccionar</option>
                                      {lineasDisponibles.map((l) => (
                                        <option key={l.indice} value={l.indice}>
                                          {l.codigo ? `${l.codigo} · ` : ''}
                                          {l.descripcion} ({l.cantidad ?? '—'} · {formatCLP(l.monto)}){!l.reconocida ? ' ⚠' : ''}
                                        </option>
                                      ))}
                                      <option value="manual">Entrada manual...</option>
                                    </select>
                                    {fila.fuente === 'manual' && (
                                      <div className="flex gap-1.5 mt-1.5">
                                        <input
                                          type="text"
                                          value={fila.descripcionManual}
                                          onChange={(e) => actualizarFila(idx, { descripcionManual: e.target.value })}
                                          placeholder="Descripción"
                                          className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                        />
                                        <input
                                          type="number"
                                          value={fila.montoManual || ''}
                                          onChange={(e) => actualizarFila(idx, { montoManual: Number(e.target.value) })}
                                          placeholder="Monto"
                                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-mono text-right"
                                        />
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <input
                                      type="text"
                                      readOnly
                                      value={
                                        fila.fuente === 'xml'
                                          ? (lineasFactura.find((l) => l.indice === fila.facturaLineaIndex)?.cantidad?.toLocaleString('es-CL', {
                                              maximumFractionDigits: 2,
                                            }) ?? '—')
                                          : ''
                                      }
                                      placeholder="—"
                                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-right text-slate-500"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-slate-700">{formatCLP(montoComprometido)}</td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                                    {montoFacturado != null ? formatCLP(montoFacturado) : <span className="text-slate-300">—</span>}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-mono font-bold ${
                                      diffPct == null ? 'text-slate-300' : Math.abs(diffPct) > 0.05 ? 'text-rose-600' : 'text-emerald-700'
                                    }`}
                                  >
                                    {diffPct == null ? '—' : `${diffPct > 0 ? '+' : ''}${(diffPct * 100).toFixed(1)}%`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50/70 font-bold">
                              <td className="px-3 py-2 text-slate-600" colSpan={4}>
                                Totales
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-slate-900">{formatCLP(totalComprometido)}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-900">{formatCLP(totalFacturado)}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}

              {modo === 'monto' && (
                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  Conciliación por monto total, sin vincular ítem a ítem: compara el neto de la factura contra el neto de la OC completa.
                </p>
              )}

              {/* Resumen */}
              <section className="space-y-2">
                {modo === 'monto' ? (
                  <>
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
                        <p className="text-amber-700">El monto total no cuadra exactamente.</p>
                      )}

                      <label className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ajustarOC}
                          onChange={(e) => setAjustarOC(e.target.checked)}
                          className="mt-0.5 accent-[#E34A26]"
                        />
                        <span className="text-slate-700">
                          <strong>Ajustar la OC al monto facturado</strong> -- los precios de la OC se escalan proporcionalmente de{' '}
                          {formatCLP(data.totalOC)} a {formatCLP(data.facturadoTotal)}.
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
                  </>
                ) : (
                  <>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Resumen de la conciliación</h3>
                    <div className="p-3 rounded-xl border border-slate-200 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="block text-[11px] text-slate-400">Comprometido emparejado</span>
                          <span className="font-mono font-semibold text-slate-800">{formatCLP(comprometidoPareado)}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-400">Facturado emparejado</span>
                          <span className="font-mono font-semibold text-slate-800">{formatCLP(facturadoPareado)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-[11px] font-bold text-slate-500 mb-1">Items de la OC pendientes</p>
                          {itemsSinParear.length === 0 ? (
                            <p className="text-[11px] text-slate-400">Todos los items quedan cubiertos con esta factura.</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {itemsSinParear.map(({ item, restante }) => (
                                <li key={item.id} className="flex items-center justify-between gap-2 text-slate-600">
                                  <span className="truncate">{item.descripcion}</span>
                                  <span className="font-mono shrink-0">
                                    {restante.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {item.unidadMedida}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="text-[11px] font-bold text-slate-500 mb-1">Líneas de la factura por asignar</p>
                          {lineasSinUsar.length === 0 ? (
                            <p className="text-[11px] text-slate-400">No quedan líneas sin asignar.</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {lineasSinUsar.map((l) => (
                                <li key={l.indice} className="flex items-center justify-between gap-2 text-slate-600">
                                  <span className="truncate">{l.descripcion}</span>
                                  <span className="font-mono shrink-0">{formatCLP(l.monto)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <label className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ajustarOC}
                          onChange={(e) => setAjustarOC(e.target.checked)}
                          className="mt-0.5 accent-[#E34A26]"
                        />
                        <span className="text-slate-700">
                          <strong>Ajustar precios al monto facturado</strong> -- en los items que queden completos, el precio unitario se
                          actualiza al monto realmente facturado.
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
                  </>
                )}
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
