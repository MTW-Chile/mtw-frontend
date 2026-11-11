import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { getContenidoFotoInstalacion, getProyectoById, getVentanaInstalacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { fecha, fechaHora } from '../../../lib/formato';
import type { AdjuntoInstalacion, FichaVentanaObra } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { esImagen } from '../pendientes/adjuntos/utils';
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO, codigoPendiente } from '../pendientes/utils';
import { DibujoVentana, ventanaDeProyecto } from './DibujoVentana';
import { describirVentana, describirVidrios } from './descripcionVentana';
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

// Fila «etiqueta · valor» como en la tarjeta del PDF del presupuesto (Dimensiones, Composición, Apertura, Vidrios).
const Dato: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
  <>
    <dt className="text-[11px] text-slate-500 whitespace-nowrap">{k}</dt>
    <dd className="text-xs text-slate-800 min-w-0 break-words">{children}</dd>
  </>
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
 * La ventana en pocas líneas, para reconocerla en terreno: dibujo chico, estado y los mismos datos que lleva su tarjeta
 * en el PDF del presupuesto (dimensiones, composición, apertura, vidrios) más dónde va. La apertura la describe el motor
 * de dibujo desde la geometría («Corredera 1 hoja derecha + fijo»), no el texto del documento de fabricación. No lleva
 * materiales, marcos ni hojas (se eligen en el formulario del pendiente) ni la referencia al documento.
 *
 * El dibujo y la descripción salen de la ficha (geometría del documento de venta del lote: obras manuales y cotizadas
 * por igual) y, si la ficha no la trae, de la línea cotizada de la obra.
 */
export const FichaVentana: React.FC<{ proyectoId: string; ficha: FichaVentanaObra; conHistorial?: boolean; /** Nombre de la ventana, como primera línea. */ titulo?: React.ReactNode }> = ({ proyectoId, ficha, conHistorial, titulo }) => {
  const v = ficha.ventana;
  const fv = ficha.fabricacionVentana;
  const abiertos = ficha.pendientes.filter((p) => p.estado !== 'RESUELTO');
  const [historialAbierto, setHistorialAbierto] = useState(false);
  // Sin geometría en la ficha: la línea cotizada de la obra (misma consulta y caché que DibujoVentana).
  const lineaMadre = v.ventanaId ? undefined : fv?.hetmoVentanaMadreId;
  const { data: proyecto } = useQuery({ queryKey: ['proyectoDetail', proyectoId], queryFn: () => getProyectoById(proyectoId), enabled: !ficha.dibujo && (!!v.ventanaId || lineaMadre != null), staleTime: 1000 * 60 * 5 });
  const descripcion = describirVentana(ficha.dibujo ?? ventanaDeProyecto(proyecto, v.ventanaId, lineaMadre));
  const ancho = fv?.anchoMm ?? v.anchoFabricacionMm ?? v.anchoPlanoMm;
  const alto = fv?.altoMm ?? v.altoFabricacionMm ?? v.altoPlanoMm;
  const lugar = [v.torre ? `Torre ${v.torre}` : null, v.piso != null ? `Piso ${v.piso}` : null, v.nombreUnidad, v.ubicacion].filter(Boolean).join(' · ') || 'Sin posición';
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <DibujoVentana proyectoId={proyectoId} ventanaId={v.ventanaId} lineaHetmo={lineaMadre} ventana={ficha.dibujo} className="w-24 h-24 sm:w-28 sm:h-28 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {titulo && <h3 className="text-sm font-black font-mono text-slate-900">{titulo}</h3>}
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
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 items-baseline">
            <Dato k="Ubicación">{lugar}</Dato>
            <Dato k="Dimensiones">{ancho != null && alto != null ? `${formatoMm(ancho)} × ${formatoMm(alto)} mm` : '—'}</Dato>
            {descripcion?.composicion && <Dato k="Composición">{descripcion.composicion}</Dato>}
            <Dato k="Apertura">{descripcion?.apertura ?? '—'}</Dato>
            {ficha.vidrios.length > 0 && <Dato k="Vidrios">{describirVidrios(ficha.vidrios)}</Dato>}
          </dl>
        </div>
      </div>

      {conHistorial && (
        <div className="rounded-xl border border-slate-200">
          <BotonColapsar abierto={historialAbierto} onClick={() => setHistorialAbierto((x) => !x)} className="w-full px-3 py-2 pointer-coarse:min-h-11">
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
