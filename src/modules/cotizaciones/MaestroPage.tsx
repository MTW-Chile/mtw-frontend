import React, { useState } from 'react';
import { Boxes, Building2, Tags } from 'lucide-react';
import { MaestroProductos } from './components/MaestroProductos';
import { ProveedoresPanel } from './components/ProveedoresPanel';
import { PartidasPanel } from './components/PartidasPanel';

type SubTab = 'materiales' | 'proveedores' | 'partidas';

/**
 * Contenedor del ítem de menú "Maestro de Materiales": tres sub-vistas,
 * materiales (MaestroProductos, ya existía), proveedores (ProveedoresPanel)
 * y partidas (PartidasPanel, nombre + código de integración Clay por
 * partida -- antes "Familia"/CategoriaGasto) -- mismo patrón de
 * sub-pestañas que ya usa CotizacionesPage.
 */
export const MaestroPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('materiales');

  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'materiales', label: 'Materiales', icon: Boxes },
    { id: 'proveedores', label: 'Proveedores', icon: Building2 },
    { id: 'partidas', label: 'Partidas', icon: Tags },
  ];

  return (
    <div className="p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-5 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeSubTab === 'materiales' && <MaestroProductos />}
      {activeSubTab === 'proveedores' && <ProveedoresPanel />}
      {activeSubTab === 'partidas' && <PartidasPanel />}
    </div>
  );
};
