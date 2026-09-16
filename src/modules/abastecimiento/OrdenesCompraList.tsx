import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Check, Send, X as XIcon, Ban } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getOrdenesCompra, updateOrdenCompraEstado } from '../../api/client';
import type { EstadoOC, OrdenCompra } from '../../types';
import { NuevaOrdenCompraModal } from './NuevaOrdenCompraModal';

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

  const { data, isLoading } = useQuery({
    queryKey: ['ordenesCompra', { proyectoId, estado: filtroEstado }],
    queryFn: () => getOrdenesCompra({ proyectoId, estado: filtroEstado || undefined, limit: 100 }),
  });

  const transicion = useMutation({
    mutationFn: ({ id, estado, motivo }: { id: string; estado: EstadoOC; motivo?: string }) =>
      updateOrdenCompraEstado(id, estado, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
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
            <table className="w-full text-xs">
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
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{oc.numero}</td>
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
