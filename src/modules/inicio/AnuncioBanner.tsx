import React from 'react';
import { AlertOctagon, AlertTriangle, Megaphone } from 'lucide-react';
import type { UrgenciaAnuncio } from '../../types';

export const ESTILO_URGENCIA: Record<UrgenciaAnuncio, { label: string; caja: string; Icono: React.ElementType }> = {
  INFORMATIVO: { label: 'Informativo (verde)', caja: 'bg-emerald-600 text-white', Icono: Megaphone },
  ADVERTENCIA: { label: 'Advertencia (amarillo)', caja: 'bg-amber-400 text-amber-950', Icono: AlertTriangle },
  URGENTE: { label: 'Urgente (rojo)', caja: 'bg-rose-600 text-white', Icono: AlertOctagon },
};

/**
 * Anuncio para todos los usuarios (Configuración › Anuncio): franja de color
 * pegada al encabezado, sobre el buscador de Inicio.
 */
export const AnuncioBanner: React.FC<{ texto: string; urgencia: UrgenciaAnuncio; className?: string }> = ({ texto, urgencia, className = '' }) => {
  const { caja, Icono } = ESTILO_URGENCIA[urgencia];
  return (
    <div role={urgencia === 'URGENTE' ? 'alert' : 'status'} className={`flex items-start gap-2 px-3 sm:px-5 py-1.5 text-[11px] sm:text-xs font-semibold ${caja} ${className}`}>
      <Icono className="w-3.5 h-3.5 shrink-0 mt-px" />
      <p className="min-w-0 whitespace-pre-line leading-snug">{texto}</p>
    </div>
  );
};
