// Pasos del cotizador. Fuente única: el selector (SelectorPaso) y el footer
// (Anterior / Continuar) leen de acá. Para reordenar pasos, tocar solo esto
// y el mapeo en CotizadorWorkspace.tsx.
export type CotizadorStep = 1 | 2 | 3 | 4 | 5;

export const STEPS: { step: CotizadorStep; label: string }[] = [
  { step: 1, label: 'Identificación' },
  { step: 2, label: 'Revisión de Líneas' },
  { step: 3, label: 'Analítica de Materiales' },
  { step: 4, label: 'Hoja de Fijación' },
  { step: 5, label: 'Consolidación & PDF' },
];
