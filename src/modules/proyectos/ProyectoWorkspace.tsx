import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Loader2, Wallet, ShoppingCart, FileCheck2, Warehouse, Layers } from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { OrdenesCompraList } from '../abastecimiento/OrdenesCompraList';
import { BodegaProyectoTab } from '../abastecimiento/BodegaProyectoTab';
import { RequisicionesSection } from './RequisicionesSection';
import { ControlPresupuestoTab } from './ControlPresupuestoTab';
import { ControlDocumentosTab } from './ControlDocumentosTab';
import { FasesTab } from './FasesTab';

type Seccion = 'presupuesto' | 'fases' | 'abastecimiento' | 'documentos' | 'bodega';

const SECCIONES: { id: Seccion; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'presupuesto', label: 'Control de presupuesto', hint: 'Revisión por partida de gastos', icon: <Wallet className="w-4 h-4" /> },
  { id: 'fases', label: 'Fases', hint: 'Distribuir unidades por etapa', icon: <Layers className="w-4 h-4" /> },
  { id: 'abastecimiento', label: 'Abastecimiento', hint: 'Generación y gestión de OC', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'documentos', label: 'Control de documentos', hint: 'OC vinculadas con facturas', icon: <FileCheck2 className="w-4 h-4" /> },
  { id: 'bodega', label: 'Bodega', hint: 'Requisiciones, stock y movimientos', icon: <Warehouse className="w-4 h-4" /> },
];

export const ProyectoWorkspace: React.FC<{ proyectoId: string; seccionInicial?: string; onVolver: () => void }> = ({
  proyectoId,
  seccionInicial,
  onVolver,
}) => {
  const seccionValida = (s: string | undefined): s is Seccion => SECCIONES.some((sec) => sec.id === s);
  const [seccion, setSeccion] = useState<Seccion>(seccionValida(seccionInicial) ? seccionInicial : 'presupuesto');

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
  });

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
          aria-label="Volver a Proyectos"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
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
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sub-nav lateral: solo existe una vez adentro de un proyecto */}
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 p-3 space-y-1 overflow-y-auto hidden sm:block">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                seccion === s.id ? 'bg-[#E34A26]/10 border border-[#E34A26]/20' : 'hover:bg-slate-100 border border-transparent'
              }`}
            >
              <div className={`flex items-center gap-2 text-xs font-bold ${seccion === s.id ? 'text-[#E34A26]' : 'text-slate-700'}`}>
                {s.icon}
                {s.label}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 pl-6">{s.hint}</div>
            </button>
          ))}
        </aside>

        {/* Selector de seccion en mobile (la sidebar lateral se oculta) */}
        <div className="sm:hidden border-b border-slate-200 bg-white overflow-x-auto flex shrink-0">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 ${
                seccion === s.id ? 'border-[#E34A26] text-[#E34A26]' : 'border-transparent text-slate-500'
              }`}
            >
              {s.label}
            </button>
          ))}
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
              {seccion === 'fases' && <FasesTab proyecto={proyecto} activeVersion={activeVersion} />}
              {seccion === 'abastecimiento' && <OrdenesCompraList proyectoId={proyectoId} proyectoLabel={proyecto.obra} />}
              {seccion === 'documentos' && <ControlDocumentosTab proyectoId={proyectoId} />}
              {seccion === 'bodega' && (
                <div className="space-y-8">
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
