import React from 'react';
import type { Proyecto, ProyectoVersion } from '../../../../types';
import { EstadoComercialCard } from './EstadoComercialCard';
import { PresupuestoOferta } from './PresupuestoOferta';

type EstadoAprobacion = 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA' | 'ACEPTADO_CLIENTE';

interface Step5ConsolidacionProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  dolar: string;
  uf: string;
  euro: string;
  onCambiarEstadoAprobacion: (estado: EstadoAprobacion) => void;
  isCambiandoEstadoAprobacion: boolean;
  onCrearVersionInterna: (hetmoId: number) => void;
  isCreandoVersionInterna: boolean;
}

export const Step5Consolidacion: React.FC<Step5ConsolidacionProps> = ({
  proyecto,
  activeVersion,
  dolar,
  uf,
  euro,
  onCambiarEstadoAprobacion,
  isCambiandoEstadoAprobacion,
  onCrearVersionInterna,
  isCreandoVersionInterna,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <EstadoComercialCard
        activeVersion={activeVersion}
        onCambiarEstado={onCambiarEstadoAprobacion}
        isCambiandoEstado={isCambiandoEstadoAprobacion}
        onCrearVersionInterna={onCrearVersionInterna}
        isCreandoVersion={isCreandoVersionInterna}
      />

      <PresupuestoOferta proyecto={proyecto} activeVersion={activeVersion} dolar={dolar} uf={uf} euro={euro} />
    </div>
  );
};
