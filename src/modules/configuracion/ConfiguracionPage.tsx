import React, { useState } from 'react';
import { Settings, FileText, DoorClosed } from 'lucide-react';
import { PresupuestoConfigPanel } from './PresupuestoConfigPanel';
import { PlantillasPuertasPanel } from './PlantillasPuertasPanel';

type Categoria = 'presupuesto' | 'plantillas-puertas';

const CATEGORIAS: { id: Categoria; label: string; icon: React.ElementType }[] = [
  { id: 'presupuesto', label: 'Presupuesto', icon: FileText },
  { id: 'plantillas-puertas', label: 'Plantillas de Puertas', icon: DoorClosed },
];

/**
 * Configuración global de MTW ERP, organizada en categorías -- arranca con
 * Presupuesto (branding/textos, ya existía) y Plantillas de Puertas
 * (recetas de herrajes Protex, ver PlantillasPuertasPanel). Pensado para
 * seguir creciendo con más categorías sin reestructurar de nuevo.
 */
export const ConfiguracionPage: React.FC = () => {
  const [categoria, setCategoria] = useState<Categoria>('presupuesto');

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

      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3">
        {CATEGORIAS.map((cat) => {
          const Icon = cat.icon;
          const isActive = categoria === cat.id;
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

      {categoria === 'presupuesto' && <PresupuestoConfigPanel />}
      {categoria === 'plantillas-puertas' && <PlantillasPuertasPanel />}
    </div>
  );
};
