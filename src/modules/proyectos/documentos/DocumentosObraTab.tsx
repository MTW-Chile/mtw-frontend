import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ExternalLink, File, FileText, Folder, FolderPlus, Home, Loader2, FolderOpen } from 'lucide-react';
import { crearCarpetaDocumento, getContenidoDocumentoObra, getDocumentosObra, getOneDriveEstado, subirDocumentoObra } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ItemOneDrive, Proyecto } from '../../../types';
import { formatoFechaHora } from '../fabricacion/utils';
import { BotonesAdjuntar } from '../pendientes/adjuntos/BotonesAdjuntar';
import { formatoTamano, mimeDeArchivo } from '../pendientes/adjuntos/utils';
import { InputCompacto } from '../../../components/ui/Campos';
import { BotonFila } from '../../../components/ui/Lista';
import { EncabezadoSeccion } from '../../../components/ui/EncabezadoSeccion';

interface Miga {
  id: string;
  nombre: string;
}

const avisoError = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

// Abre el archivo en una pestaña nueva (la API lo sirve: nadie necesita sesion de OneDrive).
async function abrirArchivo(proyectoId: string, item: ItemOneDrive) {
  try {
    const blob = await getContenidoDocumentoObra(proyectoId, item.id, item.nombre);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    avisoError(e);
  }
}

// "Documentos" de la obra: navega la MISMA carpeta de OneDrive ya vinculada
// (ver CarpetaObraBoton/VincularCarpetaModal), para ver y administrar todo lo
// que hay ahi (no solo los adjuntos de pendientes). Sin base de datos propia:
// es una ventana directa al contenido real de OneDrive.
export const DocumentosObraTab: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const queryClient = useQueryClient();
  const [migas, setMigas] = useState<Miga[]>([]);
  const [creandoCarpeta, setCreandoCarpeta] = useState(false);
  const [nombreCarpeta, setNombreCarpeta] = useState('');
  const [subiendo, setSubiendo] = useState<{ hechos: number; total: number } | null>(null);

  const { data: estado } = useQuery({ queryKey: ['onedriveEstado'], queryFn: () => getOneDriveEstado(), staleTime: 1000 * 60 });
  const carpetaActual = migas.length ? migas[migas.length - 1].id : (proyecto.onedriveCarpetaId ?? undefined);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['documentosObra', proyecto.id, carpetaActual],
    queryFn: () => getDocumentosObra(proyecto.id, carpetaActual),
    enabled: !!proyecto.onedriveCarpetaId,
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['documentosObra', proyecto.id, carpetaActual] });

  const crearCarpeta = useMutation({
    mutationFn: (nombre: string) => crearCarpetaDocumento(proyecto.id, carpetaActual!, nombre),
    onSuccess: () => {
      setCreandoCarpeta(false);
      setNombreCarpeta('');
      refrescar();
    },
    onError: avisoError,
  });

  const subir = async (archivos: File[]) => {
    if (!carpetaActual) return;
    setSubiendo({ hechos: 0, total: archivos.length });
    const fallidos: string[] = [];
    for (let i = 0; i < archivos.length; i++) {
      setSubiendo({ hechos: i, total: archivos.length });
      const f = archivos[i];
      try {
        await subirDocumentoObra(proyecto.id, carpetaActual, f, f.name, mimeDeArchivo(f.name, f.type));
      } catch (e) {
        fallidos.push(`${f.name}: ${extraerErrorParaToast(e).mensaje}`);
      }
    }
    setSubiendo(null);
    refrescar();
    if (fallidos.length) mostrarToast(`No se pudo subir: ${fallidos.join(' · ')}`);
  };

  if (!proyecto.onedriveCarpetaId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {estado?.conectada
          ? 'Esta obra no tiene carpeta de OneDrive vinculada: vincúlala desde la lista de Obras en curso para ver y subir documentos.'
          : 'OneDrive no está conectado: un administrador debe conectarlo en Configuración > OneDrive.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EncabezadoSeccion icono={FolderOpen} antetitulo="Obra" titulo="Documentos" descripcion="Carpeta de OneDrive de la obra: planos, contratos, fotos y documentos de los pendientes." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1 text-xs font-bold text-slate-500 flex-wrap" aria-label="Ruta de carpetas">
          <Button variant="ghost" size="sm" leftIcon={<Home className="w-3.5 h-3.5" />} onClick={() => setMigas([])}>{proyecto.onedriveCarpetaNombre || 'Carpeta de la obra'}</Button>
          {migas.map((m, i) => (
            <React.Fragment key={m.id}>
              <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
              <Button variant="ghost" size="sm" onClick={() => setMigas(migas.slice(0, i + 1))} title={m.nombre}>{m.nombre}</Button>
            </React.Fragment>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" leftIcon={<FolderPlus className="w-3.5 h-3.5" />} onClick={() => setCreandoCarpeta(true)}>
            Nueva carpeta
          </Button>
          <BotonesAdjuntar disabled={!!subiendo} onArchivos={subir} />
        </div>
      </div>

      {creandoCarpeta && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
          <InputCompacto autoFocus value={nombreCarpeta} onChange={(e) => setNombreCarpeta(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && nombreCarpeta.trim()) crearCarpeta.mutate(nombreCarpeta.trim());
              if (e.key === 'Escape') setCreandoCarpeta(false);
            }} placeholder="Nombre de la carpeta" maxLength={120} aria-label="Nombre de la carpeta nueva" className="flex-1 min-w-0" />
          <Button size="sm" variant="primary" isLoading={crearCarpeta.isPending} disabled={!nombreCarpeta.trim()} onClick={() => crearCarpeta.mutate(nombreCarpeta.trim())}>
            Crear
          </Button>
          <Button size="sm" variant="ghost" disabled={crearCarpeta.isPending} onClick={() => setCreandoCarpeta(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {subiendo && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500" role="status">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo {Math.min(subiendo.hechos + 1, subiendo.total)} de {subiendo.total}…
        </p>
      )}

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">No se pudo leer el contenido de la carpeta.</div>
      ) : !data?.items.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Esta carpeta está vacía.</div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {data.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <BotonFila
                sinRelleno
                onClick={() => (item.tipo === 'carpeta' ? setMigas([...migas, { id: item.id, nombre: item.nombre }]) : abrirArchivo(proyecto.id, item))}
                className="flex-1 min-w-0 flex items-center gap-3"
              >
                {item.tipo === 'carpeta' ? (
                  <Folder className="w-4.5 h-4.5 text-brand-500 shrink-0" />
                ) : item.mime?.startsWith('image/') ? (
                  <FileText className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                ) : (
                  <File className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                )}
                <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 truncate" title={item.nombre}>
                  {item.nombre}
                </span>
              </BotonFila>
              <span className="text-[11px] text-slate-400 shrink-0 hidden sm:inline">{item.tamano != null ? formatoTamano(item.tamano) : ''}</span>
              <span className="text-[11px] text-slate-400 shrink-0 hidden md:inline">{formatoFechaHora(item.modificadoEn)}</span>
              {item.webUrl && (
                <a
                  href={item.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-brand-600 shrink-0"
                  aria-label={`Abrir ${item.nombre} en OneDrive`}
                  title="Abrir en OneDrive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
