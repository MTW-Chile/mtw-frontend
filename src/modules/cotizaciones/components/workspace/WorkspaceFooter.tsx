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
    <footer className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-4 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {saveSuccess && (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" /> Parámetros guardados con éxito en la base de datos
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {currentStep > 1 && (
          <button
            onClick={onPrevStep}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 cursor-pointer"
          >
            ← Paso Anterior
          </button>
        )}

        {currentStep < 5 && (
          <button
            onClick={onNextStep}
            className="px-5 py-2.5 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-lg shadow-[#E34A26]/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Continuar a {STEP_NEXT_LABELS[currentStep] || `Paso ${currentStep + 1}`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </footer>
  );
};
