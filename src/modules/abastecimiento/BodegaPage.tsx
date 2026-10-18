import React from 'react';
import { PackageCheck, ClipboardList, Warehouse, Boxes } from 'lucide-react';
import { BarraPestanas } from '../../components/ui/PageHeader';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { useUrlParam, actualizarParams } from '../../lib/navigation';
import { RecepcionesPendientesSection } from './RecepcionesPendientesSection';
import { RequisicionesSection } from '../proyectos/RequisicionesSection';
import { BodegasDisponiblesSection } from './BodegasDisponiblesSection';
import { MaestroSecciones } from '../cotizaciones/MaestroPage';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { useMigas } from '../../lib/migas';

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
  // Volver a la pestaña limpia lo abierto dentro de ella (subpestaña, bodega).
  useMigas(1, [{ label: tabs.find((t) => t.id === activeSubTab)!.label, alHacerClic: () => actualizarParams({ tab: activeSubTab, sub: null, bodega: null }) }]);

  return (
    <>
      <HeaderSeccion titulo="Bodega" />
      <BarraPestanas tabs={tabs} active={activeSubTab} onChange={(id) => setTabUrl(id)} />
      <div className={PAGE_CONTAINER_CLASS}>
        {activeSubTab === 'recepciones' && <RecepcionesPendientesSection />}
        {activeSubTab === 'requisiciones' && <RequisicionesSection />}
        {activeSubTab === 'bodegas' && <BodegasDisponiblesSection />}
        {activeSubTab === 'maestro' && <MaestroSecciones />}
      </div>
    </>
  );
};
