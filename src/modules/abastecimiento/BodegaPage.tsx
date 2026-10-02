import React from 'react';
import { PackageCheck, ClipboardList, Boxes, Warehouse } from 'lucide-react';
import { PageHeader, SubTabs } from '../../components/ui/PageHeader';
import { useUrlParam } from '../../lib/navigation';
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
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'recepciones', label: 'Recepciones pendientes', icon: PackageCheck },
    { id: 'requisiciones', label: 'Requisiciones', icon: ClipboardList },
    { id: 'stock', label: 'Stock y Movimientos', icon: Boxes },
  ];

  // Pestaña activa en la URL (?tab=...) -- Atras del navegador y F5 la respetan.
  const [tabUrl, setTabUrl] = useUrlParam('tab');
  const activeSubTab: SubTab = tabs.some((t) => t.id === tabUrl) ? (tabUrl as SubTab) : 'recepciones';

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <PageHeader title="Bodega" description="Recepciones, requisiciones y stock de todas las obras, en un solo lugar." icon={Warehouse} />
      <SubTabs tabs={tabs} active={activeSubTab} onChange={(id) => setTabUrl(id)} />

      {activeSubTab === 'recepciones' && <RecepcionesPendientesSection />}
      {activeSubTab === 'requisiciones' && <RequisicionesSection />}
      {activeSubTab === 'stock' && <BodegaProyectoTab />}
    </div>
  );
};
