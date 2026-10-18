import React from 'react';
import { MenuDesplegable } from '../../../../components/ui/MenuDesplegable';
import { STEPS, type CotizadorStep } from './pasos';

interface SelectorPasoProps {
  currentStep: CotizadorStep;
  onStepChange: (step: CotizadorStep) => void;
}

const Numero: React.FC<{ n: number; activo: boolean }> = ({ n, activo }) => (
  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${activo ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
);

/** Dropdown para saltar a cualquier paso del cotizador. Abre hacia arriba (vive en el footer). */
export const SelectorPaso: React.FC<SelectorPasoProps> = ({ currentStep, onStepChange }) => {
  const actual = STEPS.find((s) => s.step === currentStep) ?? STEPS[0];
  return (
    <MenuDesplegable
      etiqueta="Ir a otro paso"
      hacia="arriba"
      valor={currentStep}
      onElegir={onStepChange}
      opciones={STEPS.map((s) => ({ value: s.step, label: s.label, prefijo: <Numero n={s.step} activo={s.step === currentStep} /> }))}
      contenido={
        <>
          <Numero n={actual.step} activo />
          <span className="hidden sm:inline whitespace-nowrap">{actual.label}</span>
          <span className="sm:hidden">
            {actual.step}/{STEPS.length}
          </span>
        </>
      }
    />
  );
};
