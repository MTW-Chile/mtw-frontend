import React from 'react';
import { PackageCheck, ClipboardList, Warehouse, Boxes } from 'lucide-react';
import { SubTabs } from '../../components/ui/PageHeader';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { useUrlParam } from '../../lib/navigation';
import { RecepcionesPendientesSection } from './RecepcionesPendientesSection';
import { RequisicionesSection } from '../proyectos/RequisicionesSection';
import { BodegasDisponiblesSection } from './BodegasDisponiblesSection';
import { MaestroSecciones } from '../cotizaciones/MaestroPage';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';

type SubTab = 'recepciones' | 'requisiciones' | 'bodegas' | 'maestro';

/**
 * Módulo Bodega de primer nivel: recepciones, requisiciones, bodegas
 * disponibles (stock y movimientos por bodega) y el Maestro de Materiales.
 */
export const BodegaPage: React.FC = () => {
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'recepciones', label: 'Recepciones pendientes', icon: PackageCheck },
    { id: 'requisiciones', label: 'Requisiciones', icon: ClipboardList },
    { id: 'bodegas', label: 'Bodegas disponibles', icon: Warehouse },
    { id: 'maestro', label: 'Maestro de materiales', icon: Boxes },
  ];

  // Pestaña activa en la URL (?tab=...) -- Atras del navegador y F5 la respetan.
  const [tabUrl, setTabUrl] = useUrlParam('tab');
  const activeSubTab: SubTab = tabs.some((t) => t.id === tabUrl) ? (tabUrl as SubTab) : 'recepciones';

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion titulo="Bodega" />
      <SubTabs tabs={tabs} active={activeSubTab} onChange={(id) => setTabUrl(id)} />

      {activeSubTab === 'recepciones' && <RecepcionesPendientesSection />}
      {activeSubTab === 'requisiciones' && <RequisicionesSection />}
      {activeSubTab === 'bodegas' && <BodegasDisponiblesSection />}
      {activeSubTab === 'maestro' && <MaestroSecciones />}
    </div>
  );
};
