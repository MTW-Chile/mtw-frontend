import React, { useMemo } from 'react';
import {
  Maximize2,
  Paintbrush,
  MessageSquareText,
  Wrench,
  Boxes,
  DoorClosed,
  ChevronDown,
  Sliders,
  Trash2,
  Loader2,
  FlipHorizontal2,
  ArrowUpDown
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Ventana } from '../../../../types';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { buildProtexDoorSvg } from '../../components/drawing/protexDoorSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';

interface VentanaCardProps {
  ventana: Ventana;
  onOpenMaterials?: (ventana: Ventana) => void;
  onEditCorredera?: (ventana: Ventana) => void;
  onDeleteLineaManual?: (ventana: Ventana) => void;
  isDeletingLineaManual?: boolean;
  onEspejar?: (ventana: Ventana) => void;
  isEspejando?: boolean;
  onInvertirOrden?: (ventana: Ventana) => void;
  isInvirtiendoOrden?: boolean;
}

export const VentanaCard: React.FC<VentanaCardProps> = ({
  ventana,
  onOpenMaterials,
  onEditCorredera,
  onDeleteLineaManual,
  isDeletingLineaManual,
  onEspejar,
  isEspejando,
  onInvertirOrden,
  isInvirtiendoOrden,
}) => {
  const superficie = ventana.m2Ventana ?? ((ventana.anchoMm * ventana.altoMm) / 1_000_000);
  const esManual = ventana.origen === 'PERSONALIZADO';
  const esProtex = ventana.tipoLineaManual === 'PROTEX';

  // Extraemos el acabado y nombre de la apertura según el motor de HETMO
  const windowLine = useMemo(() => toWindowLine(ventana), [ventana]);
  const isSliding = useMemo(() => (windowLine ? core.isSlidingLine(windowLine) : false), [windowLine]);
  // "Invertir orden" solo tiene sentido en una línea compuesta en vertical
  // (más de un paño apilado, ej. proyectante + fijo) -- en una línea de un
  // solo paño no hay nada que reordenar.
  const isComposite = useMemo(() => {
    if (!windowLine) return false;
    const composite = core.compositePanels(windowLine) as { tiles: unknown[] } | null;
    return Boolean(composite && composite.tiles.length > 1);
  }, [windowLine]);
  // Sin marco (solo DVH) no tiene perfil -> no hay acabado que mostrar.
  const isFrameless = Boolean(windowLine?.dibujoSinMarco);

  const finish = useMemo(
    () => createFinish(windowLine?.acabadoCodigo, windowLine?.acabadoDescripcion, windowLine?.acabadoPatron),
    [windowLine]
  );
  const finishLabel = useMemo(
    () => getAcabadoLabel(ventana.acabadoCodigo, ventana.acabadoDescripcion),
    [ventana.acabadoCodigo, ventana.acabadoDescripcion]
  );
  const apertureLabel = useMemo(() => {
    // Una puerta Protex no pasa por el motor de aperturas de HETMO (ver
    // esProtex mas abajo, usa un esquema fijo aparte) -- "Ventana fija"
    // ahi seria enganoso, es una puerta abatible con herrajes, no un paño
    // sin apertura.
    if (ventana.tipoLineaManual === 'PROTEX') return 'Puerta Protex';
    if (!windowLine) return ventana.modelo || '—';
    return core.apertureLabel(windowLine);
  }, [windowLine, ventana.modelo, ventana.tipoLineaManual]);
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
            {!isFrameless && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: finish.frame }}
                title={`Acabado: ${finishLabel}`}
              />
            )}
            <h4 className="text-sm font-black text-slate-900 group-hover:text-brand-600 transition-colors">
              {ventana.modelo}
            </h4>
            {esManual ? (
              <span className="text-[10px] font-bold uppercase text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md">
                Manual
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">
                #{ventana.lineaHetmo}
              </span>
            )}
          </div>
          {lineaProducto && lineaProducto !== 'Línea no especificada' && (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {lineaProducto}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-brand-600/10 text-brand-600 border border-brand-600/20 font-bold text-xs font-mono">
            {ventana.unidades} {ventana.unidades === 1 ? 'ud' : 'uds'}
          </span>
        </div>
      </header>

      {/* Contenedor del Dibujo Técnico SVG (o esquema simple para líneas Protex) */}
      <div className="bg-[#f8fafc] w-full p-4 flex flex-col items-center justify-center border-b border-slate-100 min-h-[180px] group-hover:bg-[#f1f5f9] transition-colors relative">
        {esProtex ? (
          // Las puertas Protex no vienen de la geometria parametrica de
          // HETMO -- dibujo propio y aislado (protexDoorSvg.ts), no pasa
          // por el motor vectorial compartido (ver comentario ahi mismo:
          // isFrameless() forzaria "sin marco" sin bisagras/manilla, y
          // conectarla al motor de puertas real tocaria una regla que
          // comparten TODAS las ventanas y el PDF).
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-full max-w-[200px] h-[172px]"
              dangerouslySetInnerHTML={{
                __html: buildProtexDoorSvg(
                  ventana.numeroCuadrosHojas === 2 ? 2 : 1,
                  ventana.anchoMm,
                  ventana.altoMm
                ),
              }}
            />
            <span className="text-[11px] font-semibold text-slate-500 text-center max-w-[200px]">{ventana.modelo}</span>
          </div>
        ) : (
          <WindowRendererSvg ventana={ventana} />
        )}

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

          {/* Acabado con Chip de color -- no aplica a ventanas sin marco (solo DVH) */}
          {!isFrameless && (
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
          )}
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

      {/* Footer de Tarjeta / Revisión de Materiales y Herramientas Técnicas */}
      <footer className="px-3.5 sm:px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 space-y-2 text-xs">
        {/* Fila 1: Contador y Botón Ver Materiales */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Boxes className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-600 truncate font-medium">
              {ventana.materiales?.length ? (
                <>
                  <strong className="font-mono font-bold text-slate-800">{ventana.materiales.length}</strong> artículos
                </>
              ) : (
                'Despiece estándar'
              )}
            </span>
          </div>

          <button
            onClick={() => onOpenMaterials?.(ventana)}
            className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] shadow-2xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Revisión detallada de materiales de esta línea"
          >
            <span>Ver Materiales</span>
          </button>
        </div>

        {/* Fila 2: Herramientas Técnicas de Geometría / Ajuste */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 flex-wrap">
          {/* Espejar horizontal */}
          <button
            onClick={() => onEspejar?.(ventana)}
            disabled={isEspejando}
            className={`text-[11px] font-semibold flex items-center gap-1 transition-all px-2 py-0.5 rounded-lg border cursor-pointer disabled:opacity-50 ${
              ventana.espejado
                ? 'bg-brand-600/10 text-brand-600 border-brand-600/30 font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:bg-slate-100/80 shadow-2xs'
            }`}
            title="Espejar el dibujo horizontalmente (para ventanas que salen al revés en HETMO)"
          >
            {isEspejando ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlipHorizontal2 className="w-3 h-3" />}
            <span>{ventana.espejado ? 'Espejada' : 'Espejar'}</span>
          </button>

          {/* Corrección de Correderas */}
          {isSliding && (
            <button
              onClick={() => onEditCorredera?.(ventana)}
              className={`text-[11px] font-semibold flex items-center gap-1 transition-all px-2 py-0.5 rounded-lg border cursor-pointer ${
                ventana.correccionGeometria
                  ? 'bg-brand-600/10 text-brand-600 border-brand-600/30 font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:bg-slate-100/80 shadow-2xs'
              }`}
              title="Ajustar apertura, carriles y sentidos de las hojas de corredera"
            >
              <Sliders className="w-3 h-3" />
              <span>{ventana.correccionGeometria ? 'Ajustada' : 'Ajustar'}</span>
            </button>
          )}

          {/* Invertir orden en Compuestas */}
          {isComposite && (
            <button
              onClick={() => onInvertirOrden?.(ventana)}
              disabled={isInvirtiendoOrden}
              className={`text-[11px] font-semibold flex items-center gap-1 transition-all px-2 py-0.5 rounded-lg border cursor-pointer disabled:opacity-50 ${
                ventana.ordenPanelesInvertido
                  ? 'bg-brand-600/10 text-brand-600 border-brand-600/30 font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:bg-slate-100/80 shadow-2xs'
              }`}
              title="Invertir qué paño va arriba y cuál abajo en el dibujo"
            >
              {isInvirtiendoOrden ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
              <span>{ventana.ordenPanelesInvertido ? 'Invertido' : 'Invertir'}</span>
            </button>
          )}

          {/* Quitar Línea Manual */}
          {esManual && (
            <button
              onClick={() => onDeleteLineaManual?.(ventana)}
              disabled={isDeletingLineaManual}
              className="text-[11px] font-semibold flex items-center gap-1 transition-all px-2 py-0.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer disabled:opacity-50 ml-auto"
              title="Quitar esta línea manual"
            >
              {isDeletingLineaManual ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              <span>Quitar</span>
            </button>
          )}
        </div>
      </footer>
    </article>
  );
};