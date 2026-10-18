import React from 'react';
import { Settings } from 'lucide-react';
import { PresupuestoConfigPanel } from './PresupuestoConfigPanel';
import { PlantillasPuertasPanel } from './PlantillasPuertasPanel';
import { RolesUsuarioPanel } from './RolesUsuarioPanel';
import { EtapasPendientesPanel } from './EtapasPendientesPanel';
import { OneDrivePanel } from './OneDrivePanel';
import { PartidasSection } from './catalogo/PartidasSection';
import { TiposProductoSection } from './catalogo/TiposProductoSection';
import { UnidadesSection } from './catalogo/UnidadesSection';
import { FamiliasHetmoSection } from './catalogo/FamiliasHetmoSection';
import { ConceptosFijacionSection } from './catalogo/ConceptosFijacionSection';
import { ParametrosSection } from './comercial/ParametrosSection';
import { TiposProyectoSection } from './comercial/TiposProyectoSection';
import { PlantillasSection } from './comercial/PlantillasSection';
import { CONFIG_ALIAS, CONFIG_SECCIONES, entradaVisible } from '../../lib/accessControl';
import type { GrupoNav } from '../../components/ui/NavLateral';
import { NavLateral } from '../../components/ui/NavLateral';
import { EstadoVacio } from '../../components/ui/Estados';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { usePermisos } from '../../lib/permisos';
import { useUrlParam, actualizarParams } from '../../lib/navigation';
import type { Permiso } from '../../types';

/** Panel de cada sección; `editar` es el permiso que habilita sus controles (la API lo valida igual). */
const PANELES: Record<string, { Panel: React.ComponentType<{ puedeEditar: boolean }>; editar?: Permiso }> = {
  parametros: { Panel: ParametrosSection, editar: 'config.comercial' },
  'tipos-proyecto': { Panel: TiposProyectoSection, editar: 'config.comercial' },
  'plantillas-textos': { Panel: PlantillasSection, editar: 'config.comercial' },
  empresa: { Panel: PresupuestoConfigPanel },
  'tipos-producto': { Panel: TiposProductoSection, editar: 'config.catalogo' },
  partidas: { Panel: PartidasSection, editar: 'config.catalogo' },
  'hoja-fijacion': { Panel: ConceptosFijacionSection, editar: 'config.catalogo' },
  unidades: { Panel: UnidadesSection, editar: 'config.catalogo' },
  'familias-hetmo': { Panel: FamiliasHetmoSection, editar: 'config.catalogo' },
  'plantillas-puertas': { Panel: PlantillasPuertasPanel },
  'etapas-pendientes': { Panel: EtapasPendientesPanel },
  'roles-usuario': { Panel: RolesUsuarioPanel },
  onedrive: { Panel: OneDrivePanel },
};

/**
 * Configuración global de MTW ERP: un menú lateral agrupado (DESIGN.md 4)
 * con las secciones de CONFIG_SECCIONES (lib/accessControl.ts), cada una con
 * el permiso que la habilita. Agregar una sección es agregarla ahí y su
 * panel en PANELES.
 */
export const ConfiguracionPage: React.FC = () => {
  const { tieneAlguno, tiene } = usePermisos();
  const visibles = CONFIG_SECCIONES.filter((c) => entradaVisible(c, tieneAlguno));
  const [tab] = useUrlParam('tab');
  const [sub] = useUrlParam('sub');

  const pedida = tab ? (CONFIG_ALIAS[sub ? `${tab}/${sub}` : tab] ?? CONFIG_ALIAS[tab] ?? tab) : null;
  const activa = visibles.find((c) => c.id === pedida) ?? visibles[0];
  const panel = activa ? PANELES[activa.id] : undefined;

  const grupos: GrupoNav<string>[] = [];
  for (const s of visibles) {
    const g = grupos.find((x) => x.titulo === s.grupo) ?? grupos[grupos.push({ titulo: s.grupo, items: [] }) - 1];
    g.items.push({ id: s.id, label: s.label, icono: s.icon as GrupoNav<string>['items'][number]['icono'], descripcion: s.descripcion });
  }

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion titulo="Configuración" />
      {activa && panel ? (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch md:items-start">
          <div className="md:sticky md:top-4">
            <NavLateral grupos={grupos} activo={activa.id} onChange={(id) => actualizarParams({ tab: id, sub: null })} />
          </div>
          <div className="flex-1 min-w-0 max-w-5xl">
            <panel.Panel key={activa.id} puedeEditar={panel.editar ? tiene(panel.editar) : true} />
          </div>
        </div>
      ) : (
        <EstadoVacio icono={Settings} titulo="Sin secciones asignadas" descripcion="Pídele a un administrador que te asigne un rol con acceso a Configuración." />
      )}
    </div>
  );
};
