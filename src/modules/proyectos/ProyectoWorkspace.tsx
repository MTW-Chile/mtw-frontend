import React, { useEffect } from 'react';
import { actualizarParams } from '../../lib/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LayoutDashboard, ShoppingCart, Factory, ClipboardList, Ruler, FilePlus2, Receipt, PackageOpen } from 'lucide-react';
import { HeaderSlot } from '../../components/layout/HeaderSlot';
import { actualizarFabricacionesObra, getProyectoById } from '../../api/client';
import { OrdenesCompraList } from '../abastecimiento/OrdenesCompraList';
import { RequisicionesSection } from './RequisicionesSection';
import { InformacionGeneralTab } from './InformacionGeneralTab';
import { CubicacionTab } from './cubicacion/CubicacionTab';
import { FabricacionTab } from './fabricacion/FabricacionTab';
import { PendientesTab } from './pendientes/PendientesTab';
import { AdicionalesTab } from './adicionales/AdicionalesTab';
import { EstadosPagoTab } from './estados-pago/EstadosPagoTab';
import { ClayCentroCostoEditor } from './ClayCentroCostoEditor';
import { PERMISO_SECCION, seccionDisponible, seccionEfectiva, seccionesDelModo, type ModoWorkspace, type SeccionObra } from './seccionesObra';
import { usePermisos } from '../../lib/permisos';
import { BarraPestanas } from '../../components/ui/PageHeader';
import { useMigas } from '../../lib/migas';

// "Control de documentos" (conciliacion de OC contra facturas de Clay) se
// saco de aca -- vive solo en Compras (ComprasPage > sub-tab
// Conciliacion, ControlDocumentosTab sin proyectoId) para todas las obras
// juntas, en vez de repetido obra por obra. Lo mismo con el stock y los
// movimientos de la bodega de la obra: se miran en el modulo Bodega.
type Seccion = SeccionObra;

// Catalogo de pestañas; cuales se ven en cada modo lo dice seccionesDelModo().
const SECCIONES: { id: Seccion; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'Información General', hint: 'Métricas, control de presupuesto por partida y documentos', icon: LayoutDashboard },
  { id: 'cubicacion', label: 'Cubicación', hint: 'Reparto por piso y departamento, rectificación y nomenclatura (opcional)', icon: Ruler },
  { id: 'requisiciones', label: 'Requisiciones', hint: 'Solicitudes de material a bodega por fase', icon: PackageOpen },
  { id: 'fabricacion', label: 'Fases', hint: 'Fases de la obra y documentos de fabricación de HETMO', icon: Factory },
  { id: 'abastecimiento', label: 'Abastecimiento', hint: 'Solicitudes de materiales a Compras y su estado', icon: ShoppingCart },
  { id: 'pendientes', label: 'Pendientes', hint: 'Lo que falta o falló en esta obra', icon: ClipboardList },
  { id: 'adicionales', label: 'Adicionales', hint: 'Ventas o cargos fuera del presupuesto aceptado', icon: FilePlus2 },
  { id: 'estados-pago', label: 'Estados de pago', hint: 'Cobros parciales al cliente por hitos de cada ventana', icon: Receipt },
];

// modo 'obra': Comercial > Obras en curso. modo 'fabricacion': la misma obra
// vista desde el taller (seccion Fabricacion del menu). Ver seccionesDelModo().
export const ProyectoWorkspace: React.FC<{ proyectoId: string; seccionInicial?: string; onVolver: () => void; modo?: ModoWorkspace }> = ({
  proyectoId,
  seccionInicial,
  modo = 'obra',
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

  // Al abrir la obra se pone al día su fabricación con HETMO (lotes nuevos y
  // estados de fase), sin esperar al sync automático. Si algo se leyó, se
  // refresca lo que lo muestra.
  const queryClient = useQueryClient();
  const actualizarFabricacion = useMutation({
    mutationFn: () => actualizarFabricacionesObra(proyectoId),
    onSuccess: (r) => {
      if (r.omitida || (r.detectadas === 0 && r.refrescadas === 0)) return;
      queryClient.invalidateQueries({ queryKey: ['fabricaciones', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['fabricacionDetalle', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
    },
    // Silencioso: si HETMO no responde, la obra se ve con lo último guardado.
    meta: { silencioso: true },
  });
  const { mutate: pedirActualizacion } = actualizarFabricacion;
  useEffect(() => {
    pedirActualizacion();
  }, [proyectoId, pedirActualizacion]);

  // Una obra manual nunca se cotizo: las secciones que dependen del
  // presupuesto se ven en gris (ver seccionesObra.ts) y un enlace a una de
  // ellas cae a Información General. Mientras carga la obra no se sabe su origen.
  const seccion: Seccion = seccionEfectiva(seccionInicial, proyecto?.origen, modo);
  // Las pestañas dependen del modo y del origen (una obra manual en Comercial
  // solo tiene Información General); mientras carga la obra no se muestran.
  const seccionesVisibles = proyecto ? seccionesDelModo(modo, proyecto.origen) : [];
  const pestanas = SECCIONES.filter((s) => seccionesVisibles.includes(s.id))
    // Pestañas con permiso propio (ver PERMISO_SECCION); la API exige lo mismo.
    .filter((s) => !PERMISO_SECCION[s.id] || tiene(PERMISO_SECCION[s.id]!))
    .map((s) => {
      const disponible = seccionDisponible(s.id, proyecto?.origen);
      return { id: s.id, label: s.label, icon: s.icon, disabled: !disponible, title: disponible ? s.hint : 'No disponible: esta obra se creó a mano y no fue cotizada' };
    });
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
              <span className="hidden @6xl:inline text-xs text-slate-500 truncate max-w-[220px]" title="Cliente">
                {proyecto.clienteNombreRaw}
              </span>
            )}
            {/* Centro de costo de Clay: es un dato comercial/contable, solo en Obras en curso.
                Solo con espacio para una línea; si no, va en Información General. */}
            {modo === 'obra' && (
              <div className="ml-auto hidden @5xl:block">
                <ClayCentroCostoEditor proyectoId={proyecto.id} valor={proyecto.clayCentroCosto} />
              </div>
            )}
          </>
        )}
      </HeaderSlot>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Menu superior -- unica nav, para cualquier ancho (antes era un
            sidebar lateral en escritorio + esta misma fila solo en
            mobile; reemplazado por pedido explicito). overflow-x-auto
            cubre el caso de que no entren todos los tabs en una pantalla
            angosta. */}
        {/* Con una sola pestaña (obra manual en Comercial) la barra no aporta nada. */}
        {pestanas.length > 1 && <BarraPestanas active={seccion} onChange={(id) => setSeccion(id)} tabs={pestanas} />}

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
              {seccion === 'requisiciones' && <RequisicionesSection proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'abastecimiento' && <OrdenesCompraList proyectoId={proyectoId} proyectoLabel={proyecto.obra} />}
              {seccion === 'fabricacion' && <FabricacionTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'estados-pago' && <EstadosPagoTab proyecto={proyecto} />}
              {seccion === 'pendientes' && <PendientesTab proyecto={proyecto} />}
              {seccion === 'adicionales' && <AdicionalesTab proyecto={proyecto} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
