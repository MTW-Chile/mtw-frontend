import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RotateCcw, ShoppingCart, Trash2 } from 'lucide-react';
import { cambiarEstadoPendiente, editarPendiente, eliminarPendiente, getEtapasPendiente, getPendiente } from '../../../api/client';
import { NuevoAdicionalModal } from '../adicionales/NuevoAdicionalModal';
import { actualizarParams } from '../../../lib/navigation';
import { avisarError } from '../../configuracion/catalogo/comun';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatoFechaHora } from '../fabricacion/utils';
import { AdjuntosDetalle } from './adjuntos/AdjuntosDetalle';
import { DibujoVentana } from '../obra/DibujoVentana';
import { SolicitudMaterialesModal } from '../../abastecimiento/solicitud/SolicitudMaterialesModal';
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
import { useConfirmar } from '../../../components/ui/Confirmar';
import { SelectCompacto, Textarea } from '../../../components/ui/Campos';
import { Modal } from '../../../components/ui/Modal';
import { Cargando } from '../../../components/ui/Estados';

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
  const { confirmar } = useConfirmar();
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
    queryClient.invalidateQueries({ queryKey: ['pendientes'] }); // la lista de la obra y el visor central
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
      queryClient.invalidateQueries({ queryKey: ['pendientes'] }); // la lista de la obra y el visor central
      onClose();
    },
  });

  const aplicables = p ? etapasPara(etapas, p.destino) : [];
  // Etapa a usar: la elegida, o la actual si ya esta en curso.
  const etapaSeleccionada = etapaElegida || (p?.estado === 'EN_CURSO' ? (p.etapaId ?? '') : '');
  const ocupado = cambiar.isPending || eliminar.isPending;

  return (
    <>
    <Modal
      ancho="lg"
      titulo={
        p ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{codigoPendiente(p.numero)}</span>
            <Badge size="sm" variant={varianteEstadoPendiente(p.estado)}>
              {textoEstadoPendiente(p)}
            </Badge>
          </span>
        ) : (
          'Pendiente'
        )
      }
      subtitulo={p?.descripcion}
      onClose={onClose}
    >
        {isLoading || !p ? (
          <Cargando />
        ) : (
          <>

            {(p.ventanaIndividualizada || p.fabricacionVentana) && (
              <div className="flex gap-3 items-center">
                <DibujoVentana proyectoId={proyectoId} ventanaId={undefined} lineaHetmo={p.fabricacionVentana?.hetmoVentanaMadreId ?? null} className="h-24 w-32 shrink-0" />
                <div className="text-xs text-slate-600">
                  <p className="font-bold font-mono text-slate-900">{p.ventanaIndividualizada?.nomenclatura ?? p.ventanaIndividualizada?.tipo.codigo ?? p.fabricacionVentana?.modelo}</p>
                  {p.ventanaIndividualizada?.ubicacion && <p>{p.ventanaIndividualizada.ubicacion}</p>}
                  {p.fabricacionVentana && <p className="text-[11px] text-slate-500">Pos {p.fabricacionVentana.orden} · {p.fabricacionVentana.modelo}</p>}
                </div>
              </div>
            )}
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
                <SelectCompacto
                  value={p.cargoA ?? ''}
                  disabled={!p.puedeResolver || p.estado === 'RESUELTO' || cambiarCargo.isPending}
                  onChange={(e) => cambiarCargo.mutate((e.target.value || null) as CargoPendiente | null)}
                >
                  <option value="">Según el motivo ({p.cargoEfectivo && !p.cargoA ? ETIQUETA_CARGO[p.cargoEfectivo] : 'sin cargo aparte'})</option>
                  {(['CLIENTE', 'INSTALADOR', 'MTW'] as CargoPendiente[]).map((c) => (
                    <option key={c} value={c}>
                      {ETIQUETA_CARGO[c]}
                    </option>
                  ))}
                </SelectCompacto>
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
                    <SelectCompacto id="pend-etapa" value={etapaSeleccionada} onChange={(e) => setEtapaElegida(e.target.value)} className="w-full">
                      <option value="">{p.estado === 'EN_CURSO' ? '— sin etapa —' : '— primera etapa —'}</option>
                      {aplicables.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </SelectCompacto>
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
                    <Textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Nota al resolver, ej. recibido en obra (opcional)"
                      aria-label="Nota de resolución"
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
                        onClick={async () => {
                          if (await confirmar({ titulo: `¿Eliminar el pendiente ${codigoPendiente(p.numero)}?`, mensaje: `No se puede deshacer.`, confirmar: 'Eliminar', peligro: true })) eliminar.mutate();
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
    </Modal>
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
        <SolicitudMaterialesModal
          proyectoId={proyectoId}
          obraPendiente={p}
          onClose={() => {
            setComprando(false);
            refrescar();
          }}
        />
      )}
    </>
  );
};
