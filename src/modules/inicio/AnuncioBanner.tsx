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
    <div role={urgencia === 'URGENTE' ? 'alert' : 'status'} className={`flex items-start gap-2.5 px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold ${caja} ${className}`}>
      <Icono className="w-4 h-4 shrink-0 mt-0.5" />
      <p className="min-w-0 whitespace-pre-line leading-relaxed">{texto}</p>
    </div>
  );
};
