import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SelectorPaso } from './SelectorPaso';
import { STEPS, type CotizadorStep } from './pasos';

interface WorkspaceFooterProps {
  currentStep: CotizadorStep;
  saveSuccess: boolean;
  onStepChange: (step: CotizadorStep) => void;
}

// Navegación del cotizador: Anterior / Continuar a la izquierda, selector de
// paso a la derecha. Los textos salen de STEPS (pasos.ts).
export const WorkspaceFooter: React.FC<WorkspaceFooterProps> = ({ currentStep, saveSuccess, onStepChange }) => {
  const anterior = STEPS.find((s) => s.step === currentStep - 1);
  const siguiente = STEPS.find((s) => s.step === currentStep + 1);

  return (
    <footer className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-md px-3.5 sm:px-8 py-2.5 sm:py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {anterior && (
            <button
              onClick={() => onStepChange(anterior.step)}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-colors border bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
          )}

          {siguiente && (
            <button
              onClick={() => onStepChange(siguiente.step)}
              className="px-3.5 sm:px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition-all flex items-center gap-2 cursor-pointer min-w-0"
            >
              <span className="truncate">
                <span className="hidden sm:inline">Continuar a </span>
                {siguiente.label}
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {saveSuccess && (
            <span className="hidden md:flex text-xs text-emerald-600 font-semibold items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Parámetros guardados con éxito
            </span>
          )}
          <SelectorPaso currentStep={currentStep} onStepChange={onStepChange} />
        </div>
      </div>
    </footer>
  );
};
