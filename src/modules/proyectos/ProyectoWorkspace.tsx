import React from 'react';
import { actualizarParams } from '../../lib/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Wallet, ShoppingCart, Warehouse, Factory, ClipboardList, Ruler, FolderOpen } from 'lucide-react';
import { HeaderSlot } from '../../components/layout/HeaderSlot';
import { Badge } from '../../components/ui/Badge';
import { getProyectoById } from '../../api/client';
import { OrdenesCompraList } from '../abastecimiento/OrdenesCompraList';
import { BodegaProyectoTab } from '../abastecimiento/BodegaProyectoTab';
import { RecepcionesPendientesSection } from '../abastecimiento/RecepcionesPendientesSection';
import { RequisicionesSection } from './RequisicionesSection';
import { ControlPresupuestoTab } from './ControlPresupuestoTab';
import { CubicacionTab } from './cubicacion/CubicacionTab';
import { DocumentosObraTab } from './documentos/DocumentosObraTab';
import { FabricacionTab } from './fabricacion/FabricacionTab';
import { PendientesTab } from './pendientes/PendientesTab';
import { ClayCentroCostoEditor } from './ClayCentroCostoEditor';
import { seccionDisponible, seccionEfectiva, type SeccionObra } from './seccionesObra';

// "Control de documentos" (conciliacion de OC contra facturas de Clay) se
// saco de aca -- vive solo en Compras (ComprasPage > sub-tab
// Conciliacion, ControlDocumentosTab sin proyectoId) para todas las obras
// juntas, en vez de repetido obra por obra.
type Seccion = SeccionObra;

const SECCIONES: { id: Seccion; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'presupuesto', label: 'Control de presupuesto', hint: 'Revisión por partida de gastos', icon: <Wallet className="w-4 h-4" /> },
  { id: 'documentos', label: 'Documentos', hint: 'Carpeta de OneDrive de la obra', icon: <FolderOpen className="w-4 h-4" /> },
  { id: 'cubicacion', label: 'Cubicación', hint: 'Reparto por piso y departamento, rectificación y nomenclatura (opcional)', icon: <Ruler className="w-4 h-4" /> },
  { id: 'abastecimiento', label: 'Abastecimiento', hint: 'Generación y gestión de OC', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'fabricacion', label: 'Fabricación', hint: 'Documentos de fabricación de HETMO', icon: <Factory className="w-4 h-4" /> },
  { id: 'pendientes', label: 'Control de pendientes', hint: 'Lo que falta o falló en la obra', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'bodega', label: 'Bodega', hint: 'Requisiciones, stock y movimientos', icon: <Warehouse className="w-4 h-4" /> },
];

export const ProyectoWorkspace: React.FC<{ proyectoId: string; seccionInicial?: string; onVolver: () => void }> = ({
  proyectoId,
  seccionInicial,
}) => {
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
  // ellas cae a Fabricacion. Mientras carga la obra no se sabe su origen.
  const seccion: Seccion = seccionEfectiva(seccionInicial, proyecto?.origen);

  // La ejecucion real de la obra sigue la version activa (la misma que
  // define versionActivaHetmoId en Cotizaciones), no siempre la de
  // versionNumero mas alto -- una obra en curso no deberia "saltar" de
  // presupuesto de golpe si Hetmo genera una version nueva sin que
  // alguien la elija a proposito.
  const activeVersion =
    proyecto?.versiones.find((v) => v.hetmoId === proyecto.versionActivaHetmoId) || proyecto?.versiones[0];

  return (
    <div className="flex flex-col h-full">
      {/* Código, cliente y centro de costo viven en el Header del sitio (portal), igual que Presupuestos. */}
      <HeaderSlot>
        {proyecto && (
          <>
            <Badge size="sm" className="hidden sm:inline-flex font-mono font-bold text-slate-600" title="Código de la obra">
              {proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`}
            </Badge>
            <span className="hidden @3xl:inline text-xs text-slate-500 truncate max-w-[220px]" title={proyecto.clienteNombreRaw}>
              {proyecto.clienteNombreRaw}
            </span>
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
        <div className="border-b border-slate-200 bg-white overflow-x-auto flex shrink-0 px-2 sm:px-5">
          {SECCIONES.map((s) => {
            const disponible = seccionDisponible(s.id, proyecto?.origen);
            return (
              <button
                key={s.id}
                onClick={() => disponible && setSeccion(s.id)}
                disabled={!disponible}
                aria-disabled={!disponible}
                title={disponible ? s.hint : 'No disponible: esta obra se creó a mano y no fue cotizada'}
                className={`flex items-center gap-2 px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                  !disponible
                    ? 'border-transparent text-slate-300 cursor-not-allowed'
                    : seccion === s.id
                      ? 'border-brand-600 text-brand-600 cursor-pointer'
                      : 'border-transparent text-slate-500 hover:text-slate-800 cursor-pointer'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !proyecto ? (
            <div className="p-12 text-center text-slate-400 text-xs">Proyecto no encontrado.</div>
          ) : (
            <>
              {seccion === 'presupuesto' && <ControlPresupuestoTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'documentos' && <DocumentosObraTab proyecto={proyecto} />}
              {seccion === 'cubicacion' && <CubicacionTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'abastecimiento' && <OrdenesCompraList proyectoId={proyectoId} proyectoLabel={proyecto.obra} />}
              {seccion === 'fabricacion' && <FabricacionTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'pendientes' && <PendientesTab proyecto={proyecto} />}
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
