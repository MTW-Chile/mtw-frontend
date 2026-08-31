import React, { useMemo } from 'react';
import { 
  Maximize2, 
  Paintbrush, 
  MessageSquareText, 
  Wrench, 
  Boxes,
  DoorClosed,
  ChevronDown,
  Sliders
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Ventana } from '../../../../types';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';

interface VentanaCardProps {
  ventana: Ventana;
  onOpenMaterials?: (ventana: Ventana) => void;
  onEditCorredera?: (ventana: Ventana) => void;
}

export const VentanaCard: React.FC<VentanaCardProps> = ({
  ventana,
  onOpenMaterials,
  onEditCorredera,
}) => {
  const superficie = ventana.m2Ventana ?? ((ventana.anchoMm * ventana.altoMm) / 1_000_000);

  // Extraemos el acabado y nombre de la apertura según el motor de HETMO
  const windowLine = useMemo(() => toWindowLine(ventana), [ventana]);
  const isSliding = useMemo(() => (windowLine ? core.isSlidingLine(windowLine) : false), [windowLine]);

  const finish = useMemo(
    () => createFinish(windowLine?.acabadoCodigo, windowLine?.acabadoDescripcion, windowLine?.acabadoPatron),
    [windowLine]
  );
  const finishLabel = useMemo(
    () => getAcabadoLabel(ventana.acabadoCodigo, ventana.acabadoDescripcion),
    [ventana.acabadoCodigo, ventana.acabadoDescripcion]
  );
  const apertureLabel = useMemo(() => {
    if (!windowLine) return ventana.modelo || '—';
    return core.apertureLabel(windowLine);
  }, [windowLine, ventana.modelo]);
  // El nombre comercial de la serie (Advance/Efficient/Prime/Jumbo) viaja en
  // descripcionCorta ("Puerta Efficient DC 55-100..."), no en modelo (que
  // trae el codigo de obra/item, ej. "CASA A - PV02") -- profileSeries lee
  // line.modelo, asi que le pasamos descripcionCorta como fuente.
  const lineaProducto = useMemo(
    () => core.profileSeries({ modelo: ventana.descripcionCorta || ventana.modelo }),
    [ventana.descripcionCorta, ventana.modelo]
  );

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col overflow-hidden group">
      {/* Cabecera de la Tarjeta */}
      <header className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-full shrink-0" 
              style={{ backgroundColor: finish.frame }}
              title={`Acabado: ${finishLabel}`}
            />
            <h4 className="text-sm font-black text-slate-900 group-hover:text-[#E34A26] transition-colors">
              {ventana.modelo}
            </h4>
            <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
              #{ventana.lineaHetmo}
            </span>
          </div>
          {lineaProducto && lineaProducto !== 'Línea no especificada' && (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {lineaProducto}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 font-bold text-xs font-mono">
            {ventana.unidades} {ventana.unidades === 1 ? 'ud' : 'uds'}
          </span>
        </div>
      </header>

      {/* Contenedor del Dibujo Técnico SVG */}
      <div className="bg-[#f8fafc] w-full p-4 flex flex-col items-center justify-center border-b border-slate-100 min-h-[180px] group-hover:bg-[#f1f5f9] transition-colors relative">
        <WindowRendererSvg ventana={ventana} />

        {import.meta.env.DEV && (
          <details className="absolute top-2 right-2 text-[8px] max-w-[200px] bg-white/80 p-1 opacity-20 hover:opacity-100 z-50">
            <summary className="cursor-pointer text-slate-500 font-bold">Debug Geo</summary>
            <pre className="overflow-auto max-h-32 text-left text-slate-700">
              {JSON.stringify(ventana.geometrias, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* Cuerpo y Especificaciones */}
      <div className="p-4 flex-1 space-y-3 text-xs">
        {/* Metadatos principales */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-slate-600">
          {/* Medidas mm */}
          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono font-bold text-slate-900">
              {formatNumber(ventana.anchoMm, 0)} × {formatNumber(ventana.altoMm, 0)} mm
            </span>
          </div>

          {/* Superficie m2 */}
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-slate-400">Área:</span>
            <span className="font-mono font-bold text-slate-900">
              {formatNumber(superficie, 2)} m²
            </span>
          </div>

          {/* Apertura técnica */}
          <div className="col-span-2 pt-1.5 border-t border-slate-100 flex items-start gap-1.5">
            <DoorClosed className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Apertura</span>
              <span className="font-bold text-slate-900 leading-snug block">
                {apertureLabel}
              </span>
            </div>
          </div>

          {/* Acabado con Chip de color */}
          <div className="col-span-2 pt-1.5 border-t border-slate-100 flex items-center gap-2">
            <Paintbrush className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Acabado:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 bg-slate-50 text-slate-800">
              <span 
                className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-inner shrink-0" 
                style={{ backgroundColor: finish.frame }}
              />
              <span className="truncate max-w-[200px]" title={finishLabel}>
                {finishLabel}
              </span>
            </span>
          </div>
        </div>

        {/* Comentario de Presupuesto (Desplegable - cerrado por defecto) */}
        {ventana.comentarioPresupuesto && (
          <details className="group/pres rounded-xl bg-amber-50/70 border border-amber-200/80 overflow-hidden text-amber-900 text-xs transition-all">
            <summary className="flex items-center justify-between px-3 py-2 cursor-pointer font-bold text-[10px] uppercase tracking-wider text-amber-800 select-none hover:bg-amber-100/50">
              <span className="flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Comentario de Presupuesto</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-600 transition-transform duration-200 group-open/pres:rotate-180" />
            </summary>
            <div className="px-3 pb-2.5 pt-1 text-[11px] leading-relaxed font-medium border-t border-amber-200/50 bg-white/50">
              {ventana.comentarioPresupuesto}
            </div>
          </details>
        )}

        {/* Comentario de Fabricación (Desplegable - cerrado por defecto) */}
        {ventana.comentarioFabricacion && (
          <details className="group/fab rounded-xl bg-blue-50/70 border border-blue-200/80 overflow-hidden text-blue-900 text-xs transition-all">
            <summary className="flex items-center justify-between px-3 py-2 cursor-pointer font-bold text-[10px] uppercase tracking-wider text-blue-800 select-none hover:bg-blue-100/50">
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Comentario de Taller / Fábrica</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-600 transition-transform duration-200 group-open/fab:rotate-180" />
            </summary>
            <div className="px-3 pb-2.5 pt-1 text-[11px] leading-relaxed font-medium border-t border-blue-200/50 bg-white/50">
              {ventana.comentarioFabricacion}
            </div>
          </details>
        )}

      </div>

      {/* Footer de Tarjeta / Revisión de Materiales y Ajuste de Correderas */}
      <footer className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">
          {ventana.materiales?.length ? `${ventana.materiales.length} materiales` : 'Despiece estándar'}
        </span>
        <div className="flex items-center gap-1.5">
          {isSliding && (
            <button
              onClick={() => onEditCorredera?.(ventana)}
              className={`text-xs font-semibold flex items-center gap-1 transition-colors px-2 py-1 rounded-lg border cursor-pointer ${
                ventana.correccionGeometria
                  ? 'bg-orange-50 text-[#E34A26] border-orange-200 hover:bg-orange-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:text-[#E34A26] hover:bg-slate-50'
              }`}
              title="Ajustar apertura, carriles y sentidos de las hojas de corredera"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{ventana.correccionGeometria ? 'Ajustada' : 'Ajustar'}</span>
            </button>
          )}
          <button
            onClick={() => onOpenMaterials?.(ventana)}
            className="text-xs font-semibold text-slate-600 hover:text-[#E34A26] flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            title="Revisión de materiales de esta línea"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Ver Materiales</span>
          </button>
        </div>
      </footer>
    </article>
  );
};