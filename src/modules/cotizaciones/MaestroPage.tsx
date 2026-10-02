import React from 'react';
import { Boxes, Building2, Tags } from 'lucide-react';
import { PageHeader, SubTabs } from '../../components/ui/PageHeader';
import { useUrlParam } from '../../lib/navigation';
import { MaestroProductos } from './components/MaestroProductos';
import { ProveedoresPanel } from './components/ProveedoresPanel';
import { PartidasPanel } from './components/PartidasPanel';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';

type SubTab = 'materiales' | 'proveedores' | 'partidas';

/**
 * Contenedor del ítem de menú "Maestro de Materiales": tres sub-vistas,
 * materiales (MaestroProductos, ya existía), proveedores (ProveedoresPanel)
 * y partidas (PartidasPanel, nombre + código de integración Clay por
 * partida -- antes "Familia"/CategoriaGasto) -- mismo patrón de
 * sub-pestañas que ya usa CotizacionesPage.
 */
export const MaestroPage: React.FC = () => {
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'materiales', label: 'Materiales', icon: Boxes },
    { id: 'proveedores', label: 'Proveedores', icon: Building2 },
    { id: 'partidas', label: 'Partidas', icon: Tags },
  ];

  // Pestaña activa en la URL (?tab=...) -- Atras del navegador y F5 la respetan.
  const [tabUrl, setTabUrl] = useUrlParam('tab');
  const activeSubTab: SubTab = tabs.some((t) => t.id === tabUrl) ? (tabUrl as SubTab) : 'materiales';

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <PageHeader title="Maestro de Materiales" description="Catálogo de materiales, proveedores y partidas de gasto." icon={Boxes} />
      <SubTabs tabs={tabs} active={activeSubTab} onChange={(id) => setTabUrl(id)} />

      {activeSubTab === 'materiales' && <MaestroProductos />}
      {activeSubTab === 'proveedores' && <ProveedoresPanel />}
      {activeSubTab === 'partidas' && <PartidasPanel />}
    </div>
  );
};
