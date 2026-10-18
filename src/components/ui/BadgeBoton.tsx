import React from 'react';
import { Badge, type BadgeVariant } from './Badge';

/**
 * Estado que se cambia con un clic (Incluido/Excluido): un Badge que es botón.
 * `title` explica qué pasa al hacer clic.
 */
export const BadgeBoton: React.FC<{ variant: BadgeVariant; onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode }> = ({
  variant,
  onClick,
  disabled,
  title,
  children,
}) => (
  <button type="button" onClick={onClick} disabled={disabled} title={title} className="shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 rounded-full focus-visible:ring-2 focus-visible:ring-brand-600/30 outline-none">
    <Badge size="sm" variant={variant} className={disabled ? '' : 'hover:brightness-95'}>
      {children}
    </Badge>
  </button>
);
