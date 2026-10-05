import React from 'react';
import type { LucideIcon } from 'lucide-react';

// Encabezado unico de toda pagina de primer nivel (una por entrada del
// Sidebar). Antes cada modulo tenia el suyo: Cotizaciones con un icono
// suelto y un contador, Proyectos con una caja de color, Compras/Clientes
// solo texto, Maestro sin titulo (las pestañas arriba de todo)...
export const PageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Contador junto al titulo (ej. cantidad de registros). */
  count?: number;
  /** Botones a la derecha (en mobile bajan a una fila propia). */
  actions?: React.ReactNode;
}> = ({ title, description, icon: Icon, count, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 items-center justify-center text-brand-600 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 truncate">{title}</h1>
          {count !== undefined && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-200/70 text-slate-600 shrink-0">
              {count}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end shrink-0">{actions}</div>}
  </div>
);

export interface SubTab<T extends string> {
  id: T;
  label: string;
  icon?: React.ElementType;
}

/**
 * Pestañas de segundo nivel (Compras > Órdenes/Conciliación, Bodega,
 * Maestro, Configuración...). Mismo estilo en todas -- subrayado, con
 * scroll horizontal en mobile en vez de desbordar la pagina.
 */
export function SubTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SubTab<T>[];
  active: T | undefined;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar -mx-1 px-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer -mb-px border-b-2 ${
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
