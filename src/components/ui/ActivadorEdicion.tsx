import React from 'react';
import { Pencil } from 'lucide-react';

/**
 * Texto que se edita en el lugar (DESIGN.md 5): muestra el valor con un lápiz
 * al pasar; al hacer clic la pantalla lo cambia por su campo. Deshabilitado,
 * es texto normal.
 */
export const ActivadorEdicion: React.FC<{ onClick: () => void; disabled?: boolean; etiqueta?: string; className?: string; children: React.ReactNode }> = ({
  onClick,
  disabled,
  etiqueta = 'Editar',
  className = '',
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={disabled ? undefined : etiqueta}
    className={`group/edit inline-flex items-start gap-1.5 text-left min-w-0 cursor-pointer disabled:cursor-default ${className}`}
  >
    <span className="min-w-0">{children}</span>
    {!disabled && <Pencil className="w-3 h-3 mt-0.5 text-slate-300 group-hover/edit:text-brand-600 shrink-0" />}
  </button>
);
