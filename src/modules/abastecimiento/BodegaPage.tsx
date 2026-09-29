import React, { useState } from 'react';
import { PackageCheck, ClipboardList, Boxes } from 'lucide-react';
import { RecepcionesPendientesSection } from './RecepcionesPendientesSection';
import { RequisicionesSection } from '../proyectos/RequisicionesSection';
import { BodegaProyectoTab } from './BodegaProyectoTab';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';

type SubTab = 'recepciones' | 'requisiciones' | 'stock';

/**
 * Módulo Bodega de primer nivel (Sidebar) -- fuera de la vista Proyectos,
 * junta el trabajo de Bodega de TODAS las obras (+ "Obras Mayores") en un
 * solo lugar, en vez de tener que entrar proyecto por proyecto. Reusa los
 * mismos componentes que ya viven en la pestaña "Bodega" de la ficha de
 * proyecto (RequisicionesSection/BodegaProyectoTab), sin `proyecto` --
 * mismo patrón que se va a repetir para el futuro módulo de Finanzas.
 */
export const BodegaPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('recepciones');

  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'recepciones', label: 'Recepciones pendientes', icon: PackageCheck },
    { id: 'requisiciones', label: 'Requisiciones', icon: ClipboardList },
    { id: 'stock', label: 'Stock y Movimientos', icon: Boxes },
  ];

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <div>
        <h1 className="text-base font-black text-slate-900">Bodega</h1>
        <p className="text-xs text-slate-500">Recepciones, requisiciones y stock de todas las obras, en un solo lugar.</p>
      </div>

      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
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

      {activeSubTab === 'recepciones' && <RecepcionesPendientesSection />}
      {activeSubTab === 'requisiciones' && <RequisicionesSection />}
      {activeSubTab === 'stock' && <BodegaProyectoTab />}
    </div>
  );
};
