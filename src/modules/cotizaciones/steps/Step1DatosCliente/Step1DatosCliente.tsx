import React from 'react';
import type { Cliente, Proyecto, ProyectoVersion } from '../../../../types';
import type { NuevoClienteForm } from '../../hooks/useCotizadorWorkspace';
import { IndicadoresMetricos } from './IndicadoresMetricos';
import { ClienteManager } from './ClienteManager';
import { TipoProyectoCard } from './TipoProyectoCard';
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
  onGuardarObra: (obra: string) => void;
  isSavingObra: boolean;
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
  onOpenReimport: () => void;
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
  onGuardarObra,
  isSavingObra,
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
  onOpenReimport,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. Versión a presupuestar y número interno */}
      <VersionActivaCard
        proyecto={proyecto}
        activeVersion={activeVersion}
        selectedVersionIdx={selectedVersionIdx}
        onSelectVersion={onSelectVersion}
        isSaving={isSavingVersion}
        numeroInterno={numeroInterno}
        onGuardarNumeroInterno={onGuardarNumeroInterno}
        isSavingNumeroInterno={isSavingNumeroInterno}
        onGuardarObra={onGuardarObra}
        isSavingObra={isSavingObra}
        onOpenReimport={onOpenReimport}
      />

      {/* Tipo de proyecto: define las plantillas de textos por defecto */}
      <TipoProyectoCard proyecto={proyecto} congelado={(activeVersion?.estadoAprobacion ?? 'EN_COTIZACION') === 'ACEPTADO_CLIENTE'} />

      {/* 2. Cliente: vinculado, a vincular o a crear */}
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

      {/* 3. Resumen técnico de la obra */}
      <IndicadoresMetricos activeVersion={activeVersion} />
    </div>
  );
};
