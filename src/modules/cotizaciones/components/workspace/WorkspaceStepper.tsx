import React from 'react';

export type CotizadorStep = 1 | 2 | 3 | 4 | 5;

interface WorkspaceStepperProps {
  currentStep: CotizadorStep;
  onStepChange: (step: CotizadorStep) => void;
}

const STEPS: { step: CotizadorStep; label: string }[] = [
  { step: 1, label: 'Datos & Cliente' },
  { step: 2, label: 'Revisión de Líneas' },
  { step: 3, label: 'Analítica de Materiales' },
  { step: 4, label: 'Hoja de Fijación' },
  { step: 5, label: 'Consolidación & PDF' },
];

export const WorkspaceStepper: React.FC<WorkspaceStepperProps> = ({
  currentStep,
  onStepChange,
}) => {
  return (
    <div className="bg-white border-b border-slate-200/80 shadow-2xs px-3 sm:px-8 py-2.5 sm:py-3 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2 min-w-max">
        {STEPS.map((s, idx) => (
          <React.Fragment key={s.step}>
            <button
              onClick={() => onStepChange(s.step)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                currentStep === s.step
                  ? 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/30 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  currentStep === s.step
                    ? 'bg-[#E34A26] text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {s.step}
              </span>
              <span className="whitespace-nowrap">{s.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <span className="text-slate-300 font-bold text-xs shrink-0 select-none">➔</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
