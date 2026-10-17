import React from 'react';
import { Boxes, Calculator, Ruler, Tags, Workflow } from 'lucide-react';
import { SubTabs } from '../../../components/ui/PageHeader';
import { useUrlParam } from '../../../lib/navigation';
import { usePermisos } from '../../../lib/permisos';
import { PartidasSection } from './PartidasSection';
import { TiposProductoSection } from './TiposProductoSection';
import { UnidadesSection } from './UnidadesSection';
import { FamiliasHetmoSection } from './FamiliasHetmoSection';
import { ConceptosFijacionSection } from './ConceptosFijacionSection';

type Sub = 'tipos' | 'partidas' | 'fijacion' | 'unidades' | 'familias';

const SECCIONES: { id: Sub; label: string; icon: React.ElementType; Componente: React.FC<{ puedeEditar: boolean }> }[] = [
  { id: 'tipos', label: 'Tipos de producto', icon: Boxes, Componente: TiposProductoSection },
  { id: 'partidas', label: 'Partidas', icon: Tags, Componente: PartidasSection },
  { id: 'fijacion', label: 'Hoja de Fijación', icon: Calculator, Componente: ConceptosFijacionSection },
  { id: 'unidades', label: 'Unidades', icon: Ruler, Componente: UnidadesSection },
  { id: 'familias', label: 'Familias HETMO', icon: Workflow, Componente: FamiliasHetmoSection },
];

/**
 * Configuración > Catálogo: las reglas con que se calcula, valoriza y compra
 * cada material (antes escritas en el código). Verlo pide catalogo.ver;
 * editarlo, config.catalogo (lo valida mtw-api, aquí solo se ocultan los
 * controles).
 */
export const CatalogoPanel: React.FC = () => {
  const { tiene } = usePermisos();
  const puedeEditar = tiene('config.catalogo');
  const [subUrl, setSubUrl] = useUrlParam('sub');
  const activa = SECCIONES.find((s) => s.id === subUrl) ?? SECCIONES[0];

  return (
    <div className="space-y-5">
      <SubTabs tabs={SECCIONES} active={activa.id} onChange={(id) => setSubUrl(id)} />
      <activa.Componente puedeEditar={puedeEditar} />
    </div>
  );
};
