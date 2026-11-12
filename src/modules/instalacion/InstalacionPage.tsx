import React from 'react';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { useUrlParam } from '../../lib/navigation';
import { EspacioVentanas } from '../proyectos/obra/EspacioVentanas';
import { ObraNoDisponible, ObrasInstaladores, useObraInstaladores } from './ObrasInstaladores';

/**
 * Instaladores › Instalación: las obras en curso con su avance; al entrar a una, el plano del edificio para marcar
 * las ventanas instaladas y certificarlas en lote, con su foto. Recibir despachos e ingresar pendientes son secciones
 * aparte del mismo grupo (RecepcionObraPage, IngresoPendientesPage).
 */
export const InstalacionPage: React.FC = () => {
  const [obraId, setObraId] = useUrlParam('obra');
  const { obra, isLoading, isError, refetch } = useObraInstaladores(obraId);
  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion titulo="Instalación" />
      {!obraId ? <ObrasInstaladores seccion="instalacion" onElegir={(o) => setObraId(o.id)} /> : obra ? <EspacioVentanas key={obra.id} proyecto={obra} modo="instalacion" /> : <ObraNoDisponible cargando={isLoading} error={isError} onReintentar={refetch} />}
    </div>
  );
};
