import React, { Suspense, lazy } from 'react';
import { useCotizadorWorkspace } from './hooks/useCotizadorWorkspace';
import { HeaderContexto } from './components/workspace/HeaderContexto';
import { WorkspaceFooter } from './components/workspace/WorkspaceFooter';
import { ReimportModal } from './components/workspace/ReimportModal';
import { Loader } from '../../components/ui/Loader';
import { ErrorCarga } from '../../components/ui/Estados';
import { Button } from '../../components/ui/Button';
import { useMigas } from '../../lib/migas';
import { STEPS } from './components/workspace/pasos';

// Cada paso se carga sólo cuando el usuario lo abre, no en el primer
// render del cotizador: Step2 arrastra todo el motor de geometría SVG
// (geometryCore.ts + windowGeometryBuilder.ts, ~2100 líneas) y Step3/Step4
// importan jsPDF -- nada de eso hace falta para ver, por ejemplo, sólo el
// Paso 1 de una obra.
const Step1DatosCliente = lazy(() => import('./steps/Step1DatosCliente/Step1DatosCliente').then((m) => ({ default: m.Step1DatosCliente })));
const Step2Lineas = lazy(() => import('./steps/Step2Lineas/Step2Lineas').then((m) => ({ default: m.Step2Lineas })));
const Step3Materiales = lazy(() => import('./steps/Step3Materiales/Step3Materiales').then((m) => ({ default: m.Step3Materiales })));
const Step4Fijaciones = lazy(() => import('./steps/Step4Fijaciones/Step4Fijaciones').then((m) => ({ default: m.Step4Fijaciones })));
const Step5Consolidacion = lazy(() => import('./steps/Step5Consolidacion/Step5Consolidacion').then((m) => ({ default: m.Step5Consolidacion })));

const StepFallback: React.FC = () => <Loader block size="lg" />;

interface CotizadorWorkspaceProps {
  proyectoId: string;
  onBack: () => void;
  // Deep-link (ej. desde el Centro de Notificaciones o el link de un
  // correo de aprobacion pendiente) -- salta directo al Paso 4
  // (Hoja de Fijación), donde está el botón "Aprobar (Gerencia)", en vez de
  // arrancar siempre en el Paso 1.
  pasoInicial?: 1 | 2 | 3 | 4 | 5;
}

export const CotizadorWorkspace: React.FC<CotizadorWorkspaceProps> = ({ proyectoId, onBack, pasoInicial }) => {
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
    numeroInterno,
    handleGuardarNumeroInterno,
    codigoInternoMutation,
    obraMutation,
    estadoAprobacionMutation,
    handleCrearVersionInterna,
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
  } = useCotizadorWorkspace(proyectoId, pasoInicial);
  useMigas(1, [{ label: STEPS.find((x) => x.step === currentStep)?.label ?? '' }]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader block size="lg" label="Cargando cotizador de la obra..." />
      </div>
    );
  }

  if (isError || !proyecto) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <ErrorCarga que="la obra" />
          <Button variant="secondary" size="sm" onClick={onBack}>
            Volver al listado
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 text-slate-900 animate-fade-in">
      {/* Contexto del cotizador (paso, código, estado, Rev, reimportar) dentro del Header del sitio */}
      <HeaderContexto proyecto={proyecto} activeVersion={activeVersion} />

      {/* CONTENIDO PRINCIPAL SEGÚN EL PASO ACTIVO */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1600px] w-full mx-auto space-y-6">
      <Suspense fallback={<StepFallback />}>
        {currentStep === 1 && (
          <Step1DatosCliente
            proyecto={proyecto}
            activeVersion={activeVersion}
            selectedVersionIdx={selectedVersionIdx}
            onSelectVersion={handleSelectVersion}
            isSavingVersion={setVersionActivaMutation.isPending}
            numeroInterno={numeroInterno}
            onGuardarNumeroInterno={handleGuardarNumeroInterno}
            isSavingNumeroInterno={codigoInternoMutation.isPending}
            onGuardarObra={(obra) => obraMutation.mutate(obra)}
            isSavingObra={obraMutation.isPending}
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
            onOpenReimport={() => setShowReimportModal(true)}
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
            onSaveDivisas={(onGuardado) => updateConfigMutation.mutate(undefined, { onSuccess: onGuardado })}
            isSavingDivisas={updateConfigMutation.isPending}
          />
        )}

        {currentStep === 4 && (
          <Step4Fijaciones
            proyecto={proyecto}
            activeVersion={activeVersion}
            dolar={dolar}
            uf={uf}
            euro={euro}
            onCambiarEstadoAprobacion={(estado) => estadoAprobacionMutation.mutate(estado)}
            isCambiandoEstadoAprobacion={estadoAprobacionMutation.isPending}
          />
        )}

        {currentStep === 5 && (
          <Step5Consolidacion
            proyecto={proyecto}
            activeVersion={activeVersion}
            dolar={dolar}
            uf={uf}
            euro={euro}
            onCambiarEstadoAprobacion={(estado) => estadoAprobacionMutation.mutate(estado)}
            isCambiandoEstadoAprobacion={estadoAprobacionMutation.isPending}
            onCrearVersionInterna={handleCrearVersionInterna}
            isCreandoVersionInterna={setVersionActivaMutation.isPending}
          />
        )}
      </Suspense>
      </div>

      {/* FOOTER INFERIOR DE NAVEGACIÓN */}
      <WorkspaceFooter currentStep={currentStep} saveSuccess={saveSuccess} onStepChange={setCurrentStep} />

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
