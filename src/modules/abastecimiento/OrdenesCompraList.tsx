import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Check, Send, X as XIcon, Ban, ChevronDown, ChevronRight, Package, Undo2, FileDown } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getOrdenesCompra, updateOrdenCompraEstado, renderPdf } from '../../api/client';
import { loadImageDataUrl } from '../cotizaciones/lib/pdfTheme';
import type { EstadoOC, OrdenCompra } from '../../types';
import { NuevaOrdenCompraModal } from './NuevaOrdenCompraModal';
import { CATEGORIA_GASTO_LABEL } from './categoriaGasto';
import { buildOrdenCompraHtml } from './ordenCompraPdf';

export const ESTADO_OC_LABEL: Record<EstadoOC, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pend. aprobación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ENVIADA: 'Enviada',
  RECIBIDA_PARCIAL: 'Recibida (parcial)',
  RECIBIDA_TOTAL: 'Recibida (total)',
  CONCILIADA: 'Conciliada',
  CANCELADA: 'Cancelada',
};

export const ESTADO_OC_VARIANT: Record<EstadoOC, BadgeVariant> = {
  BORRADOR: 'subtle',
  PENDIENTE_APROBACION: 'warning',
  APROBADA: 'info',
  RECHAZADA: 'danger',
  ENVIADA: 'brand',
  RECIBIDA_PARCIAL: 'warning',
  RECIBIDA_TOTAL: 'success',
  CONCILIADA: 'success',
  CANCELADA: 'outline',
};

const totalOC = (oc: OrdenCompra) => oc.items.reduce((sum, i) => sum + Number(i.cantidad) * Number(i.precioUnitario), 0);

const formatoMoneda = (valor: number, moneda: string) =>
  valor.toLocaleString('es-CL', { style: moneda === 'CLP' ? 'currency' : 'decimal', currency: moneda === 'CLP' ? 'CLP' : undefined, maximumFractionDigits: 0 }) +
  (moneda !== 'CLP' ? ` ${moneda}` : '');

interface OrdenesCompraListProps {
  // Sin proyectoId: vista global (todas las obras, tab "Abastecimiento").
  // Con proyectoId: vista de la ficha de proyecto -- filtra, oculta la
  // columna Obra, y la Nueva OC ya viene con el proyecto fijo.
  proyectoId?: string;
  proyectoLabel?: string;
}

export const OrdenesCompraList: React.FC<OrdenesCompraListProps> = ({ proyectoId, proyectoLabel }) => {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<EstadoOC | ''>('');
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [generandoPdfId, setGenerandoPdfId] = useState<string | null>(null);

  const toggleExpandida = (id: string) =>
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Mismo documento que se le manda al proveedor al marcarla "Enviada" --
  // no hay un archivo guardado aparte, se arma al vuelo con los datos
  // actuales de la OC cada vez que se pide (igual patron que el PDF de
  // Presupuesto, ver PresupuestoOferta.tsx).
  const descargarPdf = async (oc: OrdenCompra) => {
    setGenerandoPdfId(oc.id);
    try {
      let logoDataUrl: string | null = null;
      try {
        logoDataUrl = await loadImageDataUrl('/mtw-logo.png');
      } catch {
        // Decorativo -- si falla la carga, el PDF sigue sin el logo.
      }
      const html = buildOrdenCompraHtml(oc, logoDataUrl);
      const filename = `${oc.numero}.pdf`;
      const blob = await renderPdf(html, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      window.alert(`No se pudo generar el PDF: ${error?.message || error}`);
    } finally {
      setGenerandoPdfId(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['ordenesCompra', { proyectoId, estado: filtroEstado }],
    queryFn: () => getOrdenesCompra({ proyectoId, estado: filtroEstado || undefined, limit: 100 }),
  });

  const transicion = useMutation({
    mutationFn: ({ id, estado, motivo }: { id: string; estado: EstadoOC; motivo?: string }) =>
      updateOrdenCompraEstado(id, estado, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      // Puede crear (Solicitar aprobación) o resolver (Aprobar/Rechazar) un
      // pendiente gerencial -- se invalida para que la campanita/Centro de
      // Notificaciones se actualicen al toque, sin esperar el proximo poll.
      queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
      setRechazandoId(null);
      setMotivoRechazo('');
    },
  });

  const ordenes = data?.data || [];
  const colSpan = proyectoId ? 6 : 7;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFiltroEstado('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filtroEstado === '' ? 'bg-[#E34A26]/10 text-[#E34A26] border-[#E34A26]/20' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todas
          </button>
          {(Object.keys(ESTADO_OC_LABEL) as EstadoOC[]).map((estado) => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filtroEstado === estado ? 'bg-[#E34A26]/10 text-[#E34A26] border-[#E34A26]/20' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {ESTADO_OC_LABEL[estado]}
            </button>
          ))}
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalAbierto(true)}>
          Nueva OC
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : ordenes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          No hay Órdenes de Compra{filtroEstado ? ` en estado "${ESTADO_OC_LABEL[filtroEstado]}"` : ''}
          {proyectoId ? ' para este proyecto' : ''} todavía.
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 font-bold">Número</th>
                  {!proyectoId && <th className="px-4 py-3 font-bold">Obra</th>}
                  <th className="px-4 py-3 font-bold">Proveedor</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold text-right">Total</th>
                  <th className="px-4 py-3 font-bold">Creada</th>
                  <th className="px-4 py-3 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((oc) => (
                  <React.Fragment key={oc.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpandida(oc.id)}
                          className="flex items-center gap-1.5 font-mono font-bold text-slate-900 hover:text-[#E34A26] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {expandidas.has(oc.id) ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          {oc.numero}
                        </button>
                      </td>
                      {!proyectoId && <td className="px-4 py-3 text-slate-700">{oc.proyecto?.obra || '—'}</td>}
                      <td className="px-4 py-3 text-slate-700">{oc.proveedor?.nombre || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={ESTADO_OC_VARIANT[oc.estado]} size="sm">
                          {ESTADO_OC_LABEL[oc.estado]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatoMoneda(totalOC(oc), oc.moneda)}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(oc.creadoEn).toLocaleDateString('es-CL')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<FileDown className="w-3.5 h-3.5" />}
                            isLoading={generandoPdfId === oc.id}
                            onClick={() => descargarPdf(oc)}
                          >
                            PDF
                          </Button>
                          {oc.estado === 'BORRADOR' && oc.requiereAprobacion && (
                            <Button
                              size="sm"
                              variant="outline"
                              isLoading={transicion.isPending && transicion.variables?.id === oc.id}
                              onClick={() => transicion.mutate({ id: oc.id, estado: 'PENDIENTE_APROBACION' })}
                            >
                              Solicitar aprobación
                            </Button>
                          )}
                          {oc.estado === 'BORRADOR' && !oc.requiereAprobacion && (
                            <Button
                              size="sm"
                              leftIcon={<Send className="w-3.5 h-3.5" />}
                              isLoading={transicion.isPending && transicion.variables?.id === oc.id}
                              onClick={() => transicion.mutate({ id: oc.id, estado: 'ENVIADA' })}
                            >
                              Enviar
                            </Button>
                          )}
                          {oc.estado === 'PENDIENTE_APROBACION' && (
                            <>
                              <Button
                                size="sm"
                                leftIcon={<Check className="w-3.5 h-3.5" />}
                                isLoading={transicion.isPending && transicion.variables?.id === oc.id}
                                onClick={() => transicion.mutate({ id: oc.id, estado: 'APROBADA' })}
                              >
                                Aprobar
                              </Button>
                              <Button size="sm" variant="danger" leftIcon={<XIcon className="w-3.5 h-3.5" />} onClick={() => setRechazandoId(oc.id)}>
                                Rechazar
                              </Button>
                            </>
                          )}
                          {oc.estado === 'APROBADA' && (
                            <Button
                              size="sm"
                              leftIcon={<Send className="w-3.5 h-3.5" />}
                              isLoading={transicion.isPending && transicion.variables?.id === oc.id}
                              onClick={() => transicion.mutate({ id: oc.id, estado: 'ENVIADA' })}
                            >
                              Enviar
                            </Button>
                          )}
                          {oc.estado === 'ENVIADA' && (
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Undo2 className="w-3.5 h-3.5" />}
                              isLoading={transicion.isPending && transicion.variables?.id === oc.id}
                              onClick={() => {
                                if (window.confirm(`¿Revertir el envío de la OC ${oc.numero}? Vuelve a Borrador para poder editarla y reenviarla.`)) {
                                  transicion.mutate({ id: oc.id, estado: 'BORRADOR' });
                                }
                              }}
                            >
                              Revertir envío
                            </Button>
                          )}
                          {['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA'].includes(oc.estado) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<Ban className="w-3.5 h-3.5" />}
                              isLoading={transicion.isPending && transicion.variables?.id === oc.id}
                              onClick={() => transicion.mutate({ id: oc.id, estado: 'CANCELADA' })}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandidas.has(oc.id) && (
                      <tr className="bg-slate-50/60 border-b border-slate-100">
                        <td colSpan={colSpan} className="px-4 py-3">
                          {oc.comentarios && (
                            <p className="text-[11px] text-slate-600 mb-2 pb-2 border-b border-slate-200">
                              <span className="font-bold text-slate-700">Comentarios: </span>
                              {oc.comentarios}
                            </p>
                          )}
                          {oc.items.length === 0 ? (
                            <p className="text-[11px] text-slate-400">Esta OC no tiene items.</p>
                          ) : (
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-left text-slate-400 uppercase tracking-wider">
                                  <th className="pb-1.5 font-bold">Item</th>
                                  <th className="pb-1.5 font-bold">Categoría</th>
                                  <th className="pb-1.5 font-bold text-right">Cantidad</th>
                                  <th className="pb-1.5 font-bold text-right">Precio unit.</th>
                                  <th className="pb-1.5 font-bold text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {oc.items.map((item) => (
                                  <tr key={item.id} className="border-t border-slate-100/80">
                                    <td className="py-1.5 pr-2 text-slate-700">
                                      <span className="flex items-center gap-1.5">
                                        {item.materialId && <Package className="w-3 h-3 text-sky-500 shrink-0" />}
                                        {item.descripcion}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-2 text-slate-500">{CATEGORIA_GASTO_LABEL[item.categoria] || item.categoria}</td>
                                    <td className="py-1.5 text-right font-mono text-slate-700">
                                      {Number(item.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {item.unidadMedida}
                                      {item.cantidadCalculada != null && (
                                        <span className="block text-[10px] text-slate-400 font-normal">
                                          cálculo: {Number(item.cantidadCalculada).toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-slate-700">
                                      {formatoMoneda(Number(item.precioUnitario), oc.moneda)}
                                    </td>
                                    <td className="py-1.5 text-right font-mono font-semibold text-slate-900">
                                      {formatoMoneda(Number(item.cantidad) * Number(item.precioUnitario), oc.moneda)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                    {rechazandoId === oc.id && (
                      <tr className="bg-rose-50/50 border-b border-rose-100">
                        <td colSpan={colSpan} className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-semibold text-rose-700 shrink-0">Motivo del rechazo:</span>
                            <input
                              autoFocus
                              value={motivoRechazo}
                              onChange={(e) => setMotivoRechazo(e.target.value)}
                              placeholder="Ej: precio fuera de rango, proveedor no homologado..."
                              className="flex-1 text-xs border border-rose-200 rounded-lg px-3 py-1.5 outline-none focus:border-rose-400 bg-white"
                            />
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={!motivoRechazo.trim()}
                              isLoading={transicion.isPending}
                              onClick={() => transicion.mutate({ id: oc.id, estado: 'RECHAZADA', motivo: motivoRechazo.trim() })}
                            >
                              Confirmar rechazo
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRechazandoId(null);
                                setMotivoRechazo('');
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NuevaOrdenCompraModal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        proyectoIdFijo={proyectoId}
        proyectoLabelFijo={proyectoLabel}
      />
    </div>
  );
};
