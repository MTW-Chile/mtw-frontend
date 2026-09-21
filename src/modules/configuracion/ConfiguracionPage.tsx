import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { PresupuestoConfigPanel } from './PresupuestoConfigPanel';
import { PlantillasPuertasPanel } from './PlantillasPuertasPanel';
import { RolesUsuarioPanel } from './RolesUsuarioPanel';
import { CONFIG_TABS } from '../../lib/accessControl';

const PANELES: Record<string, React.ComponentType> = {
  presupuesto: PresupuestoConfigPanel,
  'plantillas-puertas': PlantillasPuertasPanel,
  'roles-usuario': RolesUsuarioPanel,
};

interface ConfiguracionPageProps {
  // null = administrador, ve todas las pestañas sin filtrar.
  tabsPermitidas: string[] | null;
}

/**
 * Configuración global de MTW ERP, organizada en categorías -- arranca con
 * Presupuesto (branding/textos, ya existía), Plantillas de Puertas (recetas
 * de herrajes Protex) y Roles de Usuario (control de acceso). Las
 * categorías salen de CONFIG_TABS (lib/accessControl.ts), asi que agregar
 * una nueva es tocar esa lista + agregar su panel a PANELES arriba.
 */
export const ConfiguracionPage: React.FC<ConfiguracionPageProps> = ({ tabsPermitidas }) => {
  const categorias = CONFIG_TABS.filter((c) => tabsPermitidas === null || tabsPermitidas.includes(c.id));
  const [categoria, setCategoria] = useState<string>(categorias[0]?.id ?? '');

  const categoriaActiva = categorias.some((c) => c.id === categoria) ? categoria : categorias[0]?.id;
  const PanelActivo = categoriaActiva ? PANELES[categoriaActiva] : null;

  return (
    <div className="p-5 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 flex items-center justify-center text-[#E34A26]">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black text-slate-900">Configuración</h1>
          <p className="text-xs text-slate-500">Ajustes globales de MTW ERP -- afectan a todos los proyectos.</p>
        </div>
      </div>

      {categorias.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3">
          {categorias.map((cat) => {
            const Icon = cat.icon;
            const isActive = categoriaActiva === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoria(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {PanelActivo ? (
        <PanelActivo />
      ) : (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          No tienes pestañas de Configuración asignadas. Pídele a un administrador que te asigne un rol con acceso.
        </div>
      )}
    </div>
  );
};
