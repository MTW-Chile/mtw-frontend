import React from 'react';
import { PresupuestoConfigPanel } from './PresupuestoConfigPanel';
import { CatalogoPanel } from './catalogo/CatalogoPanel';
import { PlantillasPuertasPanel } from './PlantillasPuertasPanel';
import { RolesUsuarioPanel } from './RolesUsuarioPanel';
import { EtapasPendientesPanel } from './EtapasPendientesPanel';
import { OneDrivePanel } from './OneDrivePanel';
import { CONFIG_TABS, entradaVisible } from '../../lib/accessControl';
import { usePermisos } from '../../lib/permisos';
import { SubTabs } from '../../components/ui/PageHeader';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { useUrlParam } from '../../lib/navigation';

const PANELES: Record<string, React.ComponentType> = {
  presupuesto: PresupuestoConfigPanel,
  catalogo: CatalogoPanel,
  'plantillas-puertas': PlantillasPuertasPanel,
  'etapas-pendientes': EtapasPendientesPanel,
  onedrive: OneDrivePanel,
  'roles-usuario': RolesUsuarioPanel,
};

/**
 * Configuración global de MTW ERP, organizada en categorías -- arranca con
 * Presupuesto (branding/textos, ya existía), Catálogo (partidas, tipos de
 * producto, unidades y familias de HETMO), Plantillas de Puertas (recetas
 * de herrajes Protex) y Roles de Usuario (control de acceso). Las
 * categorías salen de CONFIG_TABS (lib/accessControl.ts), cada una con el
 * permiso que la habilita: agregar una nueva es tocar esa lista + agregar su
 * panel a PANELES arriba.
 */
export const ConfiguracionPage: React.FC = () => {
  const { tieneAlguno } = usePermisos();
  const categorias = CONFIG_TABS.filter((c) => entradaVisible(c, tieneAlguno));
  // Categoría activa en la URL (?tab=...) -- Atras del navegador y F5 la respetan.
  const [categoria, setCategoria] = useUrlParam('tab');

  const categoriaActiva = categoria && categorias.some((c) => c.id === categoria) ? categoria : categorias[0]?.id;
  const PanelActivo = categoriaActiva ? PANELES[categoriaActiva] : null;

  return (
    <div className="w-full min-w-0 p-3 sm:p-5 md:p-6 xl:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <HeaderSeccion titulo="Configuración" />

      {categorias.length > 0 && (
        <SubTabs tabs={categorias} active={categoriaActiva} onChange={(id) => setCategoria(id)} />
      )}

      {PanelActivo ? (
        <PanelActivo />
      ) : (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          No tienes pestañas de Configuración asignadas. Pídele a un administrador que te asigne un rol con acceso.
        </div>
      )}
    </div>
  );
};
