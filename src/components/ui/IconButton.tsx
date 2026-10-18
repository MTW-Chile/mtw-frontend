import React from 'react';
import type { LucideIcon } from 'lucide-react';

const TONOS = {
  neutro: 'text-slate-400 hover:text-slate-800 hover:bg-slate-100',
  marca: 'text-slate-400 hover:text-brand-600 hover:bg-brand-50',
  peligro: 'text-slate-400 hover:text-rose-600 hover:bg-rose-50',
} as const;

/**
 * Botón de solo ícono (quitar una fila, editar, cerrar). `etiqueta` es
 * obligatoria: es el nombre accesible y el title (DESIGN.md 1.5).
 */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icono: LucideIcon; etiqueta: string; tono?: keyof typeof TONOS }
>(({ icono: Icono, etiqueta, tono = 'neutro', className = '', type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-label={etiqueta}
    title={etiqueta}
    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0 ${TONOS[tono]} ${className}`}
    {...props}
  >
    <Icono className="w-3.5 h-3.5" />
  </button>
));
IconButton.displayName = 'IconButton';
