import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronUp } from 'lucide-react';
import { STEPS, type CotizadorStep } from './pasos';

interface SelectorPasoProps {
  currentStep: CotizadorStep;
  onStepChange: (step: CotizadorStep) => void;
}

/** Dropdown para saltar a cualquier paso del cotizador. Abre hacia arriba (vive en el footer). */
export const SelectorPaso: React.FC<SelectorPasoProps> = ({ currentStep, onStepChange }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const actual = STEPS.find((s) => s.step === currentStep) ?? STEPS[0];

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Ir a otro paso"
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
          open
            ? 'bg-brand-600/10 border-brand-600/40 text-brand-600 ring-2 ring-brand-600/20'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
        }`}
      >
        <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">{actual.step}</span>
        <span className="hidden sm:inline whitespace-nowrap">{actual.label}</span>
        <span className="sm:hidden">{actual.step}/{STEPS.length}</span>
        <ChevronUp className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 bottom-full mb-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50 animate-fade-in"
        >
          {STEPS.map((s) => {
            const activo = s.step === currentStep;
            return (
              <button
                key={s.step}
                role="option"
                aria-selected={activo}
                onClick={() => {
                  setOpen(false);
                  onStepChange(s.step);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                  activo ? 'bg-brand-600/10 text-brand-600 font-bold' : 'text-slate-700 hover:bg-slate-100 font-semibold'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    activo ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s.step}
                </span>
                <span className="flex-1">{s.label}</span>
                {activo && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
