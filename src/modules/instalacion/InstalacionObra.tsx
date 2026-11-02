import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProyectoById } from '../../api/client';
import { Cargando, ErrorCarga } from '../../components/ui/Estados';
import { EspacioVentanas } from '../proyectos/obra/EspacioVentanas';

/**
 * Instalación de una obra: el mismo espacio de trabajo que «Nuevos pendientes» (cubicación a la izquierda, ficha con
 * dibujo a la derecha), con dos acciones por ventana: registrar un pendiente o marcarla instalada. Ambas se juntan en
 * un listado y se envían en lote, de un solo tipo a la vez. Arriba, el avance y los despachos por recibir.
 */
export const InstalacionObra: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const { data: proyecto, isLoading, isError, refetch } = useQuery({ queryKey: ['proyectoDetail', proyectoId], queryFn: () => getProyectoById(proyectoId), staleTime: 1000 * 60 * 5 });
  if (isLoading) return <Cargando texto="Leyendo la obra…" />;
  if (isError || !proyecto) return <ErrorCarga que="la obra" onReintentar={refetch} />;
  return <EspacioVentanas proyecto={proyecto} modo="instalacion" />;
};
