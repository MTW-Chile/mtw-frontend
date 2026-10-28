import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, PackageCheck, Square } from 'lucide-react';
import { getContenidoFotoInstalacion, getProyectoById, getVentanaInstalacion } from '../../api/client';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Aviso } from '../../components/ui/Aviso';
import { Cargando, ErrorCarga } from '../../components/ui/Estados';
import { usePermisos } from '../../lib/permisos';
import { fecha, fechaHora } from '../../lib/formato';
import type { AdjuntoInstalacion, DespachoPorRecibir, VentanaObra } from '../../types';
import { ETIQUETA_ESTADO_VENTANA, ETIQUETA_PARTE_CORTA, VARIANTE_ESTADO_VENTANA, nombreVentana, textoMedida } from '../proyectos/obra/estadoVentana';
import { DibujoVentana } from '../proyectos/obra/DibujoVentana';
import { esImagen } from '../proyectos/pendientes/adjuntos/utils';
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO } from '../proyectos/pendientes/utils';
import { NuevoPendienteModal } from '../proyectos/pendientes/NuevoPendienteModal';
import { CertificarInstalacionModal } from './CertificarInstalacionModal';
import { RecibirDespachoModal } from './RecibirDespachoModal';

interface Props {
  proyectoId: string;
  ventanaId: string;
  despachosPorRecibir: DespachoPorRecibir[];
  onClose: () => void;
}

const aDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });

const FotoInstalacion: React.FC<{ instalacionId: string; adjunto: AdjuntoInstalacion }> = ({ instalacionId, adjunto }) => {
  const { data: url, isError } = useQuery({
    queryKey: ['fotoInstalacion', adjunto.id],
    queryFn: async () => aDataUrl(await getContenidoFotoInstalacion(instalacionId, adjunto.id)),
    enabled: esImagen(adjunto.mime),
    staleTime: Infinity,
  });
  if (!esImagen(adjunto.mime)) return <span className="text-[10px] text-slate-400 p-2 truncate">{adjunto.nombre}</span>;
  if (isError) return <span className="text-[10px] text-slate-400 p-2">No disponible</span>;
  if (!url) return <Loader2 className="w-4 h-4 animate-spin text-slate-300" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
      <img src={url} alt={adjunto.nombre} className="w-full h-full object-cover" />
    </a>
  );
};

/**
 * La ventana en obra: su dibujo, dónde va, en qué estado está (por parte si
 * se separó marco y hoja), qué pasó (historial) y las acciones del supervisor:
 * recibir el despacho, certificar la instalación con foto o levantar un pendiente.
 */
export const VentanaInstalacionModal: React.FC<Props> = ({ proyectoId, ventanaId, despachosPorRecibir, onClose }) => {
  const { tiene } = usePermisos();
  const [certificando, setCertificando] = useState(false);
  const [reportando, setReportando] = useState(false);
  const [recibiendo, setRecibiendo] = useState<DespachoPorRecibir | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['ventanaInstalacion', ventanaId], queryFn: () => getVentanaInstalacion(ventanaId) });
  // Para el modal de pendiente (reutilizado) hace falta el Proyecto completo.
  const { data: proyecto } = useQuery({ queryKey: ['proyectoDetail', proyectoId], queryFn: () => getProyectoById(proyectoId), staleTime: 1000 * 60 * 5 });

  const v: VentanaObra | undefined = data?.ventana;
  const despachoPendiente = v ? despachosPorRecibir.find((d) => d.items.some((i) => i.ventanaIndividualizadaId === v.id && i.pendiente > 0)) : undefined;
  const puedeCertificar = tiene('instalacion.certificar') && !!v && v.estado !== 'INSTALADA';
  const pendientesAbiertos = (data?.pendientes ?? []).filter((p) => p.estado !== 'RESUELTO');

  return (
    <>
      <Modal
        icono={Square}
        titulo={v ? nombreVentana(v) : 'Ventana'}
        subtitulo={v ? `${v.sistema}${v.torre ? ` · ${v.torre}` : ''}${v.piso != null ? ` · piso ${v.piso}` : ''}${v.nombreUnidad ? ` · ${v.nombreUnidad}` : ''}${v.ubicacion ? ` · ${v.ubicacion}` : ''}` : undefined}
        ancho="xl"
        onClose={onClose}
        pie={
          v && (
            // Acciones del supervisor: en tablet y celular se reparten el ancho con alto táctil (ver Modal.Pie).
            <Modal.Pie>
              {tiene('pendientes.crear') && (
                <Button type="button" variant="outline" size="sm" leftIcon={<ClipboardList className="w-3.5 h-3.5" />} onClick={() => setReportando(true)} disabled={!proyecto}>
                  Pendiente
                </Button>
              )}
              {despachoPendiente && tiene('instalacion.recibir') && (
                <Button type="button" variant="secondary" size="sm" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => setRecibiendo(despachoPendiente)}>
                  Recibir {despachoPendiente.codigo}
                </Button>
              )}
              {puedeCertificar && (
                <Button type="button" variant="primary" size="sm" leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => setCertificando(true)}>
                  Marcar instalada
                </Button>
              )}
            </Modal.Pie>
          )
        }
      >
        {isLoading ? (
          <Cargando />
        ) : isError || !data || !v ? (
          <ErrorCarga que="la ventana" onReintentar={refetch} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] lg:grid-cols-[18rem_1fr] gap-3">
              <DibujoVentana proyectoId={proyectoId} ventanaId={v.ventanaId} className="h-48 md:h-full md:min-h-52" />
              <dl className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-xs pointer-coarse:text-sm content-start">
                <div className="col-span-2 lg:col-span-3 flex flex-wrap gap-1.5">
                  {v.separada ? (
                    v.partes.map((p) => (
                      <Badge key={p.parte} variant={VARIANTE_ESTADO_VENTANA[p.estado]}>
                        {ETIQUETA_PARTE_CORTA[p.parte]}: {ETIQUETA_ESTADO_VENTANA[p.estado]}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant={VARIANTE_ESTADO_VENTANA[v.estado]} size="md">
                      {ETIQUETA_ESTADO_VENTANA[v.estado]}
                    </Badge>
                  )}
                  {pendientesAbiertos.length > 0 && (
                    <Badge variant="warning" size="md">
                      {pendientesAbiertos.length} pendiente(s)
                    </Badge>
                  )}
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Fabricación</dt>
                  <dd className="font-mono text-slate-800">{textoMedida(v.anchoFabricacionMm, v.altoFabricacionMm)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Rasgo</dt>
                  <dd className="font-mono text-slate-800">{textoMedida(v.rasgoAnchoMm, v.rasgoAltoMm)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Plano</dt>
                  <dd className="font-mono text-slate-800">{textoMedida(v.anchoPlanoMm, v.altoPlanoMm)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Fase</dt>
                  <dd className="text-slate-800">{v.fase ? `Fase ${v.fase.numeroFase} · ${v.fase.nombre}` : '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Cuadros</dt>
                  <dd className="text-slate-800">{v.cuadros ?? '—'}{v.admiteSeparacion ? ' · marco y hoja' : ' · fija'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Lote HETMO</dt>
                  <dd className="text-slate-800">{v.lote ? `${v.lote.descripcion ?? v.lote.hetmoId} · pos ${v.lote.orden} · ${v.lote.estadoGlosa ?? `estado ${v.lote.estadoHetmo}`}` : 'Sin vincular'}</dd>
                </div>
              </dl>
            </div>

            {despachoPendiente && (
              <Aviso tono="info" titulo={`Llegó en el despacho ${despachoPendiente.codigo}${despachoPendiente.fechaDespacho ? ` (${fecha(despachoPendiente.fechaDespacho)})` : ''}`} accion={tiene('instalacion.recibir') && <Button size="sm" variant="outline" onClick={() => setRecibiendo(despachoPendiente)}>Recibir</Button>}>
                Acusa recibo antes de certificar la instalación.
              </Aviso>
            )}

            {data.instalaciones.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Instalación certificada</p>
                <ul className="space-y-2">
                  {data.instalaciones.map((i) => (
                    <li key={i.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                      <p className="text-xs text-emerald-900">
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                        {i.parte === 'COMPLETA' ? 'Ventana completa' : i.parte === 'MARCO' ? 'Marco' : 'Hoja'} · {fechaHora(i.fechaInstalacion)}
                        {i.instaladoPor ? ` · ${i.instaladoPor.nombre}` : ''}
                      </p>
                      {i.notas && <p className="text-[11px] text-slate-600">{i.notas}</p>}
                      {i.adjuntos.length === 0 ? (
                        <p className="text-[11px] text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Sin foto.
                        </p>
                      ) : (
                        <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                          {i.adjuntos.map((a) => (
                            <li key={a.id} className="aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
                              <FotoInstalacion instalacionId={i.id} adjunto={a} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.pendientes.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Pendientes</p>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {data.pendientes.map((p) => (
                    <li key={p.id} className="px-3 py-2 text-xs flex items-center gap-2">
                      <span className="font-mono text-slate-400">PEN-{String(p.numero).padStart(6, '0')}</span>
                      <span className="flex-1 min-w-0 truncate text-slate-800">{p.descripcion}</span>
                      <Badge size="sm" variant={p.estado === 'RESUELTO' ? 'success' : p.estado === 'EN_CURSO' ? 'info' : 'warning'}>
                        {p.estado === 'RESUELTO' ? 'Resuelto' : p.estado === 'EN_CURSO' ? p.etapa?.nombre ?? 'En curso' : 'Ingresado'}
                      </Badge>
                      <span className="hidden sm:inline text-[10px] text-slate-400">
                        {ETIQUETA_TIPO[p.tipo]} · {ETIQUETA_MOTIVO[p.motivo]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Historial</p>
              {data.eventos.length === 0 ? (
                <p className="text-[11px] text-slate-400">Sin movimientos todavía.</p>
              ) : (
                <ul className="space-y-1 text-[11px] text-slate-600">
                  {[...data.eventos].reverse().map((e) => (
                    <li key={e.id}>
                      <span className="font-mono text-slate-400">{fechaHora(e.creadoEn)}</span> · {ETIQUETA_ESTADO_VENTANA[e.estadoNuevo]}
                      {e.parte !== 'COMPLETA' ? ` (${ETIQUETA_PARTE_CORTA[e.parte]})` : ''}
                      {e.usuario ? ` · ${e.usuario.nombre}` : ''}
                      {e.comentario ? ` — ${e.comentario}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {certificando && v && (
        <CertificarInstalacionModal
          proyectoId={proyectoId}
          ventana={v}
          onClose={() => setCertificando(false)}
          onCertificada={() => {
            setCertificando(false);
            refetch();
          }}
        />
      )}
      {recibiendo && <RecibirDespachoModal proyectoId={proyectoId} despacho={recibiendo} onClose={() => { setRecibiendo(null); refetch(); }} />}
      {reportando && proyecto && v && (
        <NuevoPendienteModal
          proyecto={proyecto}
          ventanaCubicada={v}
          onClose={() => setReportando(false)}
          onCreado={() => {
            setReportando(false);
            refetch();
          }}
        />
      )}
    </>
  );
};
