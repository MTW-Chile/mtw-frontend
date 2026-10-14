import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Loader2, Trash2 } from 'lucide-react';
import { getContenidoAdjunto, getOneDriveObra, quitarAdjuntoPendiente } from '../../../../api/client';
import { extraerErrorParaToast, mostrarToast } from '../../../../lib/toast';
import type { AdjuntoPendiente } from '../../../../types';
import { formatoFechaHora } from '../../fabricacion/utils';
import { BotonesAdjuntar } from './BotonesAdjuntar';
import { subirArchivos } from './subirArchivos';
import { esImagen, formatoTamano } from './utils';

// Miniatura: la API sirve el archivo (el navegador no tiene sesion de OneDrive),
// asi que se pide y se muestra como data URL (sin URLs temporales que liberar).
const aDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });

const Miniatura: React.FC<{ pendienteId: string; adjunto: AdjuntoPendiente }> = ({ pendienteId, adjunto }) => {
  const { data: url, isError } = useQuery({
    queryKey: ['adjuntoContenido', adjunto.id],
    queryFn: async () => aDataUrl(await getContenidoAdjunto(pendienteId, adjunto.id)),
    enabled: esImagen(adjunto.mime),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
  });

  if (!esImagen(adjunto.mime)) return <FileText className="w-6 h-6 text-slate-400" />;
  if (isError) return <span className="text-[10px] text-slate-400 text-center">No disponible</span>;
  if (!url) return <Loader2 className="w-4 h-4 animate-spin text-slate-300" />;
  return <img src={url} alt={adjunto.nombre} className="w-full h-full object-cover" />;
};

// Abre el archivo en una pestaña nueva a partir del blob (los PDF y fotos se ven en el navegador).
async function abrirArchivo(pendienteId: string, adjunto: AdjuntoPendiente) {
  try {
    const blob = await getContenidoAdjunto(pendienteId, adjunto.id);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    const { mensaje, detalle } = extraerErrorParaToast(e);
    mostrarToast(mensaje, { detalle });
  }
}

interface Props {
  proyectoId: string;
  pendienteId: string;
  adjuntos: AdjuntoPendiente[];
  /** Un pendiente resuelto sigue mostrando sus adjuntos pero ya no recibe nuevos. */
  puedeAgregar: boolean;
}

// Adjuntos de un pendiente (detalle): miniaturas, abrir, quitar y agregar mas.
export const AdjuntosDetalle: React.FC<Props> = ({ proyectoId, pendienteId, adjuntos, puedeAgregar }) => {
  const queryClient = useQueryClient();
  const [subiendo, setSubiendo] = useState<{ hechos: number; total: number } | null>(null);
  const { data: onedrive } = useQuery({ queryKey: ['onedrive', proyectoId], queryFn: () => getOneDriveObra(proyectoId), staleTime: 1000 * 60 });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['pendiente', pendienteId] });
    queryClient.invalidateQueries({ queryKey: ['pendientes', proyectoId] });
  };

  const quitar = useMutation({
    mutationFn: (a: AdjuntoPendiente) => quitarAdjuntoPendiente(pendienteId, a.id),
    onSuccess: refrescar,
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const agregar = async (archivos: File[]) => {
    setSubiendo({ hechos: 0, total: archivos.length });
    const r = await subirArchivos(pendienteId, archivos, (hechos, total) => setSubiendo({ hechos, total }));
    setSubiendo(null);
    refrescar();
    if (r.fallidos.length) mostrarToast(`No se pudo subir: ${r.fallidos.join(' · ')}`);
  };

  // Sin OneDrive configurado: si ya habia adjuntos se listan (sin miniatura); no se ofrece agregar.
  const puedeSubir = puedeAgregar && !!onedrive?.configurado && !onedrive.requiereReconexion && !!onedrive.carpeta;
  if (adjuntos.length === 0 && !puedeSubir && !(puedeAgregar && onedrive?.configurado)) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fotos y documentos ({adjuntos.length})</h4>
      {adjuntos.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Adjuntos">
          {adjuntos.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => abrirArchivo(pendienteId, a)}
                className="h-24 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
                aria-label={`Abrir ${a.nombre}`}
              >
                <Miniatura pendienteId={pendienteId} adjunto={a} />
              </button>
              <div className="p-2 space-y-0.5 min-w-0">
                <p className="text-[11px] font-bold text-slate-800 truncate" title={a.nombre}>
                  {a.nombre}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatoTamano(a.tamano)} · {a.subidoPor?.nombre || '—'} · {formatoFechaHora(a.creadoEn)}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  {a.webUrl && (
                    <a href={a.webUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-600" aria-label="Ver en OneDrive" title="Ver en OneDrive">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {a.puedeQuitar && (
                    <button
                      type="button"
                      disabled={quitar.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Quitar "${a.nombre}" del pendiente? El archivo se queda en OneDrive.`)) quitar.mutate(a);
                      }}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      aria-label={`Quitar ${a.nombre}`}
                      title="Quitar del pendiente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {puedeAgregar && onedrive?.requiereReconexion && <p className="text-[11px] text-amber-800">La conexión con OneDrive venció: un administrador debe reconectarla en Configuración › OneDrive.</p>}
      {puedeAgregar && onedrive?.configurado && !onedrive.requiereReconexion && !onedrive.carpeta && (
        <p className="text-[11px] text-amber-800">Esta obra no tiene carpeta de OneDrive vinculada: vincúlala desde la lista de pendientes para adjuntar archivos.</p>
      )}
      {puedeSubir && (
        <div className="space-y-1.5">
          <BotonesAdjuntar disabled={!!subiendo} onArchivos={agregar} />
          {subiendo && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500" role="status">
              <Loader2 className="w-3 h-3 animate-spin" /> Subiendo {Math.min(subiendo.hechos + 1, subiendo.total)} de {subiendo.total}…
            </p>
          )}
        </div>
      )}
    </div>
  );
};
