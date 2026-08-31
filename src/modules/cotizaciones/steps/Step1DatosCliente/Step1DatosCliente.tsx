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
    <div className="space-y-6 animate-fade-in">
      {/* 1. Confirmacion de la version de HETMO que se va a presupuestar */}
      <VersionActivaCard
        proyecto={proyecto}
        activeVersion={activeVersion}
        selectedVersionIdx={selectedVersionIdx}
        onSelectVersion={onSelectVersion}
        isSaving={isSavingVersion}
      />

      {/* 2. Indicadores Técnicos y Métricos de la Obra */}
      <IndicadoresMetricos activeVersion={activeVersion} />

      {/* 2. Identificación y Asignación de Cliente */}
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
      />
    </div>
  );
};
