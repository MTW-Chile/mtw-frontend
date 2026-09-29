import React, { useState } from 'react';
import { ShoppingCart, FileCheck2 } from 'lucide-react';
import { OrdenesCompraList } from './OrdenesCompraList';
import { ControlDocumentosTab } from '../proyectos/ControlDocumentosTab';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';

type SubTab = 'ordenes' | 'conciliacion';

/**
 * Módulo Compras de primer nivel (Sidebar) -- fuera de la vista
 * Proyectos, junta las OC de TODAS las obras (+ "Obras Mayores") en un
 * solo lugar, mismo patrón que el módulo Bodega. Las OC se siguen
 * generando igual que siempre (Nueva OC manual o "Generar OC" por
 * categoría desde Fases, ver FasesTab) -- esto no agrega una forma nueva
 * de crearlas, solo un lugar para verlas/gestionarlas todas juntas y
 * conciliarlas con la factura real en Clay.
 */
export const ComprasPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('ordenes');

  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'ordenes', label: 'Órdenes de Compra', icon: ShoppingCart },
    { id: 'conciliacion', label: 'Conciliación de Facturas', icon: FileCheck2 },
  ];

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <div>
        <h1 className="text-base font-black text-slate-900">Compras</h1>
        <p className="text-xs text-slate-500">Órdenes de Compra y conciliación con Clay de todas las obras, en un solo lugar.</p>
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

      {activeSubTab === 'ordenes' && <OrdenesCompraList />}
      {activeSubTab === 'conciliacion' && <ControlDocumentosTab />}
    </div>
  );
};
