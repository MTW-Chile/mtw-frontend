import React from 'react';
import { FileText, FolderKanban, SlidersHorizontal } from 'lucide-react';
import { SubTabs } from '../../../components/ui/PageHeader';
import { useUrlParam } from '../../../lib/navigation';
import { usePermisos } from '../../../lib/permisos';
import { ParametrosSection } from './ParametrosSection';
import { TiposProyectoSection } from './TiposProyectoSection';
import { PlantillasSection } from './PlantillasSection';

type Sub = 'parametros' | 'tipos' | 'plantillas';

const SECCIONES: { id: Sub; label: string; icon: React.ElementType; Componente: React.FC<{ puedeEditar: boolean }> }[] = [
  { id: 'parametros', label: 'Parámetros', icon: SlidersHorizontal, Componente: ParametrosSection },
  { id: 'tipos', label: 'Tipos de proyecto', icon: FolderKanban, Componente: TiposProyectoSection },
  { id: 'plantillas', label: 'Plantillas de textos', icon: FileText, Componente: PlantillasSection },
];

/**
 * Configuración > Comercial: parámetros (IVA, tasas, Hoja de Fijación por
 * defecto, aprobación de adicionales, conciliación), tipos de proyecto y
 * plantillas de textos. Editar pide config.comercial (lo valida mtw-api).
 */
export const ComercialPanel: React.FC = () => {
  const { tiene } = usePermisos();
  const puedeEditar = tiene('config.comercial');
  const [subUrl, setSubUrl] = useUrlParam('sub');
  const activa = SECCIONES.find((s) => s.id === subUrl) ?? SECCIONES[0];
  return (
    <div className="space-y-5">
      <SubTabs tabs={SECCIONES} active={activa.id} onChange={(id) => setSubUrl(id)} />
      <activa.Componente puedeEditar={puedeEditar} />
    </div>
  );
};
