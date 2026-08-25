import React, { useMemo } from 'react';
import { 
  Maximize2, 
  Paintbrush, 
  MessageSquareText, 
  Wrench, 
  Boxes,
  DoorClosed
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Ventana } from '../../../../types';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { 
  resolveProfileFinish, 
  buildCompositeStructure 
} from '../../components/drawing/windowDrawingEngine';

interface VentanaCardProps {
  ventana: Ventana;
  monedaSimbolo?: string;
  onOpenMaterials?: (ventana: Ventana) => void;
}

export const VentanaCard: React.FC<VentanaCardProps> = ({
  ventana,
  monedaSimbolo = '$',
  onOpenMaterials,
}) => {
  const superficie = ventana.m2Ventana ?? ((ventana.anchoMm * ventana.altoMm) / 1_000_000);
  const totalLinea = (ventana.importeUnitario || 0) * (ventana.unidades || 1);

  const finish = useMemo(() => resolveProfileFinish(ventana), [ventana]);
  const composite = useMemo(() => buildCompositeStructure(ventana), [ventana]);

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col overflow-hidden group">
      {/* Cabecera de la Tarjeta */}
      <header className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-full shrink-0" 
              style={{ backgroundColor: finish.base }}
              title={`Acabado: ${finish.name}`}
            />
            <h4 className="text-sm font-black text-slate-900 group-hover:text-[#E34A26] transition-colors">
              {ventana.modelo}
            </h4>
            <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
              #{ventana.lineaHetmo}
            </span>
          </div>
          {ventana.descripcionCorta && (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {ventana.descripcionCorta}
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
      <div className="p-3 bg-slate-50/50 flex items-center justify-center border-b border-slate-100">
        <WindowRendererSvg ventana={ventana} className="w-full h-44" />
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
                {composite.apertureLabel}
              </span>
            </div>
          </div>

          {/* Acabado con Chip de color */}
          <div className="col-span-2 pt-1.5 border-t border-slate-100 flex items-center gap-2">
            <Paintbrush className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Acabado:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border border-slate-200 bg-slate-50 text-slate-800">
              <span 
                className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-inner" 
                style={{ backgroundColor: finish.base }}
              />
              {finish.name}
            </span>
          </div>
        </div>

        {/* Comentario de Presupuesto */}
        {ventana.comentarioPresupuesto && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              <MessageSquareText className="w-3 h-3" />
              <span>Comentario de Presupuesto</span>
            </div>
            <p className="text-[11px] leading-relaxed font-medium">
              {ventana.comentarioPresupuesto}
            </p>
          </div>
        )}

        {/* Comentario de Fabricación */}
        {ventana.comentarioFabricacion && (
          <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-900 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
              <Wrench className="w-3 h-3" />
              <span>Comentario de Taller / Fábrica</span>
            </div>
            <p className="text-[11px] leading-relaxed font-medium">
              {ventana.comentarioFabricacion}
            </p>
          </div>
        )}

        {/* Valores Comerciales de Línea */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 block">Unitario Neto</span>
            <span className="font-mono font-bold text-slate-800 text-xs">
              {monedaSimbolo} {formatNumber(ventana.importeUnitario, 0)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Total Línea</span>
            <span className="font-mono font-black text-emerald-600 text-sm">
              {monedaSimbolo} {formatNumber(totalLinea, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer de Tarjeta / Revisión de Materiales Individual (Pendiente) */}
      <footer className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">
          {ventana.materiales?.length ? `${ventana.materiales.length} materiales` : 'Despiece estándar'}
        </span>
        <button
          onClick={() => onOpenMaterials?.(ventana)}
          className="text-xs font-semibold text-slate-600 hover:text-[#E34A26] flex items-center gap-1 transition-colors"
          title="Revisión de materiales de esta ventana (en desarrollo)"
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Ver Materiales</span>
        </button>
      </footer>
    </article>
  );
};
