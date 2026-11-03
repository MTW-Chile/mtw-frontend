import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { getContenidoFotoInstalacion, getVentanaInstalacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { fecha, fechaHora } from '../../../lib/formato';
import type { AdjuntoInstalacion, FichaVentanaObra } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { esImagen } from '../pendientes/adjuntos/utils';
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO, codigoPendiente, etiquetaPieza, nombreCuadro } from '../pendientes/utils';
import { DibujoVentana } from './DibujoVentana';
import { ETIQUETA_ESTADO_VENTANA, ETIQUETA_PARTE_CORTA, VARIANTE_ESTADO_VENTANA } from './estadoVentana';

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
  if (!esImagen(adjunto.mime)) return <span className="text-[11px] text-slate-500 p-2 truncate">{adjunto.nombre}</span>;
  if (isError) return <span className="text-[11px] text-slate-500 p-2">No disponible</span>;
  if (!url) return <Loader2 className="w-4 h-4 animate-spin text-slate-300" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
      <img src={url} alt={adjunto.nombre} className="w-full h-full object-cover" />
    </a>
  );
};

const Dato: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] uppercase tracking-wider text-slate-500">{k}</dt>
    <dd className="text-xs text-slate-800 break-words">{children}</dd>
  </div>
);

// Instalaciones certificadas (con sus fotos) e historial de la ventana. Se lee solo al abrirlo.
const HistorialVentana: React.FC<{ ventanaId: string }> = ({ ventanaId }) => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['ventanaInstalacion', ventanaId], queryFn: () => getVentanaInstalacion(ventanaId) });
  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-slate-300 m-3" />;
  if (isError || !data) return <p className="px-3 pb-3 text-[11px] text-rose-700">No se pudo leer el historial.</p>;
  return (
    <div className="px-3 pb-3 space-y-3 text-xs">
      {data.instalaciones.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Instalación certificada</p>
          <ul className="space-y-2">
            {data.instalaciones.map((i) => (
              <li key={i.id} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-2">
                <p className="text-emerald-900">
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
                  <ul className="grid grid-cols-4 sm:grid-cols-6 gap-2">
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
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Historial</p>
        {data.eventos.length === 0 ? (
          <p className="text-[11px] text-slate-500">Sin movimientos todavía.</p>
        ) : (
          <ul className="space-y-1 text-[11px] text-slate-600">
            {[...data.eventos].reverse().map((e) => (
              <li key={e.id}>
                <span className="font-mono text-slate-500">{fechaHora(e.creadoEn)}</span> · {ETIQUETA_ESTADO_VENTANA[e.estadoNuevo]}
                {e.parte !== 'COMPLETA' ? ` (${ETIQUETA_PARTE_CORTA[e.parte]})` : ''}
                {e.usuario ? ` · ${e.usuario.nombre}` : ''}
                {e.comentario ? ` — ${e.comentario}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * Lo que sabemos de la ventana: dibujo, estado, dónde va, medidas, vidrios, y aparte (plegado) marcos, hojas y
 * materiales y el historial. El estado de la ventana es UNO solo: el estado del documento de fabricación o del
 * documento adjunto lo actualiza, no es un estado paralelo, así que no se muestra por separado.
 *
 * El dibujo sale de la ficha (geometría del documento de venta del lote: obras manuales y cotizadas por igual) y,
 * si la ficha no lo trae, de la línea cotizada de la obra.
 */
export const FichaVentana: React.FC<{ proyectoId: string; ficha: FichaVentanaObra; conHistorial?: boolean }> = ({ proyectoId, ficha, conHistorial }) => {
  const v = ficha.ventana;
  const fv = ficha.fabricacionVentana;
  const abiertos = ficha.pendientes.filter((p) => p.estado !== 'RESUELTO');
  const [tecnicoAbierto, setTecnicoAbierto] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  // @container: la ficha se acomoda al ancho real de su columna (en tablet es angosta), no al de la pantalla.
  return (
    <div className="space-y-2 @container">
      <div className="grid grid-cols-1 @xl:grid-cols-[9.5rem_1fr] gap-3">
        <DibujoVentana proyectoId={proyectoId} ventanaId={v.ventanaId} lineaHetmo={v.ventanaId ? undefined : fv?.hetmoVentanaMadreId} ventana={ficha.dibujo} className="h-32 @xl:h-full @xl:min-h-32" />
        <dl className="grid grid-cols-2 @3xl:grid-cols-3 gap-x-4 gap-y-1.5 content-start">
          <div className="col-span-2 @3xl:col-span-3 flex flex-wrap items-center gap-1.5">
            {v.separada ? (
              v.partes.map((p) => (
                <Badge key={p.parte} size="sm" variant={VARIANTE_ESTADO_VENTANA[p.estado]}>
                  {ETIQUETA_PARTE_CORTA[p.parte]}: {ETIQUETA_ESTADO_VENTANA[p.estado]}
                </Badge>
              ))
            ) : (
              <Badge size="sm" variant={VARIANTE_ESTADO_VENTANA[v.estado]}>{ETIQUETA_ESTADO_VENTANA[v.estado]}</Badge>
            )}
            {abiertos.length > 0 && <Badge size="sm" variant="warning">{abiertos.length} pendiente(s) abierto(s)</Badge>}
          </div>
          <div className="col-span-2 @3xl:col-span-3">
            <Dato k="Apertura">{fv?.descripcionCorta || v.sistema}</Dato>
          </div>
          <Dato k="Ubicación">
            {[v.torre ? `Torre ${v.torre}` : null, v.piso != null ? `Piso ${v.piso}` : null, v.nombreUnidad, v.ubicacion].filter(Boolean).join(' · ') || 'Sin posición'}
          </Dato>
          <Dato k="Medida (mm)">
            {fv ? `${formatoMm(fv.anchoMm)} × ${formatoMm(fv.altoMm)}` : v.anchoFabricacionMm != null ? `${formatoMm(v.anchoFabricacionMm)} × ${formatoMm(v.altoFabricacionMm)}` : `${formatoMm(v.anchoPlanoMm)} × ${formatoMm(v.altoPlanoMm)}`}
          </Dato>
          <Dato k="Documento">{ficha.documento ? `${ficha.documento.nombreMostrado} · pos ${fv?.orden}` : 'Sin vincular'}</Dato>
          <div className="col-span-2 @3xl:col-span-3">
            <Dato k={`Vidrios (${ficha.vidrios.reduce((n, g) => n + Number(g.UDS || 1), 0)})`}>
              {ficha.vidrios.length === 0
                ? ficha.hetmoError ?? 'Sin vidrios en la línea.'
                : ficha.vidrios.map((g) => `${formatoMm(g.ANCHO)} × ${formatoMm(g.ALTO)} · ${g.codigo_articulo}${Number(g.UDS) > 1 ? ` · ${g.UDS} un` : ''}`).join('  |  ')}
            </Dato>
          </div>
        </dl>
      </div>

      {/* Lo técnico (marcos, hojas y materiales) va aparte: se abre solo si hace falta. */}
      <div className="rounded-xl border border-slate-200">
        <BotonColapsar abierto={tecnicoAbierto} onClick={() => setTecnicoAbierto((x) => !x)} className="w-full px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Marcos, hojas y materiales ({ficha.materiales.length})</span>
        </BotonColapsar>
        {tecnicoAbierto && (
          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-3 text-xs px-3 pb-3">
            <div className="rounded-lg border border-slate-200 p-2.5 space-y-1 max-h-52 overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Marcos y hojas</p>
              {ficha.cuadros.length === 0 ? (
                <p className="text-slate-500">{fv ? 'El lote aún no trae los cuadros (se optimiza después).' : 'Sin documento de fabricación.'}</p>
              ) : (
                ficha.cuadros.map((c) => (
                  <div key={c.id}>
                    <p className="font-mono text-slate-700">
                      {nombreCuadro(c)} · {formatoMm(c.anchoMm)} × {formatoMm(c.altoMm)}
                    </p>
                    {c.piezas.map((p) => (
                      <p key={p.id} className="pl-3 text-[11px] text-slate-500 truncate" title={etiquetaPieza(p, true)}>
                        {etiquetaPieza(p)}
                      </p>
                    ))}
                  </div>
                ))
              )}
              {ficha.piezasSueltas.length > 0 && (
                <div>
                  <p className="font-mono text-slate-700">Piezas sueltas</p>
                  {ficha.piezasSueltas.map((p) => (
                    <p key={p.id} className="pl-3 text-[11px] text-slate-500 truncate" title={etiquetaPieza(p, true)}>
                      {etiquetaPieza(p)}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 space-y-1 max-h-52 overflow-y-auto">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Materiales ({ficha.materiales.length})</p>
              {ficha.materiales.length === 0 ? (
                <p className="text-slate-500">{ficha.hetmoError ?? 'Sin materiales en la línea.'}</p>
              ) : (
                ficha.materiales.map((m, i) => (
                  <p key={`${m.codigo_articulo}-${i}`} className="text-slate-700 truncate" title={`${m.descripcion_articulo} (${m.codigo_articulo})`}>
                    {m.descripcion_articulo} <span className="text-slate-500 font-mono">{m.codigo_articulo}</span>
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {conHistorial && (
        <div className="rounded-xl border border-slate-200">
          <BotonColapsar abierto={historialAbierto} onClick={() => setHistorialAbierto((x) => !x)} className="w-full px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Historial e instalación certificada</span>
          </BotonColapsar>
          {historialAbierto && <HistorialVentana ventanaId={v.id} />}
        </div>
      )}

      {abiertos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 text-xs space-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pendientes abiertos de esta ventana</p>
          {abiertos.map((p) => (
            <p key={p.id} className="text-amber-900 truncate">
              <span className="font-mono font-bold">{codigoPendiente(p.numero)}</span> · {ETIQUETA_TIPO[p.tipo]} · {ETIQUETA_MOTIVO[p.motivo]} · {p.descripcion} · {fecha(p.fechaReporte)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
