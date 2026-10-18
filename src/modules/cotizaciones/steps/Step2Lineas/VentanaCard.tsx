import React, { useMemo } from 'react';
import { Maximize2, MessageSquareText, Wrench, ChevronDown, Trash2, Loader2, Pencil } from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Ventana } from '../../../../types';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { buildProtexDoorSvg } from '../../components/drawing/protexDoorSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';

interface VentanaCardProps {
  ventana: Ventana;
  onEditar?: (ventana: Ventana) => void;
  onDeleteLineaManual?: (ventana: Ventana) => void;
  isDeletingLineaManual?: boolean;
}

// Etiqueta de sección dentro de la tarjeta (mismo criterio que el resto del módulo).
const Dato: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
    <div className="text-xs font-semibold text-slate-900 truncate">{children}</div>
  </div>
);

export const VentanaCard: React.FC<VentanaCardProps> = ({ ventana, onEditar, onDeleteLineaManual, isDeletingLineaManual }) => {
  const superficie = ventana.m2Ventana ?? ((ventana.anchoMm * ventana.altoMm) / 1_000_000);
  const esManual = ventana.origen === 'PERSONALIZADO';
  const esProtex = ventana.tipoLineaManual === 'PROTEX';

  // Extraemos el acabado y nombre de la apertura según el motor de HETMO
  const windowLine = useMemo(() => toWindowLine(ventana), [ventana]);
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
    // Una puerta Protex no pasa por el motor de aperturas de HETMO (usa un
    // esquema fijo aparte) -- "Ventana fija" ahí sería engañoso.
    if (ventana.tipoLineaManual === 'PROTEX') return 'Puerta Protex';
    if (!windowLine) return ventana.modelo || '—';
    return core.apertureLabel(windowLine);
  }, [windowLine, ventana.modelo, ventana.tipoLineaManual]);
  // El nombre comercial de la serie (Advance/Efficient/Prime/Jumbo) viaja en
  // descripcionCorta, no en modelo (que trae el código de obra).
  const lineaProducto = useMemo(
    () => core.profileSeries({ modelo: ventana.descripcionCorta || ventana.modelo }),
    [ventana.descripcionCorta, ventana.modelo]
  );

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col overflow-hidden">
      {/* Cabecera: modelo, serie y unidades */}
      <header className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {!isFrameless && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-300"
                style={{ backgroundColor: finish.frame }}
                title={`Acabado: ${finishLabel}`}
              />
            )}
            <h3 className="text-sm font-bold text-slate-900 truncate" title={ventana.modelo}>
              {ventana.modelo}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {esManual ? (
              <Badge size="sm" variant="info">Manual</Badge>
            ) : (
              <Badge size="sm" variant="outline">#{ventana.lineaHetmo}</Badge>
            )}
            {lineaProducto && lineaProducto !== 'Línea no especificada' && (
              <span className="text-[11px] text-slate-500 truncate">{lineaProducto}</span>
            )}
          </div>
        </div>
        <Badge size="sm" variant="brand" className="shrink-0">
          {ventana.unidades} {ventana.unidades === 1 ? 'ud' : 'uds'}
        </Badge>
      </header>

      {/* Dibujo técnico (o esquema propio para puertas Protex) */}
      <div className="relative bg-slate-50 p-4 flex flex-col items-center justify-center border-b border-slate-100 min-h-[180px]">
        {esProtex ? (
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-full max-w-[200px] h-[172px]"
              dangerouslySetInnerHTML={{
                __html: buildProtexDoorSvg(ventana.numeroCuadrosHojas === 2 ? 2 : 1, ventana.anchoMm, ventana.altoMm),
              }}
            />
            <span className="text-[11px] font-semibold text-slate-500 text-center max-w-[200px]">{ventana.modelo}</span>
          </div>
        ) : (
          <WindowRendererSvg ventana={ventana} />
        )}

        {import.meta.env.DEV && (
          <details className="absolute top-2 right-2 text-[8px] max-w-[200px] bg-white/80 p-1 opacity-20 hover:opacity-100 z-10">
            <summary className="cursor-pointer text-slate-500 font-bold">Debug Geo</summary>
            <pre className="overflow-auto max-h-32 text-left text-slate-700">{JSON.stringify(ventana.geometrias, null, 2)}</pre>
          </details>
        )}
      </div>

      {/* Especificaciones */}
      <div className="px-4 py-3.5 flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Medidas">
            <span className="inline-flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {formatNumber(ventana.anchoMm, 0)} × {formatNumber(ventana.altoMm, 0)} mm
            </span>
          </Dato>
          <Dato label="Superficie">{formatNumber(superficie, 2)} m²</Dato>
          <Dato label="Apertura" className="col-span-2">{apertureLabel}</Dato>
          {!isFrameless && (
            <Dato label="Acabado" className="col-span-2">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: finish.frame }} />
                <span className="truncate">{finishLabel}</span>
              </span>
            </Dato>
          )}
        </div>

        {ventana.comentarioPresupuesto && (
          <details className="group rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs overflow-hidden">
            <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none hover:bg-amber-100/60">
              <span className="flex items-center gap-1.5 font-semibold">
                <MessageSquareText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Comentario de presupuesto
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-600 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-3 pb-2.5 pt-1 leading-relaxed border-t border-amber-200/60 bg-white/60">{ventana.comentarioPresupuesto}</div>
          </details>
        )}

        {ventana.comentarioFabricacion && (
          <details className="group rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs overflow-hidden">
            <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none hover:bg-blue-100/60">
              <span className="flex items-center gap-1.5 font-semibold">
                <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                Comentario de taller / fábrica
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-blue-600 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-3 pb-2.5 pt-1 leading-relaxed border-t border-blue-200/60 bg-white/60">{ventana.comentarioFabricacion}</div>
          </details>
        )}
      </div>

      {/* Pie: despiece y acciones */}
      <footer className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs text-slate-600 truncate">
          {ventana.materiales?.length ? (
            <>
              <strong className="font-bold text-slate-900">{ventana.materiales.length}</strong> artículos
            </>
          ) : (
            'Despiece estándar'
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {esManual && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteLineaManual?.(ventana)}
              disabled={isDeletingLineaManual}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              leftIcon={isDeletingLineaManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              title="Quitar esta línea manual"
            >
              Quitar
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => onEditar?.(ventana)}
            leftIcon={<Pencil className="w-3.5 h-3.5" />}
            title="Editar el dibujo y los materiales de esta línea"
          >
            Editar línea
          </Button>
        </div>
      </footer>
    </article>
  );
};
