import React from 'react';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { useUrlParam } from '../../lib/navigation';
import { EspacioVentanas } from '../proyectos/obra/EspacioVentanas';
import { ObraNoDisponible, ObrasInstaladores, useObraInstaladores } from './ObrasInstaladores';

/**
 * Instaladores › Pendientes: ingreso en terreno de lo que falta o falló. Se elige la obra, luego la ventana en el
 * plano, y se detalla el pendiente (marco, hoja, vidrio, material o ventana completa). El visor de los pendientes ya
 * ingresados es la sección Pendientes de Comercial, Taller y Abastecimiento.
 */
export const IngresoPendientesPage: React.FC = () => {
  const [obraId, setObraId] = useUrlParam('obra');
  const { obra, isLoading, isError, refetch } = useObraInstaladores(obraId);
  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion titulo="Ingreso de pendientes" />
      {!obraId ? <ObrasInstaladores seccion="pendientes" onElegir={(o) => setObraId(o.id)} /> : obra ? <EspacioVentanas key={obra.id} proyecto={obra} modo="pendientes" /> : <ObraNoDisponible cargando={isLoading} error={isError} onReintentar={refetch} />}
    </div>
  );
};
