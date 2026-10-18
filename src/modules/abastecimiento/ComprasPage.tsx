import React from 'react';
import { ShoppingCart, FileCheck2, Tags } from 'lucide-react';
import { BarraPestanas } from '../../components/ui/PageHeader';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { useUrlParam } from '../../lib/navigation';
import { OrdenesCompraList } from './OrdenesCompraList';
import { ControlDocumentosTab } from '../proyectos/ControlDocumentosTab';
import { PorClasificarTab } from './PorClasificarTab';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';

type SubTab = 'ordenes' | 'conciliacion' | 'por-clasificar';

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
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'ordenes', label: 'Órdenes de Compra', icon: ShoppingCart },
    { id: 'conciliacion', label: 'Conciliación de Facturas', icon: FileCheck2 },
    { id: 'por-clasificar', label: 'Por clasificar', icon: Tags },
  ];

  // Pestaña activa en la URL (?tab=...) -- Atras del navegador y F5 la respetan.
  const [tabUrl, setTabUrl] = useUrlParam('tab');
  const activeSubTab: SubTab = tabs.some((t) => t.id === tabUrl) ? (tabUrl as SubTab) : 'ordenes';

  return (
    <>
      <HeaderSeccion titulo="Compras" />
      <BarraPestanas tabs={tabs} active={activeSubTab} onChange={(id) => setTabUrl(id)} />
      <div className={PAGE_CONTAINER_CLASS}>
        {activeSubTab === 'ordenes' && <OrdenesCompraList />}
        {activeSubTab === 'conciliacion' && <ControlDocumentosTab />}
        {activeSubTab === 'por-clasificar' && <PorClasificarTab />}
      </div>
    </>
  );
};
