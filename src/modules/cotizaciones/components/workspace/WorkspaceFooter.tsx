import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SelectorPaso } from './SelectorPaso';
import { STEPS, type CotizadorStep } from './pasos';
import { Button } from '../../../../components/ui/Button';

interface WorkspaceFooterProps {
  currentStep: CotizadorStep;
  saveSuccess: boolean;
  onStepChange: (step: CotizadorStep) => void;
}

// Navegación del cotizador: selector de paso a la izquierda, Anterior /
// Continuar a la derecha. Los textos salen de STEPS (pasos.ts).
export const WorkspaceFooter: React.FC<WorkspaceFooterProps> = ({ currentStep, saveSuccess, onStepChange }) => {
  const anterior = STEPS.find((s) => s.step === currentStep - 1);
  const siguiente = STEPS.find((s) => s.step === currentStep + 1);

  return (
    <footer className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-md px-3.5 sm:px-8 py-2.5 sm:py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        <SelectorPaso currentStep={currentStep} onStepChange={onStepChange} />

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {saveSuccess && (
            <span className="hidden md:flex text-xs text-emerald-600 font-semibold items-center gap-1.5 animate-fade-in mr-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Parámetros guardados con éxito
            </span>
          )}

          {anterior && (
            <Button variant="outline" className="shrink-0" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => onStepChange(anterior.step)}>
              Anterior
            </Button>
          )}

          {siguiente && (
            <Button className="min-w-0" rightIcon={<ArrowRight className="w-4 h-4" />} onClick={() => onStepChange(siguiente.step)}>
              <span className="hidden sm:inline">Continuar a </span>
              {siguiente.label}
            </Button>
          )}
        </div>
      </div>
    </footer>
  );
};
