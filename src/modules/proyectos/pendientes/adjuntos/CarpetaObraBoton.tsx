import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { getOneDriveEstado } from '../../../../api/client';
import { Button } from '../../../../components/ui/Button';
import type { Proyecto } from '../../../../types';
import { VincularCarpetaModal } from './VincularCarpetaModal';

// Boton de la lista "Obras en curso": vincula la obra con su carpeta de OneDrive (para
// TODA la obra: ahi van los adjuntos de pendientes y, mas adelante, otros documentos) o,
// si ya esta vinculada, permite abrirla, cambiarla o quitar el vinculo. No se muestra si
// OneDrive no esta conectado (Configuracion > OneDrive). Se lee la carpeta de la propia
// obra: la lista NO consulta OneDrive fila por fila.
export const CarpetaObraBoton: React.FC<{ proyecto: Pick<Proyecto, 'id' | 'obra' | 'onedriveCarpetaId' | 'onedriveCarpetaNombre'> }> = ({ proyecto }) => {
  const [abierto, setAbierto] = useState(false);
  const { data: estado } = useQuery({ queryKey: ['onedriveEstado'], queryFn: () => getOneDriveEstado(), staleTime: 1000 * 60 });
  if (!estado?.conectada) return null;

  const vinculada = !!proyecto.onedriveCarpetaId;
  return (
    // Vive dentro de una fila clicable: ni el boton ni la ventana (los eventos de React suben por el
    // arbol aunque sea fixed) deben abrir la obra.
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <Button
        size="sm"
        variant={vinculada ? 'outline' : 'ghost'}
        leftIcon={vinculada ? <FolderOpen className="w-3.5 h-3.5 text-brand-600" /> : <FolderPlus className="w-3.5 h-3.5 text-amber-600" />}
        onClick={() => setAbierto(true)}
        title={vinculada ? `Carpeta vinculada: ${proyecto.onedriveCarpetaNombre ?? ''}. Clic para abrirla, cambiarla o quitarla.` : 'Vincular la carpeta de OneDrive de esta obra'}
        aria-label={vinculada ? `Carpeta vinculada de ${proyecto.obra}` : `Vincular carpeta de ${proyecto.obra}`}
      >
        {vinculada ? 'Carpeta vinculada' : 'Vincular carpeta'}
      </Button>
      {abierto && <VincularCarpetaModal proyectoId={proyecto.id} onClose={() => setAbierto(false)} />}
    </span>
  );
};
