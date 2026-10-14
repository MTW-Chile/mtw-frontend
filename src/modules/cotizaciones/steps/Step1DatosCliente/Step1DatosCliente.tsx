import React from 'react';
import type { Cliente, Proyecto, ProyectoVersion } from '../../../../types';
import type { NuevoClienteForm } from '../../hooks/useCotizadorWorkspace';
import { IndicadoresMetricos } from './IndicadoresMetricos';
import { ClienteManager } from './ClienteManager';
import { VersionActivaCard } from './VersionActivaCard';

interface Step1DatosClienteProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  selectedVersionIdx: number;
  onSelectVersion: (index: number) => void;
  isSavingVersion: boolean;
  numeroInterno: string;
  onGuardarNumeroInterno: (numero: string) => void;
  isSavingNumeroInterno: boolean;
  // Cliente
  clientMode: 'view' | 'select' | 'create';
  setClientMode: (mode: 'view' | 'select' | 'create') => void;
  searchClientTerm: string;
  setSearchClientTerm: (term: string) => void;
  filteredMasterClientes: Cliente[];
  nuevoCliente: NuevoClienteForm;
  onUpdateNuevoCliente: (field: keyof NuevoClienteForm, value: string) => void;
  onVincularCliente: (clienteId: string | null) => void;
  onCrearCliente: () => void;
  isCrearPending: boolean;
}

export const Step1DatosCliente: React.FC<Step1DatosClienteProps> = ({
  proyecto,
  activeVersion,
  selectedVersionIdx,
  onSelectVersion,
  isSavingVersion,
  numeroInterno,
  onGuardarNumeroInterno,
  isSavingNumeroInterno,
  clientMode,
  setClientMode,
  searchClientTerm,
  setSearchClientTerm,
  filteredMasterClientes,
  nuevoCliente,
  onUpdateNuevoCliente,
  onVincularCliente,
  onCrearCliente,
  isCrearPending,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start animate-fade-in">
      {/* 1. Contenedor: Versión de HETMO, Número de Presupuesto y Selector de Cliente (50% desktop, responsivo) */}
      <VersionActivaCard
        proyecto={proyecto}
        activeVersion={activeVersion}
        selectedVersionIdx={selectedVersionIdx}
        onSelectVersion={onSelectVersion}
        isSaving={isSavingVersion}
        numeroInterno={numeroInterno}
        onGuardarNumeroInterno={onGuardarNumeroInterno}
        isSavingNumeroInterno={isSavingNumeroInterno}
      >
        <ClienteManager
          proyecto={proyecto}
          currentClient={proyecto.cliente}
          clientMode={clientMode}
          setClientMode={setClientMode}
          searchClientTerm={searchClientTerm}
          setSearchClientTerm={setSearchClientTerm}
          filteredMasterClientes={filteredMasterClientes}
          nuevoCliente={nuevoCliente}
          onUpdateNuevoCliente={onUpdateNuevoCliente}
          onVincularCliente={onVincularCliente}
          onCrearCliente={onCrearCliente}
          isCrearPending={isCrearPending}
          embedded
        />
      </VersionActivaCard>

      {/* 2. Contenedor General: Indicadores Técnicos y Métricos de la Obra (50% desktop, vertical) */}
      <IndicadoresMetricos activeVersion={activeVersion} />
    </div>
  );
};
