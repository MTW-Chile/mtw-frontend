import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, FolderOpen, FolderPlus } from 'lucide-react';
import { getOneDriveObra } from '../../../../api/client';
import { Button } from '../../../../components/ui/Button';
import { VincularCarpetaModal } from './VincularCarpetaModal';

// Cinta de la seccion de pendientes con la carpeta de OneDrive de la obra.
// No se muestra si el servidor no tiene OneDrive configurado (los adjuntos
// quedan ocultos en toda la pantalla).
export const CarpetaObraCard: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const [abierto, setAbierto] = useState(false);
  const { data } = useQuery({ queryKey: ['onedrive', proyectoId], queryFn: () => getOneDriveObra(proyectoId), staleTime: 1000 * 60 });
  if (!data?.configurado) return null;

  const carpeta = data.carpeta;
  if (data.requiereReconexion) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>La conexión con OneDrive venció: un administrador debe reconectarla en Configuración › OneDrive.</span>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
        {carpeta ? <FolderOpen className="w-4 h-4 text-brand-600 shrink-0" /> : <FolderPlus className="w-4 h-4 text-amber-600 shrink-0" />}
        <span className="text-slate-500">Carpeta de OneDrive:</span>
        {carpeta ? (
          <>
            <span className="font-bold text-slate-800 truncate max-w-[16rem]" title={carpeta.nombre ?? ''}>
              {carpeta.nombre}
            </span>
            {carpeta.url && (
              <a href={carpeta.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-600" aria-label="Abrir la carpeta en OneDrive">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <Button size="sm" variant="ghost" onClick={() => setAbierto(true)}>
              Cambiar
            </Button>
          </>
        ) : (
          <>
            <span className="text-amber-800">sin vincular: hace falta para adjuntar fotos y documentos.</span>
            <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
              Vincular carpeta
            </Button>
          </>
        )}
      </div>
      {abierto && <VincularCarpetaModal proyectoId={proyectoId} onClose={() => setAbierto(false)} />}
    </>
  );
};
