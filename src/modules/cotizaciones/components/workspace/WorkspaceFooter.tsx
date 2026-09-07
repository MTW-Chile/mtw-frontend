import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { CotizadorStep } from './WorkspaceStepper';

interface WorkspaceFooterProps {
  currentStep: CotizadorStep;
  saveSuccess: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
}

const STEP_NEXT_LABELS: Record<number, string> = {
  1: 'Revisión de Líneas',
  2: 'Analítica de Materiales',
  3: 'Hoja de Fijación',
  4: 'Presupuesto en PDF',
};

export const WorkspaceFooter: React.FC<WorkspaceFooterProps> = ({
  currentStep,
  saveSuccess,
  onPrevStep,
  onNextStep,
}) => {
  return (
    <footer className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-md px-3.5 sm:px-8 py-2.5 sm:py-3.5">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 w-full">
        <div className="flex items-center gap-2 empty:hidden">
          {saveSuccess && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Parámetros guardados con éxito
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          {currentStep > 1 && (
            <button
              onClick={onPrevStep}
              className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-colors border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 cursor-pointer text-center"
            >
              ← Anterior
            </button>
          )}

          {currentStep < 5 && (
            <button
              onClick={onNextStep}
              className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-md shadow-[#E34A26]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continuar a {STEP_NEXT_LABELS[currentStep] || `Paso ${currentStep + 1}`}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
