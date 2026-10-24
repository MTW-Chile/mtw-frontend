import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, PackageCheck, RefreshCw, Send, Truck, XCircle } from 'lucide-react';
import { anularDespacho, emitirDespacho, getDespacho, getEstadoBsale, reintentarGuiaBsale } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Aviso } from '../../../components/ui/Aviso';
import { Input } from '../../../components/ui/Input';
import { OpcionesTarjeta } from '../../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { usePermisos } from '../../../lib/permisos';
import { fecha, fechaHora } from '../../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { DespachoObraDetalle, TipoGuiaDespacho } from '../../../types';
import { ETIQUETA_ESTADO_DESPACHO, ETIQUETA_ESTADO_VENTANA, ETIQUETA_PARTE_CORTA, ETIQUETA_TIPO_GUIA, VARIANTE_ESTADO_DESPACHO, VARIANTE_ESTADO_VENTANA, hoyIso } from '../obra/estadoVentana';

interface Props {
  despachoId: string;
  proyectoId: string;
  onClose: () => void;
}

const GuiaDespacho: React.FC<{ d: DespachoObraDetalle; onReintentar?: () => void; reintentando?: boolean }> = ({ d, onReintentar, reintentando }) => {
  if (d.estado === 'BORRADOR') return null;
  if (d.tipoGuia === 'BSALE') {
    if (d.bsaleDocumentoId || d.bsaleDespachoId) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FileText className="w-4 h-4 text-emerald-600" />
          <span className="text-slate-700">
            Guía electrónica {d.numeroGuia ? <b>N° {d.numeroGuia}</b> : <span className="text-slate-500">(folio pendiente de leer)</span>} · Bsale {d.bsaleEmitidaEn ? fechaHora(d.bsaleEmitidaEn) : ''}
          </span>
          {d.bsaleUrlPdf && (
            <Button size="sm" variant="link" rightIcon={<ExternalLink className="w-3 h-3" />} onClick={() => window.open(d.bsaleUrlPdf!, '_blank', 'noopener')}>
              Abrir PDF
            </Button>
          )}
        </div>
      );
    }
    return (
      <Aviso tono="peligro" titulo="La guía no se emitió en Bsale" accion={onReintentar && <Button size="sm" variant="outline" isLoading={reintentando} leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onReintentar}>Reintentar</Button>}>
        {d.bsaleError ?? 'Sin detalle.'} El despacho quedó emitido igual.
      </Aviso>
    );
  }
  if (d.tipoGuia === 'MANUAL') return <p className="text-xs text-slate-700">Guía de despacho manual <b>N° {d.numeroGuia}</b>.</p>;
  return <p className="text-xs text-slate-500">Despacho sin guía (traslado interno).</p>;
};

/**
 * Detalle de un despacho: sus ventanas con el estado real, la guía y las
 * recepciones en obra. Desde aquí se EMITE (sale de fábrica, con o sin guía) y
 * se anula mientras la obra no haya acusado recibo.
 */
export const DespachoDetalleModal: React.FC<Props> = ({ despachoId, proyectoId, onClose }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const { confirmar, pedirTexto } = useConfirmar();
  const puedeDespachar = tiene('obras.despachar');
  const [tipoGuia, setTipoGuia] = useState<TipoGuiaDespacho>('SIN_GUIA');
  const [numeroGuia, setNumeroGuia] = useState('');
  const [fechaDespacho, setFechaDespacho] = useState(hoyIso());

  const { data: d, isLoading, isError, refetch } = useQuery({ queryKey: ['despacho', despachoId], queryFn: () => getDespacho(despachoId) });
  const { data: bsale } = useQuery({ queryKey: ['bsaleEstado'], queryFn: getEstadoBsale, staleTime: 1000 * 60 * 10, enabled: puedeDespachar });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['despacho', despachoId] });
    queryClient.invalidateQueries({ queryKey: ['despachos', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['despachosDisponibles', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['instalacion'] });
  };
  const alFallar = (e: unknown) => {
    const { mensaje, detalle } = extraerErrorParaToast(e);
    mostrarToast(mensaje, { detalle });
  };

  const emitir = useMutation({
    mutationFn: () => emitirDespacho(despachoId, { tipoGuia, numeroGuia: tipoGuia === 'MANUAL' ? numeroGuia : null, fechaDespacho: fechaDespacho || null }),
    onSuccess: ({ guia }) => {
      refrescar();
      if (guia && !guia.ok) mostrarToast(`Despacho emitido, pero la guía no salió en Bsale: ${guia.error}`);
      else mostrarToast(guia?.ok ? 'Despacho emitido y guía generada en Bsale.' : 'Despacho emitido. La obra ya lo ve como recepción pendiente.', { tipo: 'info' });
    },
    onError: alFallar,
  });
  const reintentar = useMutation({
    mutationFn: () => reintentarGuiaBsale(despachoId),
    onSuccess: ({ guia }) => {
      refrescar();
      if (guia.ok) mostrarToast('Guía generada en Bsale.', { tipo: 'info' });
    },
    onError: alFallar,
  });
  const anular = useMutation({
    mutationFn: (motivo: string) => anularDespacho(despachoId, motivo),
    onSuccess: refrescar,
    onError: alFallar,
  });

  const pedirAnulacion = async () => {
    const motivo = await pedirTexto({ titulo: 'Anular despacho', mensaje: 'Las ventanas vuelven a quedar disponibles para otro despacho.', etiqueta: 'Motivo', requerido: true, peligro: true });
    if (motivo) anular.mutate(motivo);
  };
  const pedirEmision = async () => {
    if (tipoGuia === 'MANUAL' && !numeroGuia.trim()) {
      mostrarToast('Indica el número de la guía manual.');
      return;
    }
    const ok = await confirmar({
      titulo: 'Emitir despacho',
      mensaje: tipoGuia === 'BSALE' ? 'Se generará la guía de despacho electrónica en Bsale y las ventanas quedarán como despachadas, pendientes de recibir en obra.' : 'Las ventanas quedarán como despachadas, pendientes de recibir en obra.',
      confirmar: 'Emitir',
    });
    if (ok) emitir.mutate();
  };

  const opcionesGuia = [
    { value: 'BSALE' as TipoGuiaDespacho, label: 'Guía electrónica', ayuda: bsale?.configurado ? 'La emite Bsale (código SII 52).' : 'Bsale no está configurado.' },
    { value: 'MANUAL' as TipoGuiaDespacho, label: 'Guía manual', ayuda: 'Ya emitida fuera del ERP: anota el folio.' },
    { value: 'SIN_GUIA' as TipoGuiaDespacho, label: 'Sin guía', ayuda: 'Traslado interno sin documento.' },
  ];

  return (
    <Modal
      icono={Truck}
      titulo={d ? `Despacho ${d.codigo}` : 'Despacho'}
      subtitulo={d ? `${d.proyecto.obra}${d.fase ? ` · Fase ${d.fase.numeroFase} ${d.fase.nombre}` : ''}` : undefined}
      ancho="xl"
      onClose={onClose}
      cerrable={!emitir.isPending && !anular.isPending}
      pie={
        d && (
          <Modal.Pie
            inicio={
              puedeDespachar && d.estado !== 'ANULADO' && d.recepciones.length === 0 ? (
                <Button type="button" variant="danger" size="sm" leftIcon={<XCircle className="w-3.5 h-3.5" />} isLoading={anular.isPending} onClick={pedirAnulacion}>
                  Anular
                </Button>
              ) : undefined
            }
          >
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            {puedeDespachar && d.estado === 'BORRADOR' && (
              <Button type="button" variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />} isLoading={emitir.isPending} disabled={tipoGuia === 'BSALE' && !bsale?.configurado} onClick={pedirEmision}>
                Emitir despacho
              </Button>
            )}
          </Modal.Pie>
        )
      }
    >
      {isLoading ? (
        <Cargando />
      ) : isError || !d ? (
        <ErrorCarga que="el despacho" onReintentar={refetch} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={VARIANTE_ESTADO_DESPACHO[d.estado]}>{ETIQUETA_ESTADO_DESPACHO[d.estado]}</Badge>
            <Badge variant="outline">{ETIQUETA_TIPO_GUIA[d.tipoGuia]}</Badge>
            <span className="text-[11px] text-slate-500">
              {d.fechaDespacho ? `Despacho ${fecha(d.fechaDespacho)}` : 'Sin fecha'} · {d.items.length} ítem(s)
              {d.emitidoPor ? ` · emitido por ${d.emitidoPor.nombre}` : d.creadoPor ? ` · creado por ${d.creadoPor.nombre}` : ''}
            </span>
          </div>
          {d.estado === 'ANULADO' && (
            <Aviso tono="peligro" titulo={`Anulado ${d.anuladoEn ? fechaHora(d.anuladoEn) : ''}${d.anuladoPor ? ` por ${d.anuladoPor.nombre}` : ''}`}>
              {d.motivoAnulacion}
            </Aviso>
          )}

          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Entrega</dt>
              <dd className="text-slate-800">{[d.direccionEntrega, d.comunaEntrega, d.ciudadEntrega].filter(Boolean).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Destinatario</dt>
              <dd className="text-slate-800">{d.destinatario || '—'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Transporte</dt>
              <dd className="text-slate-800">{[d.transportista, d.patente].filter(Boolean).join(' · ') || '—'}</dd>
            </div>
            {d.notas && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Notas</dt>
                <dd className="text-slate-800 whitespace-pre-wrap">{d.notas}</dd>
              </div>
            )}
          </dl>

          <GuiaDespacho d={d} onReintentar={puedeDespachar ? () => reintentar.mutate() : undefined} reintentando={reintentar.isPending} />

          {puedeDespachar && d.estado === 'BORRADOR' && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-800">Emitir: ¿con qué guía sale?</p>
              <OpcionesTarjeta columnas={3} valor={tipoGuia} onChange={setTipoGuia} opciones={opcionesGuia.map((o) => ({ ...o, icono: o.value === 'BSALE' ? <FileText className="w-4 h-4" /> : undefined }))} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Fecha de despacho" type="date" value={fechaDespacho} onChange={(e) => setFechaDespacho(e.target.value)} />
                {tipoGuia === 'MANUAL' && <Input label="N° de guía" value={numeroGuia} onChange={(e) => setNumeroGuia(e.target.value)} maxLength={40} />}
              </div>
              {tipoGuia === 'BSALE' && !bsale?.configurado && (
                <Aviso tono="advertencia">Bsale no está configurado en la API (BSALE_ACCESS_TOKEN). Emite con guía manual o sin guía, o pide a un administrador configurarlo.</Aviso>
              )}
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ventanas</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {d.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono font-bold text-slate-900">{i.ventana.nomenclatura ?? i.ventana.codigo}</span>
                    {i.parte !== 'COMPLETA' && <span className="ml-1.5 text-slate-500">({ETIQUETA_PARTE_CORTA[i.parte]})</span>}
                    <p className="text-[11px] text-slate-500 truncate">{i.descripcion}</p>
                  </div>
                  {i.cantidad > 1 && <span className="font-mono text-slate-600 tabular-nums">{i.cantidadRecibida}/{i.cantidad}</span>}
                  <Badge size="sm" variant={VARIANTE_ESTADO_VENTANA[i.ventana.estado]}>
                    {ETIQUETA_ESTADO_VENTANA[i.ventana.estado]}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          {d.recepciones.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5" /> Recepciones en obra
              </p>
              <ul className="space-y-1.5">
                {d.recepciones.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-800">{fechaHora(r.fechaRecepcion)}</span>
                    {r.recibidoPor && <span className="text-slate-500"> · {r.recibidoPor.nombre}</span>}
                    <span className="text-slate-500"> · {r.items.reduce((s, x) => s + x.cantidadRecibida, 0)} unidad(es)</span>
                    {r.notas && <p className="text-slate-600 mt-0.5">{r.notas}</p>}
                    {r.items.some((x) => x.observacion) && (
                      <ul className="mt-1 text-[11px] text-amber-800">
                        {r.items.filter((x) => x.observacion).map((x) => (
                          <li key={x.id}>• {d.items.find((i) => i.id === x.despachoItemId)?.descripcion}: {x.observacion}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
