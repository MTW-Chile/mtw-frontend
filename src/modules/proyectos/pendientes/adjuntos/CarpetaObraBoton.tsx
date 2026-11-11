import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { getOneDriveEstado } from '../../../../api/client';
import { Button } from '../../../../components/ui/Button';
import { IconButton } from '../../../../components/ui/IconButton';
import type { AmbitoCarpeta, Proyecto } from '../../../../types';
import { carpetaDeObra } from './utils';
import { VincularCarpetaModal } from './VincularCarpetaModal';

// Boton de las listas de obras: vincula la obra con su carpeta de OneDrive (la comercial,
// donde van tambien los adjuntos de pendientes, o la de produccion, segun `ambito`) o,
// si ya esta vinculada, permite abrirla, cambiarla o quitar el vinculo. No se muestra si
// OneDrive no esta conectado (Configuracion > OneDrive). Se lee la carpeta de la propia
// obra: la lista NO consulta OneDrive fila por fila.
// `ambito`: la carpeta comercial (Comercial › Obras en curso) o la de producción (Taller › Fabricación).
export const CarpetaObraBoton: React.FC<{
  proyecto: Pick<Proyecto, 'id' | 'obra' | 'onedriveCarpetaId' | 'onedriveCarpetaNombre' | 'onedriveCarpetaProduccionId' | 'onedriveCarpetaProduccionNombre'>;
  ambito?: AmbitoCarpeta;
  /** Donde el contexto ya dice que es la de producción (columna de la tabla, sección Documentos de producción): texto corto. */
  corto?: boolean;
  /** Solo el ícono (tablas donde la columna no cabe con texto); el nombre va en el title. */
  soloIcono?: boolean;
}> = ({ proyecto, ambito = 'comercial', corto = false, soloIcono = false }) => {
  const [abierto, setAbierto] = useState(false);
  const { data: estado } = useQuery({ queryKey: ['onedriveEstado'], queryFn: () => getOneDriveEstado(), staleTime: 1000 * 60 });
  if (!estado?.conectada) return null;

  const carpeta = carpetaDeObra(proyecto, ambito);
  const vinculada = !!carpeta.id;
  const cual = ambito === 'produccion' ? 'carpeta de producción' : 'carpeta de OneDrive';
  const titulo = vinculada ? `Carpeta vinculada: ${carpeta.nombre ?? ''}. Clic para abrirla, cambiarla o quitarla.` : `Vincular la ${cual} de esta obra`;
  return (
    // Vive dentro de una fila clicable: ni el boton ni la ventana (los eventos de React suben por el
    // arbol aunque sea fixed) deben abrir la obra.
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      {soloIcono ? (
        <IconButton
          icono={vinculada ? FolderOpen : FolderPlus}
          etiqueta={titulo}
          className={vinculada ? 'text-brand-600' : 'text-amber-600'}
          onClick={() => setAbierto(true)}
        />
      ) : (
      <Button
        size="sm"
        variant={vinculada ? 'outline' : 'ghost'}
        leftIcon={vinculada ? <FolderOpen className="w-3.5 h-3.5 text-brand-600" /> : <FolderPlus className="w-3.5 h-3.5 text-amber-600" />}
        onClick={() => setAbierto(true)}
        title={titulo}
        aria-label={vinculada ? `${ambito === 'produccion' ? 'Carpeta de producción' : 'Carpeta vinculada'} de ${proyecto.obra}` : `Vincular ${cual} de ${proyecto.obra}`}
      >
        {ambito === 'produccion' && !corto ? (vinculada ? 'Carpeta de producción' : 'Vincular carpeta de producción') : vinculada ? 'Carpeta vinculada' : 'Vincular carpeta'}
      </Button>
      )}
      {abierto && <VincularCarpetaModal proyectoId={proyecto.id} ambito={ambito} onClose={() => setAbierto(false)} />}
    </span>
  );
};
