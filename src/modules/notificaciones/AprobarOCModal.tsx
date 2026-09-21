import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ShoppingCart, Loader2, Check, XCircle, Package } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getOrdenCompraById, updateOrdenCompraEstado } from '../../api/client';
import { CATEGORIA_GASTO_LABEL } from '../abastecimiento/categoriaGasto';
import type { AprobacionPendienteOC } from '../../types';

interface Props {
  item: AprobacionPendienteOC;
  onClose: () => void;
}

const formatoMoneda = (valor: number, moneda: string) =>
  valor.toLocaleString('es-CL', { style: moneda === 'CLP' ? 'currency' : 'decimal', currency: moneda === 'CLP' ? 'CLP' : undefined, maximumFractionDigits: 0 }) +
  (moneda !== 'CLP' ? ` ${moneda}` : '');

/** Detalle de la OC (items, proveedor, total) para aprobar/rechazar sin salir del Centro de Notificaciones. */
export const AprobarOCModal: React.FC<Props> = ({ item, onClose }) => {
  const queryClient = useQueryClient();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const { data: oc, isLoading } = useQuery({
    queryKey: ['ordenCompraDetail', item.ordenCompraId],
    queryFn: () => getOrdenCompraById(item.ordenCompraId),
  });

  const mutation = useMutation({
    mutationFn: (params: { estado: 'APROBADA' | 'RECHAZADA'; motivoRechazo?: string }) =>
      updateOrdenCompraEstado(item.ordenCompraId, params.estado, params.motivoRechazo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      onClose();
    },
  });

  const total = (oc?.items || []).reduce((sum, i) => sum + Number(i.cantidad) * Number(i.precioUnitario), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-slate-900 truncate">{item.numero}</h2>
              <p className="text-[11px] text-slate-500 truncate">{item.proveedorNombre} · {item.obra}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {isLoading || !oc ? (
            <div className="py-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              {oc.comentarios && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
                  <span className="font-bold">Comentarios: </span>
                  {oc.comentarios}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-400 uppercase tracking-wider">
                      <th className="px-3 py-2 font-bold">Item</th>
                      <th className="px-3 py-2 font-bold">Categoría</th>
                      <th className="px-3 py-2 font-bold text-right">Cantidad</th>
                      <th className="px-3 py-2 font-bold text-right">Precio unit.</th>
                      <th className="px-3 py-2 font-bold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oc.items.map((it) => (
                      <tr key={it.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">
                          <span className="flex items-center gap-1.5">
                            {it.materialId && <Package className="w-3 h-3 text-sky-500 shrink-0" />}
                            {it.descripcion}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{CATEGORIA_GASTO_LABEL[it.categoria] || it.categoria}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">
                          {Number(it.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {it.unidadMedida}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">{formatoMoneda(Number(it.precioUnitario), oc.moneda)}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                          {formatoMoneda(Number(it.cantidad) * Number(it.precioUnitario), oc.moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="text-slate-500">Total:</span>
                <span className="font-mono font-black text-slate-900">{formatoMoneda(total, oc.moneda)}</span>
              </div>

              {rechazando && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <label className="block text-[11px] font-bold text-rose-700">Motivo del rechazo</label>
                  <input
                    autoFocus
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: precio fuera de rango, proveedor no homologado..."
                    className="w-full text-xs border border-rose-200 rounded-lg px-3 py-1.5 outline-none focus:border-rose-400 bg-white"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          {rechazando ? (
            <>
              <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setRechazando(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                isLoading={mutation.isPending}
                disabled={!motivo.trim()}
                onClick={() => mutation.mutate({ estado: 'RECHAZADA', motivoRechazo: motivo.trim() })}
              >
                Confirmar rechazo
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="danger" leftIcon={<XCircle className="w-3.5 h-3.5" />} onClick={() => setRechazando(true)}>
                Rechazar
              </Button>
              <Button
                type="button"
                leftIcon={<Check className="w-3.5 h-3.5" />}
                isLoading={mutation.isPending}
                onClick={() => mutation.mutate({ estado: 'APROBADA' })}
              >
                Aprobar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
