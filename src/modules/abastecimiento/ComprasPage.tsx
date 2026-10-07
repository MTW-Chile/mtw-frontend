import React from 'react';
import { ShoppingCart, FileCheck2 } from 'lucide-react';
import { PageHeader, SubTabs } from '../../components/ui/PageHeader';
import { useUrlParam } from '../../lib/navigation';
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
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'ordenes', label: 'Órdenes de Compra', icon: ShoppingCart },
    { id: 'conciliacion', label: 'Conciliación de Facturas', icon: FileCheck2 },
  ];

  // Pestaña activa en la URL (?tab=...) -- Atras del navegador y F5 la respetan.
  const [tabUrl, setTabUrl] = useUrlParam('tab');
  const activeSubTab: SubTab = tabs.some((t) => t.id === tabUrl) ? (tabUrl as SubTab) : 'ordenes';

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <PageHeader title="Compras" description="Órdenes de Compra y conciliación con Clay de todas las obras, en un solo lugar." icon={ShoppingCart} />
      <SubTabs tabs={tabs} active={activeSubTab} onChange={(id) => setTabUrl(id)} />

      {activeSubTab === 'ordenes' && <OrdenesCompraList />}
      {activeSubTab === 'conciliacion' && <ControlDocumentosTab />}
    </div>
  );
};
