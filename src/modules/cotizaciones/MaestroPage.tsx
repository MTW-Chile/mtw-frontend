import React from 'react';
import { Boxes, Building2, Tags } from 'lucide-react';
import { SubTabs } from '../../components/ui/PageHeader';
import { useUrlParam } from '../../lib/navigation';
import { MaestroProductos } from './components/MaestroProductos';
import { ProveedoresPanel } from './components/ProveedoresPanel';
import { PartidasPanel } from './components/PartidasPanel';

type SubTab = 'materiales' | 'proveedores' | 'partidas';

/**
 * Maestro de Materiales: vive dentro de la sección Bodega. Tres sub-vistas
 * (materiales, proveedores y partidas de gasto). Sin cabecera propia: la
 * cabecera la pone la sección que lo contiene. Su pestaña activa va en
 * ?sub=... para no pisar la de Bodega (?tab=...).
 */
export const MaestroSecciones: React.FC = () => {
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'materiales', label: 'Materiales', icon: Boxes },
    { id: 'proveedores', label: 'Proveedores', icon: Building2 },
    { id: 'partidas', label: 'Partidas', icon: Tags },
  ];

  const [subUrl, setSubUrl] = useUrlParam('sub');
  const activeSubTab: SubTab = tabs.some((t) => t.id === subUrl) ? (subUrl as SubTab) : 'materiales';

  return (
    <div className="space-y-5">
      <SubTabs tabs={tabs} active={activeSubTab} onChange={(id) => setSubUrl(id)} />

      {activeSubTab === 'materiales' && <MaestroProductos />}
      {activeSubTab === 'proveedores' && <ProveedoresPanel />}
      {activeSubTab === 'partidas' && <PartidasPanel />}
    </div>
  );
};
