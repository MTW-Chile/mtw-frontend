import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ImageIcon, X } from 'lucide-react';
import { getOneDriveObra } from '../../../../api/client';
import { Button } from '../../../../components/ui/Button';
import { BotonesAdjuntar } from './BotonesAdjuntar';
import { VincularCarpetaModal } from './VincularCarpetaModal';
import { esImagen, formatoTamano, mimeDeArchivo } from './utils';

interface Props {
  proyectoId: string;
  archivos: File[];
  onChange: (archivos: File[]) => void;
  disabled?: boolean;
}

// Adjuntos al CREAR un pendiente (opcionales). Los archivos quedan en el
// formulario y se suben cuando el pendiente ya existe. Sin OneDrive configurado
// no se muestra nada; sin carpeta de la obra vinculada se pide vincularla.
export const AdjuntosNuevoPendiente: React.FC<Props> = ({ proyectoId, archivos, onChange, disabled }) => {
  const [vinculando, setVinculando] = useState(false);
  const { data } = useQuery({ queryKey: ['onedrive', proyectoId], queryFn: () => getOneDriveObra(proyectoId), staleTime: 1000 * 60 });
  if (!data?.configurado) return null;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Fotos o documentos (opcional)</span>
      {!data.carpeta ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          <span className="flex-1 min-w-[12rem]">Para adjuntar archivos, primero vincula la carpeta de OneDrive de esta obra.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setVinculando(true)}>
            Vincular carpeta
          </Button>
        </div>
      ) : (
        <>
          <BotonesAdjuntar disabled={disabled} onArchivos={(nuevos) => onChange([...archivos, ...nuevos])} />
          {archivos.length > 0 && (
            <ul className="space-y-1" aria-label="Archivos por adjuntar">
              {archivos.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
                  {esImagen(mimeDeArchivo(f.name, f.type)) ? <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <span className="flex-1 min-w-0 truncate text-slate-800" title={f.name}>
                    {f.name}
                  </span>
                  <span className="text-slate-400 shrink-0">{formatoTamano(f.size)}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(archivos.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    aria-label={`Quitar ${f.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {vinculando && <VincularCarpetaModal proyectoId={proyectoId} onClose={() => setVinculando(false)} />}
    </div>
  );
};
