import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Lock, ShieldCheck } from 'lucide-react';
import { HeaderSlot } from '../../../../components/layout/HeaderSlot';
import { Badge } from '../../../../components/ui/Badge';
import type { Proyecto, ProyectoVersion } from '../../../../types';

export type CotizadorStep = 1 | 2 | 3 | 4 | 5;

export const STEPS: { step: CotizadorStep; label: string }[] = [
  { step: 1, label: 'Identificación' },
  { step: 2, label: 'Revisión de Líneas' },
  { step: 3, label: 'Analítica de Materiales' },
  { step: 4, label: 'Hoja de Fijación' },
  { step: 5, label: 'Consolidación & PDF' },
];

// BORRADOR es el valor historico de la columna antes del flujo de estado
// comercial; se muestra igual que EN_COTIZACION (ver EstadoComercialCard).
const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: 'En Cotización',
  EN_COTIZACION: 'En Cotización',
  ESPERANDO_APROBACION_COMERCIAL: 'Esperando Aprobación Comercial',
  APROBADO_GERENCIA: 'Aprobado Gerencia',
  ACEPTADO_CLIENTE: 'Aceptado por Cliente',
};

interface HeaderContextoProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  currentStep: CotizadorStep;
  onStepChange: (step: CotizadorStep) => void;
}

/**
 * Contexto del cotizador dentro del Header del sitio (portal al slot
 * HEADER_CONTEXTO_ID): selector de paso, código de la obra, estado de
 * aprobación, revisión y reimportar HETMO. Reemplaza a la barra propia
 * del cotizador (cabecera + stepper), así queda un solo header.
 */
export const HeaderContexto: React.FC<HeaderContextoProps> = ({
  proyecto,
  activeVersion,
  currentStep,
  onStepChange,
}) => {
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
  const estadoTexto = activeVersion
    ? ESTADO_LABEL[activeVersion.estadoAprobacion] || activeVersion.estadoAprobacion
    : 'En Cotización';

  return (
    <HeaderSlot>
      {/* Wrapper: el display de Badge (inline-flex) pisa a `hidden`. En móvil el
          header (móvil y tablet, con hamburguesa y logo) no tiene espacio: ahí solo queda el selector de paso. */}
      <div className="hidden lg:flex items-center gap-2 shrink-0">
        <Badge size="sm" className="font-mono font-bold text-slate-600" title="Número de proyecto">
          {proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`}
        </Badge>

        <Badge size="sm" variant={activeVersion?.esCongelado ? 'success' : 'brand'} title={estadoTexto} dot={!activeVersion?.esCongelado}>
          <span className="inline-flex items-center gap-1">
            {activeVersion?.esCongelado &&
              (activeVersion.estadoAprobacion === 'APROBADO_GERENCIA' || activeVersion.estadoAprobacion === 'ACEPTADO_CLIENTE' ? (
                <ShieldCheck className="w-3 h-3" />
              ) : (
                <Lock className="w-3 h-3" />
              ))}
            <span className="hidden @5xl:inline">{estadoTexto}</span>
          </span>
        </Badge>
      </div>

      {/* Selector de paso: al borde derecho del header */}
      <div className="relative shrink-0 ml-auto" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          title="Cambiar de paso"
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            open
              ? 'bg-brand-600/10 border-brand-600/40 text-brand-600 ring-2 ring-brand-600/20'
              : 'bg-brand-600/10 border-brand-600/30 text-brand-600 hover:bg-brand-600/15'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px]">
            {actual.step}
          </span>
          <span className="hidden @3xl:inline whitespace-nowrap">{actual.label}</span>
          <span className="@3xl:hidden whitespace-nowrap">Paso {actual.step}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50 animate-fade-in"
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
    </HeaderSlot>
  );
};
