import React, { useState } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';
import { SubTabs, type SubTab } from '../../../../components/ui/PageHeader';
import { EstadoComercialCard } from './EstadoComercialCard';
import { PresupuestoOferta } from './PresupuestoOferta';
import { useMigas } from '../../../../lib/migas';

type EstadoAprobacion = 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA' | 'ACEPTADO_CLIENTE';

type SubTabId = 'oferta-cliente' | 'estado-oferta';

const SUB_TABS: SubTab<SubTabId>[] = [
  { id: 'oferta-cliente', label: 'Oferta Cliente', icon: FileText },
  { id: 'estado-oferta', label: 'Estado Oferta Comercial', icon: ShieldCheck },
];

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

// Oferta Comercial: el preparador del PDF para el cliente (Oferta Cliente) y
// el estado comercial interno de la oferta. La aprobación gerencial ya no
// vive acá -- se pide y se da desde la Hoja de Fijación (Paso 4).
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
  const [subTab, setSubTab] = useState<SubTabId>('oferta-cliente');
  useMigas(2, [{ label: SUB_TABS.find((t) => t.id === subTab)?.label ?? '' }]);

  return (
    <div className="space-y-6 animate-fade-in">
      <SubTabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'oferta-cliente' && (
        <PresupuestoOferta proyecto={proyecto} activeVersion={activeVersion} dolar={dolar} uf={uf} euro={euro} />
      )}

      {subTab === 'estado-oferta' && (
        <EstadoComercialCard
          activeVersion={activeVersion}
          onCambiarEstado={onCambiarEstadoAprobacion}
          isCambiandoEstado={isCambiandoEstadoAprobacion}
          onCrearVersionInterna={onCrearVersionInterna}
          isCreandoVersion={isCreandoVersionInterna}
        />
      )}
    </div>
  );
};
