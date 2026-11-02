import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { getContenidoDocumentoObra } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import type { ItemOneDrive } from '../../../types';

export type TipoVista = 'pdf' | 'imagen' | 'texto';

const EXT_TEXTO = new Set(['txt', 'csv', 'md', 'log', 'json', 'xml']);

/** Qué sabe mostrar el visor dentro del ERP. Office (Word, Excel) y el resto se abren en OneDrive. */
export function tipoDeVista(item: Pick<ItemOneDrive, 'nombre' | 'mime'>): TipoVista | null {
  const mime = (item.mime ?? '').toLowerCase();
  const ext = item.nombre.includes('.') ? item.nombre.split('.').pop()!.toLowerCase() : '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') && mime !== 'image/heic' && mime !== 'image/heif') return 'imagen';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'imagen';
  if (mime.startsWith('text/') || EXT_TEXTO.has(ext)) return 'texto';
  return null;
}

// Lector de documentos de la obra: el archivo lo sirve la API (nadie necesita sesión de
// OneDrive) y se muestra aquí mismo, sin salir de la obra ni descargarlo.
export const VisorDocumento: React.FC<{ proyectoId: string; item: ItemOneDrive; tipo: TipoVista; onClose: () => void }> = ({ proyectoId, item, tipo, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let objeto: string | null = null;
    getContenidoDocumentoObra(proyectoId, item.id, item.nombre)
      .then(async (blob) => {
        if (cancelado) return;
        if (tipo === 'texto') {
          setTexto(await blob.text());
          return;
        }
        const tipado = tipo === 'pdf' && blob.type !== 'application/pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob;
        objeto = URL.createObjectURL(tipado);
        setUrl(objeto);
      })
      .catch(() => !cancelado && setError(true));
    return () => {
      cancelado = true;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [proyectoId, item.id, item.nombre, tipo]);

  return (
    <Modal
      titulo={item.nombre}
      icono={FileText}
      ancho="completo"
      onClose={onClose}
      cuerpoClassName="flex-1 min-h-0 overflow-auto bg-slate-100 p-0"
      pie={
        item.webUrl ? (
          <Modal.Pie>
            <a href={item.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button variant="outline" size="sm" leftIcon={<ExternalLink className="w-3.5 h-3.5" />}>Abrir en OneDrive</Button>
            </a>
            <Button variant="primary" size="sm" onClick={onClose}>Cerrar</Button>
          </Modal.Pie>
        ) : undefined
      }
    >
      {error ? (
        <p className="p-8 text-center text-sm text-rose-700">No se pudo cargar el documento.</p>
      ) : tipo === 'texto' ? (
        texto === null ? <Cargando /> : <pre className="p-4 text-xs text-slate-800 whitespace-pre-wrap break-words font-mono bg-white min-h-full">{texto}</pre>
      ) : !url ? (
        <Cargando />
      ) : tipo === 'pdf' ? (
        <iframe src={url} title={item.nombre} className="w-full h-full min-h-[70dvh] border-0 bg-white" />
      ) : (
        <div className="p-4 flex justify-center">
          <img src={url} alt={item.nombre} className="max-w-full h-auto rounded-lg shadow-sm bg-white" />
        </div>
      )}
    </Modal>
  );
};

const Cargando: React.FC = () => (
  <div className="p-12 flex items-center justify-center text-slate-400">
    <Loader2 className="w-5 h-5 animate-spin" />
  </div>
);
