import React from 'react';
import { actualizarParams } from '../../lib/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Loader2, Wallet, ShoppingCart, Warehouse, Layers, Factory, ClipboardList, Ruler } from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { OrdenesCompraList } from '../abastecimiento/OrdenesCompraList';
import { BodegaProyectoTab } from '../abastecimiento/BodegaProyectoTab';
import { RecepcionesPendientesSection } from '../abastecimiento/RecepcionesPendientesSection';
import { RequisicionesSection } from './RequisicionesSection';
import { ControlPresupuestoTab } from './ControlPresupuestoTab';
import { FasesTab } from './FasesTab';
import { CubicacionTab } from './cubicacion/CubicacionTab';
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
  { id: 'cubicacion', label: 'Cubicación', hint: 'Reparto por piso y departamento, rectificación y nomenclatura (opcional)', icon: <Ruler className="w-4 h-4" /> },
  { id: 'fases', label: 'Fases', hint: 'Distribuir unidades por etapa', icon: <Layers className="w-4 h-4" /> },
  { id: 'abastecimiento', label: 'Abastecimiento', hint: 'Generación y gestión de OC', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'fabricacion', label: 'Fabricación', hint: 'Documentos de fabricación de HETMO', icon: <Factory className="w-4 h-4" /> },
  { id: 'pendientes', label: 'Control de pendientes', hint: 'Lo que falta o falló en la obra', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'bodega', label: 'Bodega', hint: 'Requisiciones, stock y movimientos', icon: <Warehouse className="w-4 h-4" /> },
];

export const ProyectoWorkspace: React.FC<{ proyectoId: string; seccionInicial?: string; onVolver: () => void }> = ({
  proyectoId,
  seccionInicial,
  onVolver,
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
      <div className="px-5 sm:px-8 py-4 border-b border-slate-200 bg-white flex items-center gap-3 shrink-0">
        <button
          onClick={onVolver}
          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0"
          aria-label="Volver a Obras"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
          <Building2 className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black text-slate-900 truncate">{proyecto?.obra || 'Cargando...'}</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">
              {proyecto?.codigoInterno || (proyecto ? `PRJ-${proyecto.numeroPresupuesto}` : '')}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">{proyecto?.clienteNombreRaw}</p>
        </div>
        {proyecto && (
          <div className="ml-auto hidden sm:block">
            <ClayCentroCostoEditor proyectoId={proyecto.id} valor={proyecto.clayCentroCosto} />
          </div>
        )}
      </div>

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
              {seccion === 'cubicacion' && <CubicacionTab proyecto={proyecto} />}
              {seccion === 'fases' && <FasesTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'abastecimiento' && <OrdenesCompraList proyectoId={proyectoId} proyectoLabel={proyecto.obra} />}
              {seccion === 'fabricacion' && <FabricacionTab proyecto={proyecto} />}
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
