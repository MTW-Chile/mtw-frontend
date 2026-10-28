import React, { useEffect } from 'react';
import { LayoutDashboard, PackageCheck, ClipboardList } from 'lucide-react';
import { BarraPestanas } from '../../components/ui/PageHeader';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { useUrlParam, actualizarParams, navegar } from '../../lib/navigation';
import { RecepcionesPendientesSection } from './RecepcionesPendientesSection';
import { RecepcionOCPage } from './recepcion/RecepcionOCPage';
import { RequisicionesSection } from '../proyectos/RequisicionesSection';
import { BodegasDisponiblesSection } from './BodegasDisponiblesSection';
import { BodegaResumenSection } from './BodegaResumenSection';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { useMigas } from '../../lib/migas';

type SubTab = 'general' | 'recepciones' | 'requisiciones';

// Pestañas anteriores del módulo (enlaces guardados).
const ALIAS: Record<string, SubTab> = { bodegas: 'general' };

/**
 * Módulo Bodega de primer nivel: Información General (indicadores y bodegas
 * disponibles, con el stock y los movimientos de cada una), recepciones de
 * OC pendientes y requisiciones de material de las obras.
 */
export const BodegaPage: React.FC = () => {
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'Información General', icon: LayoutDashboard },
    { id: 'recepciones', label: 'Recepciones pendientes', icon: PackageCheck },
    { id: 'requisiciones', label: 'Requisiciones', icon: ClipboardList },
  ];

  // Pestaña activa en la URL (?tab=...) -- Atras del navegador y F5 la respetan.
  const [tabUrl] = useUrlParam('tab');
  const [subUrl] = useUrlParam('sub');
  // Bodega abierta dentro de Información General (?bodega=<id>): mientras se mira una, los indicadores se esconden.
  const [bodegaUrl] = useUrlParam('bodega');
  // OC que se está recepcionando (?oc=<id>): página completa dentro de Recepciones pendientes.
  const [ocUrl] = useUrlParam('oc');
  // El Maestro y los Proveedores salieron de Bodega a su propia sección: los enlaces viejos siguen funcionando.
  useEffect(() => {
    if (tabUrl === 'maestro') navegar(subUrl === 'proveedores' ? '/proveedores' : '/maestro', {}, { replace: true });
  }, [tabUrl, subUrl]);
  const pedida = tabUrl ? (ALIAS[tabUrl] ?? tabUrl) : undefined;
  const activeSubTab: SubTab = tabs.some((t) => t.id === pedida) ? (pedida as SubTab) : 'general';
  // Volver a la pestaña limpia lo abierto dentro de ella (subpestaña, bodega).
  useMigas(1, [{ label: tabs.find((t) => t.id === activeSubTab)!.label, alHacerClic: () => actualizarParams({ tab: activeSubTab, sub: null, bodega: null, oc: null }) }]);

  return (
    <>
      <HeaderSeccion titulo="Bodega" />
      <BarraPestanas tabs={tabs} active={activeSubTab} onChange={(id) => actualizarParams({ tab: id, bodega: null, oc: null })} />
      <div className={PAGE_CONTAINER_CLASS}>
        {activeSubTab === 'general' && (
          <div className="space-y-5">
            {!bodegaUrl && (
              <>
                <BodegaResumenSection />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Bodegas disponibles</h2>
              </>
            )}
            <BodegasDisponiblesSection />
          </div>
        )}
        {activeSubTab === 'recepciones' && (ocUrl ? <RecepcionOCPage ocId={ocUrl} onVolver={() => actualizarParams({ oc: null })} /> : <RecepcionesPendientesSection />)}
        {activeSubTab === 'requisiciones' && <RequisicionesSection />}
      </div>
    </>
  );
};
