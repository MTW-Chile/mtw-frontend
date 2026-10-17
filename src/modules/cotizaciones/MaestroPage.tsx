import React from 'react';
import { Boxes, Building2 } from 'lucide-react';
import { SubTabs } from '../../components/ui/PageHeader';
import { useUrlParam } from '../../lib/navigation';
import { MaestroProductos } from './components/MaestroProductos';
import { ProveedoresPanel } from './components/ProveedoresPanel';

type SubTab = 'materiales' | 'proveedores';

/**
 * Maestro de Materiales: vive dentro de la sección Bodega. Dos sub-vistas
 * (materiales y proveedores); las partidas y tipos de producto se configuran
 * en Configuración > Catálogo. Sin cabecera propia: la
 * cabecera la pone la sección que lo contiene. Su pestaña activa va en
 * ?sub=... para no pisar la de Bodega (?tab=...).
 */
export const MaestroSecciones: React.FC = () => {
  const tabs: { id: SubTab; label: string; icon: React.ElementType }[] = [
    { id: 'materiales', label: 'Materiales', icon: Boxes },
    { id: 'proveedores', label: 'Proveedores', icon: Building2 },
  ];

  const [subUrl, setSubUrl] = useUrlParam('sub');
  const activeSubTab: SubTab = tabs.some((t) => t.id === subUrl) ? (subUrl as SubTab) : 'materiales';

  return (
    <div className="space-y-5">
      <SubTabs tabs={tabs} active={activeSubTab} onChange={(id) => setSubUrl(id)} />

      {activeSubTab === 'materiales' && <MaestroProductos />}
      {activeSubTab === 'proveedores' && <ProveedoresPanel />}
    </div>
  );
};
