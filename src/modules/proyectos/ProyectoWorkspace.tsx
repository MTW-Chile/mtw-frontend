import React from 'react';
import { actualizarParams } from '../../lib/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, LayoutDashboard, ShoppingCart, Warehouse, Factory, ClipboardList, Ruler, FilePlus2 } from 'lucide-react';
import { HeaderSlot } from '../../components/layout/HeaderSlot';
import { getProyectoById } from '../../api/client';
import { OrdenesCompraList } from '../abastecimiento/OrdenesCompraList';
import { BodegaProyectoTab } from '../abastecimiento/BodegaProyectoTab';
import { RecepcionesPendientesSection } from '../abastecimiento/RecepcionesPendientesSection';
import { RequisicionesSection } from './RequisicionesSection';
import { InformacionGeneralTab } from './InformacionGeneralTab';
import { CubicacionTab } from './cubicacion/CubicacionTab';
import { FabricacionTab } from './fabricacion/FabricacionTab';
import { PendientesTab } from './pendientes/PendientesTab';
import { AdicionalesTab } from './adicionales/AdicionalesTab';
import { ClayCentroCostoEditor } from './ClayCentroCostoEditor';
import { seccionDisponible, seccionEfectiva, type SeccionObra } from './seccionesObra';
import { usePermisos } from '../../lib/permisos';
import { BarraPestanas } from '../../components/ui/PageHeader';
import { useMigas } from '../../lib/migas';

// "Control de documentos" (conciliacion de OC contra facturas de Clay) se
// saco de aca -- vive solo en Compras (ComprasPage > sub-tab
// Conciliacion, ControlDocumentosTab sin proyectoId) para todas las obras
// juntas, en vez de repetido obra por obra.
type Seccion = SeccionObra;

const SECCIONES: { id: Seccion; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'Información General', hint: 'Métricas, control de presupuesto por partida y documentos', icon: LayoutDashboard },
  { id: 'cubicacion', label: 'Cubicación', hint: 'Reparto por piso y departamento, rectificación y nomenclatura (opcional)', icon: Ruler },
  { id: 'fabricacion', label: 'Fabricación', hint: 'Documentos de fabricación de HETMO', icon: Factory },
  { id: 'abastecimiento', label: 'Abastecimiento', hint: 'Generación y gestión de OC', icon: ShoppingCart },
  { id: 'pendientes', label: 'Control de pendientes', hint: 'Lo que falta o falló en la obra', icon: ClipboardList },
  { id: 'adicionales', label: 'Adicionales', hint: 'Ventas o cargos fuera del presupuesto aceptado', icon: FilePlus2 },
  { id: 'bodega', label: 'Bodega', hint: 'Requisiciones, stock y movimientos', icon: Warehouse },
];

export const ProyectoWorkspace: React.FC<{ proyectoId: string; seccionInicial?: string; onVolver: () => void }> = ({
  proyectoId,
  seccionInicial,
}) => {
  const { tiene } = usePermisos();
  // La seccion activa vive en la URL (?seccion=...) -- Atras del navegador
  // vuelve a la seccion anterior. replace: cambiar de pestaña dentro del
  // proyecto no llena el historial (Atras sale del proyecto al listado).
  const setSeccion = (s: Seccion) => actualizarParams({ seccion: s }, { replace: true });

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
  });

  // Una obra manual nunca se cotizo: las secciones que dependen del
  // presupuesto se ven en gris (ver seccionesObra.ts) y un enlace a una de
  // ellas cae a Información General. Mientras carga la obra no se sabe su origen.
  const seccion: Seccion = seccionEfectiva(seccionInicial, proyecto?.origen);
  // Volver a la sección cierra lo abierto dentro de ella (ej. un adicional).
  useMigas(1, [{ label: SECCIONES.find((x) => x.id === seccion)?.label ?? '', alHacerClic: () => actualizarParams({ seccion, adicional: null }) }]);

  // La ejecucion real de la obra sigue la version activa (la misma que
  // define versionActivaHetmoId en Cotizaciones), no siempre la de
  // versionNumero mas alto -- una obra en curso no deberia "saltar" de
  // presupuesto de golpe si Hetmo genera una version nueva sin que
  // alguien la elija a proposito.
  const activeVersion =
    proyecto?.versiones.find((v) => v.hetmoId === proyecto.versionActivaHetmoId) || proyecto?.versiones[0];

  return (
    <div className="flex flex-col h-full">
      {/* Cliente y centro de costo van en el Header del sitio (portal); el código va en las migas, junto al nombre. */}
      <HeaderSlot>
        {proyecto && (
          <>
            {proyecto.clienteNombreRaw && proyecto.clienteNombreRaw.trim().toLowerCase() !== proyecto.obra.trim().toLowerCase() && (
              <span className="hidden @3xl:inline text-xs text-slate-500 truncate max-w-[220px]" title="Cliente">
                {proyecto.clienteNombreRaw}
              </span>
            )}
            <div className="ml-auto hidden sm:block">
              <ClayCentroCostoEditor proyectoId={proyecto.id} valor={proyecto.clayCentroCosto} />
            </div>
          </>
        )}
      </HeaderSlot>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Menu superior -- unica nav, para cualquier ancho (antes era un
            sidebar lateral en escritorio + esta misma fila solo en
            mobile; reemplazado por pedido explicito). overflow-x-auto
            cubre el caso de que no entren todos los tabs en una pantalla
            angosta. */}
        <BarraPestanas
            active={seccion}
            onChange={(id) => setSeccion(id)}
            tabs={SECCIONES.filter((s) => s.id !== 'adicionales' || tiene('adicionales.ver')).map((s) => {
              const disponible = seccionDisponible(s.id, proyecto?.origen);
              return { id: s.id, label: s.label, icon: s.icon, disabled: !disponible, title: disponible ? s.hint : 'No disponible: esta obra se creó a mano y no fue cotizada' };
            })}
          />

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !proyecto ? (
            <div className="p-12 text-center text-slate-400 text-xs">Proyecto no encontrado.</div>
          ) : (
            <>
              {seccion === 'general' && <InformacionGeneralTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'cubicacion' && <CubicacionTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'abastecimiento' && <OrdenesCompraList proyectoId={proyectoId} proyectoLabel={proyecto.obra} />}
              {seccion === 'fabricacion' && <FabricacionTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'pendientes' && <PendientesTab proyecto={proyecto} />}
              {seccion === 'adicionales' && <AdicionalesTab proyecto={proyecto} />}
              {seccion === 'bodega' && (
                <div className="space-y-8">
                  <RecepcionesPendientesSection proyectoId={proyectoId} />
                  <RequisicionesSection proyecto={proyecto} activeVersion={activeVersion} />
                  <BodegaProyectoTab proyectoId={proyectoId} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
