import React from 'react';

/**
 * Lista de registros como filas (DESIGN.md 5), para cuando una tabla sobra:
 * pocos campos por registro y acciones a la derecha (roles, usuarios,
 * plantillas). Va dentro de una Seccion con `sinRelleno`.
 */
export const Lista: React.FC<{ children: React.ReactNode }> = ({ children }) => <ul className="divide-y divide-slate-100">{children}</ul>;

export const FilaLista: React.FC<{
  titulo: React.ReactNode;
  /** Badges junto al título. */
  insignias?: React.ReactNode;
  /** Líneas de detalle bajo el título. */
  children?: React.ReactNode;
  /** Controles a la izquierda (ej. reordenar). */
  inicio?: React.ReactNode;
  acciones?: React.ReactNode;
  atenuada?: boolean;
}> = ({ titulo, insignias, children, inicio, acciones, atenuada }) => (
  <li className={`flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors ${atenuada ? 'opacity-60' : ''}`}>
    {inicio && <div className="shrink-0">{inicio}</div>}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-slate-900 truncate">{titulo}</span>
        {insignias}
      </div>
      {children && <div className="text-[11px] text-slate-500 space-y-0.5">{children}</div>}
    </div>
    {acciones && <div className="flex items-center gap-1 shrink-0">{acciones}</div>}
  </li>
);

/**
 * Fila clicable de una lista de resultados (buscadores de material, cliente,
 * fabricación): ocupa todo el ancho y resalta al pasar.
 */
export const BotonFila: React.FC<{ onClick: () => void; onMouseDown?: React.MouseEventHandler<HTMLButtonElement>; activa?: boolean; disabled?: boolean; children: React.ReactNode; className?: string; title?: string; sinRelleno?: boolean }> = ({
  onClick,
  activa,
  disabled,
  children,
  className = '',
  title,
  sinRelleno,
  onMouseDown,
}) => (
  <button
    type="button"
    onClick={onClick}
    onMouseDown={onMouseDown}
    disabled={disabled}
    title={title}
    className={`w-full text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sinRelleno ? '' : 'px-3 py-2'} ${activa ? 'bg-brand-50' : sinRelleno ? '' : 'hover:bg-slate-50'} ${className}`}
  >
    {children}
  </button>
);
