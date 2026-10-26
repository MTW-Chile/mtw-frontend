import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { getProyectoById } from '../../../api/client';
import { WindowRendererSvg } from '../../cotizaciones/components/drawing/WindowRendererSvg';
import type { Proyecto, Ventana } from '../../../types';

/**
 * Dibujo de una ventana cubicada (VentanaObra.ventanaId apunta a la línea del
 * presupuesto, que es la que tiene geometría). Se busca en la versión activa
 * de la obra -- misma consulta ['proyectoDetail'] que usa el workspace, así
 * en Instalación se comparte el caché.
 */
export function ventanaDeProyecto(proyecto: Proyecto | undefined, ventanaId: string | null | undefined, lineaHetmo?: number | null): Ventana | undefined {
  if (!proyecto || (!ventanaId && lineaHetmo == null)) return undefined;
  const activa = proyecto.versiones.find((v) => v.hetmoId === proyecto.versionActivaHetmoId) ?? proyecto.versiones[0];
  const buscar = (vs: Ventana[] | undefined) => vs?.find((v) => (ventanaId ? v.id === ventanaId : v.lineaHetmo === lineaHetmo));
  return buscar(activa?.ventanas) ?? buscar(proyecto.versiones.flatMap((v) => v.ventanas ?? []));
}

/**
 * `ventanaId` es la linea del presupuesto; como alternativa, `lineaHetmo` (la
 * linea madre que trae una FabricacionVentana en hetmoVentanaMadreId).
 */
export const DibujoVentana: React.FC<{ proyectoId: string; ventanaId?: string | null; lineaHetmo?: number | null; className?: string; etiqueta?: string }> = ({ proyectoId, ventanaId, lineaHetmo, className = 'h-40', etiqueta }) => {
  const habilitado = !!ventanaId || lineaHetmo != null;
  const { data: proyecto, isLoading } = useQuery({ queryKey: ['proyectoDetail', proyectoId], queryFn: () => getProyectoById(proyectoId), enabled: habilitado, staleTime: 1000 * 60 * 5 });
  const ventana = ventanaDeProyecto(proyecto, ventanaId, lineaHetmo);
  return (
    <div className={`rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden ${className}`} aria-label={etiqueta ?? 'Dibujo de la ventana'}>
      {ventana ? (
        <WindowRendererSvg ventana={ventana} className="w-full h-full p-2" />
      ) : (
        <div className="flex flex-col items-center gap-1 text-slate-300 text-[11px]">
          <ImageOff className="w-5 h-5" />
          <span>{isLoading ? 'Cargando dibujo…' : 'Sin dibujo'}</span>
        </div>
      )}
    </div>
  );
};
