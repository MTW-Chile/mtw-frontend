import React from 'react';
import { useCotizadorWorkspace } from './hooks/useCotizadorWorkspace';
import { WorkspaceHeader } from './components/workspace/WorkspaceHeader';
import { WorkspaceStepper } from './components/workspace/WorkspaceStepper';
import { WorkspaceFooter } from './components/workspace/WorkspaceFooter';
import { ReimportModal } from './components/workspace/ReimportModal';
import { Step1DatosCliente } from './steps/Step1DatosCliente/Step1DatosCliente';
import { Step2Lineas } from './steps/Step2Lineas/Step2Lineas';
import { Step3Materiales } from './steps/Step3Materiales/Step3Materiales';
import { Step4Fijaciones } from './steps/Step4Fijaciones/Step4Fijaciones';
import { Step5Consolidacion } from './steps/Step5Consolidacion/Step5Consolidacion';

interface CotizadorWorkspaceProps {
  proyectoId: string;
  onBack: () => void;
}

export const CotizadorWorkspace: React.FC<CotizadorWorkspaceProps> = ({ proyectoId, onBack }) => {
  const {
    proyecto,
    isLoading,
    isError,
    activeVersion,
    currentStep,
    setCurrentStep,
    selectedVersionIdx,
    handleSelectVersion,
    setVersionActivaMutation,
    showReimportModal,
    setShowReimportModal,
    // Divisas
    dolar,
    setDolar,
    uf,
    setUf,
    euro,
    setEuro,
    saveSuccess,
    updateConfigMutation,
    // Cliente
    clientMode,
    setClientMode,
    searchClientTerm,
    setSearchClientTerm,
    filteredMasterClientes,
    nuevoCliente,
    updateNuevoClienteField,
    vincularClienteMutation,
    crearClienteMutation,
    // Reimportar
    reimportMutation,
  } = useCotizadorWorkspace(proyectoId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-700">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#E34A26] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-mono">Cargando cotizador de la obra...</div>
        </div>
      </div>
    );
  }

  if (isError || !proyecto) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-700">
        <div className="text-center space-y-4">
          <div className="text-red-500 font-bold text-sm">Error al cargar la obra.</div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 animate-fade-in">
      {/* HEADER SUPERIOR */}
      <WorkspaceHeader
        proyecto={proyecto}
        activeVersion={activeVersion}
        selectedVersionIdx={selectedVersionIdx}
        onSelectVersion={handleSelectVersion}
        onBack={onBack}
        onOpenReimport={() => setShowReimportModal(true)}
      />

      {/* STEPPER HORIZONTAL DE LOS 5 PASOS */}
      <WorkspaceStepper
        currentStep={currentStep}
        onStepChange={setCurrentStep}
      />

      {/* CONTENIDO PRINCIPAL SEGÚN EL PASO ACTIVO */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        {currentStep === 1 && (
          <Step1DatosCliente
            proyecto={proyecto}
            activeVersion={activeVersion}
            selectedVersionIdx={selectedVersionIdx}
            onSelectVersion={handleSelectVersion}
            isSavingVersion={setVersionActivaMutation.isPending}
            clientMode={clientMode}
            setClientMode={setClientMode}
            searchClientTerm={searchClientTerm}
            setSearchClientTerm={setSearchClientTerm}
            filteredMasterClientes={filteredMasterClientes}
            nuevoCliente={nuevoCliente}
            onUpdateNuevoCliente={updateNuevoClienteField}
            onVincularCliente={(id) => vincularClienteMutation.mutate(id)}
            onCrearCliente={() => crearClienteMutation.mutate()}
            isCrearPending={crearClienteMutation.isPending}
          />
        )}

        {currentStep === 2 && (
          <Step2Lineas
            proyecto={proyecto}
            activeVersion={activeVersion}
          />
        )}

        {currentStep === 3 && (
          <Step3Materiales
            proyecto={proyecto}
            activeVersion={activeVersion}
            dolar={dolar}
            setDolar={setDolar}
            uf={uf}
            setUf={setUf}
            euro={euro}
            setEuro={setEuro}
            saveSuccess={saveSuccess}
            onSaveDivisas={() => updateConfigMutation.mutate()}
            isSavingDivisas={updateConfigMutation.isPending}
          />
        )}

        {currentStep === 4 && (
          <Step4Fijaciones
            proyecto={proyecto}
            activeVersion={activeVersion}
          />
        )}

        {currentStep === 5 && (
          <Step5Consolidacion
            proyecto={proyecto}
            activeVersion={activeVersion}
          />
        )}
      </main>

      {/* FOOTER INFERIOR DE NAVEGACIÓN */}
      <WorkspaceFooter
        currentStep={currentStep}
        saveSuccess={saveSuccess}
        onPrevStep={() => setCurrentStep((prev) => (prev - 1) as any)}
        onNextStep={() => setCurrentStep((prev) => (prev + 1) as any)}
      />

      {/* MODAL REIMPORTAR HETMO */}
      <ReimportModal
        isOpen={showReimportModal}
        isPending={reimportMutation.isPending}
        onClose={() => setShowReimportModal(false)}
        onConfirm={() => reimportMutation.mutate()}
      />
    </div>
  );
};
