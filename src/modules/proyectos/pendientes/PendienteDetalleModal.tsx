import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, RotateCcw, ShoppingCart, Trash2, X } from 'lucide-react';
import { cambiarEstadoPendiente, editarPendiente, eliminarPendiente, getEtapasPendiente, getPendiente } from '../../../api/client';
import { NuevoAdicionalModal } from '../adicionales/NuevoAdicionalModal';
import { actualizarParams } from '../../../lib/navigation';
import { avisarError } from '../../configuracion/catalogo/comun';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatoFechaHora } from '../fabricacion/utils';
import { AdjuntosDetalle } from './adjuntos/AdjuntosDetalle';
import { NuevaOrdenCompraModal } from '../../abastecimiento/NuevaOrdenCompraModal';
import { usePermisos } from '../../../lib/permisos';
import { ETIQUETA_CARGO, ETIQUETA_NATURALEZA } from '../../../types';
import type { CargoPendiente } from '../../../types';
import {
  ETIQUETA_DESTINO,
  ETIQUETA_ESTADO,
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  codigoPendiente,
  etapasPara,
  referenciaPendiente,
  textoEstadoPendiente,
  textoRectificacion,
  varianteEstadoPendiente,
} from './utils';

interface Props {
  proyectoId: string;
  pendienteId: string;
  onClose: () => void;
}

const Dato: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({ etiqueta, children }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{etiqueta}</dt>
    <dd className="text-xs text-slate-800 mt-0.5 break-words">{children}</dd>
  </div>
);

// Detalle de un pendiente: sus datos, el historial, y las acciones:
//  - cualquier usuario lo toma (EN_CURSO), cambia su etapa o lo devuelve a
//    Ingresado;
//  - resolverlo, reabrirlo o eliminarlo es solo de quien lo creo (es quien
//    debe recibir en obra) o de un administrador -- el servidor lo exige; aca
//    solo se muestra o se deshabilita segun `puedeResolver`.
export const PendienteDetalleModal: React.FC<Props> = ({ proyectoId, pendienteId, onClose }) => {
  const queryClient = useQueryClient();
  const [etapaElegida, setEtapaElegida] = useState('');
  const [comentario, setComentario] = useState('');
  const [comprando, setComprando] = useState(false);
  const [cotizandoAdicional, setCotizandoAdicional] = useState(false);
  const { tiene } = usePermisos();

  const { data: p, isLoading } = useQuery({
    queryKey: ['pendiente', pendienteId],
    queryFn: () => getPendiente(pendienteId),
  });
  const { data: etapas = [] } = useQuery({ queryKey: ['etapasPendiente'], queryFn: () => getEtapasPendiente(), staleTime: 1000 * 60 });

  const cambiarCargo = useMutation({
    mutationFn: (cargoA: CargoPendiente | null) => editarPendiente(pendienteId, { cargoA }),
    onSuccess: () => refrescar(),
    onError: avisarError,
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['pendientes', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['pendiente', pendienteId] });
  };

  const cambiar = useMutation({
    mutationFn: (v: { estado: 'INGRESADO' | 'EN_CURSO' | 'RESUELTO'; etapaId?: string; comentario?: string }) =>
      cambiarEstadoPendiente(pendienteId, v),
    onSuccess: () => {
      setComentario('');
      setEtapaElegida('');
      refrescar();
    },
  });
  const eliminar = useMutation({
    mutationFn: () => eliminarPendiente(pendienteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendientes', proyectoId] });
      onClose();
    },
  });

  const aplicables = p ? etapasPara(etapas, p.destino) : [];
  // Etapa a usar: la elegida, o la actual si ya esta en curso.
  const etapaSeleccionada = etapaElegida || (p?.estado === 'EN_CURSO' ? (p.etapaId ?? '') : '');
  const ocupado = cambiar.isPending || eliminar.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-4">
        {isLoading || !p ? (
          <div className="p-10 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 font-mono">{codigoPendiente(p.numero)}</h3>
                  <Badge size="sm" variant={varianteEstadoPendiente(p.estado)}>
                    {textoEstadoPendiente(p)}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-1 break-words">{p.descripcion}</p>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
              <Dato etiqueta="Qué">{ETIQUETA_TIPO[p.tipo]}</Dato>
              <Dato etiqueta="Motivo">{ETIQUETA_MOTIVO[p.motivo]}</Dato>
              <Dato etiqueta="Área">{ETIQUETA_DESTINO[p.destino]}</Dato>
              <Dato etiqueta="Ventana">{referenciaPendiente(p) || '—'}</Dato>
              <Dato etiqueta="Se necesita para">
                {p.fechaRequerida ? new Date(p.fechaRequerida).toLocaleDateString('es-CL') : '—'}
              </Dato>
              <Dato etiqueta="Solicitante">
                {p.reportadoPor?.nombre || '—'} · {formatoFechaHora(p.fechaReporte)}
              </Dato>
              {p.responsable && <Dato etiqueta="Responsable">{p.responsable}</Dato>}
              {p.estado === 'RESUELTO' && (
                <Dato etiqueta="Resuelto por">
                  {p.resueltoPor?.nombre || '—'} · {formatoFechaHora(p.fechaResolucion)}
                </Dato>
              )}
              {p.notasResolucion && <Dato etiqueta="Nota de resolución">{p.notasResolucion}</Dato>}
            </dl>

            {textoRectificacion(p) && (
              <p className="rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2 text-xs font-bold text-brand-700" data-testid="rectificacion">
                {textoRectificacion(p)}
                {p.destino === 'FABRICA' && p.tipo === 'VENTANA' ? ' — pedido a Fábrica' : ''}
              </p>
            )}
            {/* A cargo de quien: cliente o instalador -> adicional (se cobra); nosotros -> reposicion. */}
            <div className="rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">A cargo de</span>
                <select
                  value={p.cargoA ?? ''}
                  disabled={!p.puedeResolver || p.estado === 'RESUELTO' || cambiarCargo.isPending}
                  onChange={(e) => cambiarCargo.mutate((e.target.value || null) as CargoPendiente | null)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-brand-600 disabled:bg-slate-50"
                >
                  <option value="">Según el motivo ({p.cargoEfectivo && !p.cargoA ? ETIQUETA_CARGO[p.cargoEfectivo] : 'sin cargo aparte'})</option>
                  {(['CLIENTE', 'INSTALADOR', 'MTW'] as CargoPendiente[]).map((c) => (
                    <option key={c} value={c}>
                      {ETIQUETA_CARGO[c]}
                    </option>
                  ))}
                </select>
              </label>
              {(p.cargoEfectivo === 'CLIENTE' || p.cargoEfectivo === 'INSTALADOR') && tiene('adicionales.editar') && p.estado !== 'RESUELTO' && (
                <Button size="sm" variant="outline" onClick={() => setCotizandoAdicional(true)}>
                  Cotizar adicional
                </Button>
              )}
            </div>
            {/* Compras del pendiente: reposicion (falla o daño) u otra, enlazadas a el. */}
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Compras · sugerida: {ETIQUETA_NATURALEZA[p.naturalezaSugerida]}
                </h4>
                {tiene('compras.oc.solicitar') && p.estado !== 'RESUELTO' && (
                  <Button size="sm" variant="outline" leftIcon={<ShoppingCart className="w-3.5 h-3.5" />} onClick={() => setComprando(true)}>
                    Solicitar materiales
                  </Button>
                )}
              </div>
              {(p.ordenesCompra ?? []).length === 0 ? (
                <p className="text-[11px] text-slate-400">Sin compras todavía.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {p.ordenesCompra.map((oc) => (
                    <li key={oc.id}>
                      <Badge size="sm" variant={oc.naturaleza === 'REPOSICION' ? 'warning' : oc.naturaleza === 'ADICIONAL' ? 'violet' : 'default'}>
                        {oc.numero} · {ETIQUETA_NATURALEZA[oc.naturaleza]} · {oc.estado}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {p.notas && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Notas</h4>
                <p className="text-xs text-slate-800 whitespace-pre-wrap break-words">{p.notas}</p>
              </div>
            )}

            <AdjuntosDetalle proyectoId={proyectoId} pendienteId={pendienteId} adjuntos={p.adjuntos ?? []} puedeAgregar={p.estado !== 'RESUELTO'} />

            {/* Acciones */}
            <div className="rounded-xl border border-slate-200 p-3 space-y-3">
              {p.estado !== 'RESUELTO' && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[12rem] flex-1">
                    <label htmlFor="pend-etapa" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Etapa
                    </label>
                    <select
                      id="pend-etapa"
                      value={etapaSeleccionada}
                      onChange={(e) => setEtapaElegida(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
                    >
                      <option value="">{p.estado === 'EN_CURSO' ? '— sin etapa —' : '— primera etapa —'}</option>
                      {aplicables.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={cambiar.isPending}
                    disabled={ocupado || (p.estado === 'EN_CURSO' && (!etapaElegida || etapaElegida === p.etapaId))}
                    onClick={() => cambiar.mutate({ estado: 'EN_CURSO', etapaId: etapaElegida || undefined })}
                  >
                    {p.estado === 'EN_CURSO' ? 'Cambiar etapa' : 'Tomar (pasar a En curso)'}
                  </Button>
                  {p.estado === 'EN_CURSO' && (
                    <Button size="sm" variant="outline" disabled={ocupado} onClick={() => cambiar.mutate({ estado: 'INGRESADO' })}>
                      Volver a Ingresado
                    </Button>
                  )}
                </div>
              )}

              {p.puedeResolver ? (
                <div className="space-y-2">
                  {p.estado !== 'RESUELTO' && (
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Nota al resolver, ej. recibido en obra (opcional)"
                      aria-label="Nota de resolución"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600"
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {p.estado !== 'RESUELTO' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        disabled={ocupado}
                        onClick={() => cambiar.mutate({ estado: 'RESUELTO', comentario: comentario.trim() || undefined })}
                      >
                        Marcar como resuelto
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} disabled={ocupado} onClick={() => cambiar.mutate({ estado: 'EN_CURSO' })}>
                        Reabrir
                      </Button>
                    )}
                    {p.estado === 'INGRESADO' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        disabled={ocupado}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el pendiente ${codigoPendiente(p.numero)}? No se puede deshacer.`)) eliminar.mutate();
                        }}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Solo quien creó el pendiente ({p.reportadoPor?.nombre || 'su autor'}) puede resolverlo: es quien debe recibir en obra.
                </p>
              )}
            </div>

            {/* Historial */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Historial</h4>
              <ol className="space-y-2 border-l-2 border-slate-100 pl-3">
                {p.eventos.map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="font-bold text-slate-800">
                      {ETIQUETA_ESTADO[e.estadoNuevo]}
                      {e.etapaNombre ? ` · ${e.etapaNombre}` : ''}
                    </span>
                    <span className="text-slate-400">
                      {' '}
                      — {e.usuario?.nombre || 'sistema'} · {formatoFechaHora(e.creadoEn)}
                    </span>
                    {e.comentario && <p className="text-slate-600 mt-0.5 break-words">{e.comentario}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
      {p && cotizandoAdicional && (
        <NuevoAdicionalModal
          proyectoId={proyectoId}
          obraPendiente={p}
          onClose={() => setCotizandoAdicional(false)}
          onCreado={(a) => {
            setCotizandoAdicional(false);
            onClose();
            actualizarParams({ seccion: 'adicionales', adicional: a.id });
          }}
        />
      )}
      {p && comprando && (
        <NuevaOrdenCompraModal
          isOpen
          onClose={() => {
            setComprando(false);
            refrescar();
          }}
          proyectoIdFijo={proyectoId}
          obraPendiente={p}
        />
      )}
    </div>
  );
};
