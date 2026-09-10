import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  Maximize2,
  DoorClosed,
  Paintbrush,
  Boxes,
  Plus,
  Repeat,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { MaterialVentana, Ventana } from '../../../../types';
import { formatNumber } from '../../../../lib/utils';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';
import { addVentanaMaterial, reemplazarVentanaMaterial, eliminarVentanaMaterial } from '../../../../api/client';
import { MaterialLineaForm, type MaterialLineaFormPayload } from './MaterialLineaForm';

interface MaterialesLineaModalProps {
  ventana: Ventana;
  isOpen: boolean;
  onClose: () => void;
  /** La línea acaba de cambiar (se agregó/reemplazó/quitó un material): el padre debe refrescar su copia. El modal sigue abierto -- no es un cierre. */
  onUpdated: (updated: Ventana) => void;
}

type EditMode = { type: 'add' } | { type: 'replace'; row: MaterialVentana } | null;

const familyOrder = ['Perfileria', 'Herrajes', 'Juntas', 'Vidrios', 'Refuerzos', 'Superficies', 'Accesorios', 'Otros'];
const familyBadgeColors: Record<string, string> = {
  Perfileria: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Herrajes: 'bg-amber-50 text-amber-700 border-amber-200',
  Juntas: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Vidrios: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Refuerzos: 'bg-purple-50 text-purple-700 border-purple-200',
  Superficies: 'bg-rose-50 text-rose-700 border-rose-200',
  Accesorios: 'bg-slate-100 text-slate-700 border-slate-200',
  Otros: 'bg-slate-100 text-slate-700 border-slate-200',
};

/**
 * Despiece de materiales de UNA línea, con edición: agregar un ítem del
 * maestro, reemplazar uno HETMO por otro del maestro, o deshacer cualquiera
 * de los dos. Cada fila queda ligada a esta línea (ventanaId) para que la
 * Analítica de Materiales y, más adelante, las listas de materiales por fase
 * de fabricación, la hereden automáticamente -- ver comentarios en
 * mtw-api/src/index.ts (sección "MATERIALES PERSONALIZADOS POR LINEA").
 */
export const MaterialesLineaModal: React.FC<MaterialesLineaModalProps> = ({ ventana, isOpen, onClose, onUpdated }) => {
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const v = ventana;
  const sup = v.m2Ventana ?? ((v.anchoMm * v.altoMm) / 1_000_000);
  const wLine = toWindowLine(v);
  const finish = createFinish(wLine?.acabadoCodigo, wLine?.acabadoDescripcion, wLine?.acabadoPatron);
  const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
  const apLabel = wLine ? core.apertureLabel(wLine) : v.modelo || '—';

  const mats = v.materiales || [];
  const groupedFamilies = mats.reduce<Record<string, typeof mats>>((acc, item) => {
    const fam = item.material?.familia || 'Otros';
    if (!acc[fam]) acc[fam] = [];
    acc[fam].push(item);
    return acc;
  }, {});

  const sortedFamilyKeys = Object.keys(groupedFamilies).sort((a, b) => {
    const idxA = familyOrder.indexOf(a);
    const idxB = familyOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const handleAdd = async (payload: MaterialLineaFormPayload) => {
    const result = await addVentanaMaterial(v.id, payload);
    onUpdated(result.data);
    setEditMode(null);
  };

  const handleReplace = async (row: MaterialVentana, payload: MaterialLineaFormPayload) => {
    const result = await reemplazarVentanaMaterial(v.id, {
      materialIdOriginal: row.materialId,
      materialIdNuevo: payload.materialId,
      cantidad: payload.cantidad,
      piezas: payload.piezas,
      acabado: payload.acabado,
    });
    onUpdated(result.data);
    setEditMode(null);
  };

  const handleRemove = async (row: MaterialVentana) => {
    const mensaje = row.reemplazaMaterialId
      ? '¿Deshacer este reemplazo? Vuelve a mostrarse el material HETMO original de esta línea.'
      : '¿Quitar este material de la línea?';
    if (!window.confirm(mensaje)) return;
    setRemoveError(null);
    setRemovingId(row.id);
    try {
      const result = await eliminarVentanaMaterial(v.id, row.id);
      onUpdated(result.data);
    } catch (err: any) {
      setRemoveError(err?.response?.data?.error || err.message || 'Error al quitar el material.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Despiece de Materiales:</span>
              <span className="text-[#E34A26]">{v.modelo}</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Línea #{v.lineaHetmo} · {v.unidades} {v.unidades === 1 ? 'unidad' : 'unidades'} ({formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)} mm)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
            aria-label="Cerrar modal de despiece"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal: 2 Columnas */}
        <div className="overflow-y-auto flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/30">
          {/* COLUMNA IZQUIERDA: Dibujo de la ventana y ficha técnica */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-4">
              {/* Esquema SVG */}
              <div className="bg-[#f8fafc] rounded-xl p-4 flex items-center justify-center border border-slate-100 min-h-[220px]">
                <WindowRendererSvg ventana={v} />
              </div>

              {/* Ficha técnica con dimensiones, apertura y acabado */}
              <div className="space-y-3 pt-1 text-xs">
                {/* Medidas y Área */}
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 text-sm">
                    <Maximize2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)} mm</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end text-sm">
                    <span className="text-slate-400">Área:</span>
                    <span className="font-mono font-bold text-slate-900">{formatNumber(sup, 2)} m²</span>
                  </div>
                </div>

                {/* Apertura */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <DoorClosed className="w-3.5 h-3.5" />
                    <span>Apertura</span>
                  </div>
                  <p className="font-bold text-slate-900 text-xs mt-0.5">
                    {apLabel}
                  </p>
                </div>

                {/* Acabado */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <Paintbrush className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Acabado:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-slate-50 text-slate-800">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-inner shrink-0"
                      style={{ backgroundColor: finish.frame }}
                    />
                    <span>{finishLabel}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Artículos agrupados por categoría (desplegables, cerrados por defecto) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Materiales por Categoría ({mats.length} ítems)
              </h4>
              <button
                onClick={() => setEditMode(editMode?.type === 'add' ? null : { type: 'add' })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#E34A26] bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar material</span>
              </button>
            </div>

            {editMode?.type === 'add' && (
              <MaterialLineaForm title="Agregar material a esta línea" onCancel={() => setEditMode(null)} onConfirm={handleAdd} />
            )}

            {removeError && (
              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">{removeError}</div>
            )}

            {mats.length > 0 ? (
              <div className="space-y-2.5">
                {sortedFamilyKeys.map((fam) => {
                  const items = groupedFamilies[fam];
                  const totalUds = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
                  const badgeStyle = familyBadgeColors[fam] || familyBadgeColors.Otros;

                  return (
                    <details
                      key={fam}
                      open={items.some((it) => editMode?.type === 'replace' && editMode.row.id === it.id)}
                      className="group/fam rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden transition-all"
                    >
                      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-slate-50/80 hover:bg-slate-100/80 select-none transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${badgeStyle}`}>
                            {fam}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="text-[11px] font-mono font-medium">
                            {formatNumber(totalUds, 0)} uds
                          </span>
                          <ChevronDown className="w-4 h-4 transition-transform duration-200 group-open/fam:rotate-180 text-slate-400" />
                        </div>
                      </summary>

                      <div className="p-3 border-t border-slate-100 bg-white">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                                <th className="pb-2 px-2">SKU / Insumo</th>
                                <th className="pb-2 px-2 text-right">Cant. / Longitud</th>
                                <th className="pb-2 px-2 text-center">Acabado</th>
                                <th className="pb-2 px-2 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {items.map((m, idx) => (
                                <React.Fragment key={m.id || idx}>
                                  <tr className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2 px-2 align-top">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-slate-900 font-mono text-[11px]">
                                          {m.material?.skuInterno || '—'}
                                        </span>
                                        {m.origen === 'PERSONALIZADO' && (
                                          <span
                                            className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200"
                                            title={m.reemplazaMaterialId ? 'Reemplaza un material HETMO de esta línea' : 'Agregado manualmente a esta línea'}
                                          >
                                            Manual
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-slate-600 text-[11px] leading-tight">
                                        {m.material?.descripcion || 'Material de fabricación'}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 align-top text-right font-mono whitespace-nowrap">
                                      <div className="font-bold text-slate-800">
                                        {Number(m.cantidad || 1).toLocaleString('es-CL')} un
                                      </div>
                                      {m.longitudMm && (
                                        <div className="text-[10px] text-slate-400">
                                          {Number(m.longitudMm).toLocaleString('es-CL')} mm
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 align-top text-center font-mono text-[11px] whitespace-nowrap">
                                      {m.acabado ? (
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                          {m.acabado}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="py-2 px-2 align-top text-right whitespace-nowrap">
                                      {m.origen === 'HETMO' ? (
                                        <button
                                          onClick={() => setEditMode(editMode?.type === 'replace' && editMode.row.id === m.id ? null : { type: 'replace', row: m })}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 hover:text-[#E34A26] hover:bg-orange-50 transition-colors cursor-pointer"
                                          title="Reemplazar por otro material del maestro"
                                        >
                                          <Repeat className="w-3 h-3" />
                                          <span>Reemplazar</span>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleRemove(m)}
                                          disabled={removingId === m.id}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                                          title={m.reemplazaMaterialId ? 'Deshacer reemplazo' : 'Quitar de la línea'}
                                        >
                                          {removingId === m.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-3 h-3" />
                                          )}
                                          <span>Quitar</span>
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                  {editMode?.type === 'replace' && editMode.row.id === m.id && (
                                    <tr>
                                      <td colSpan={4} className="py-2 px-2">
                                        <MaterialLineaForm
                                          title={`Reemplazar "${m.material?.descripcion || m.material?.skuInterno}"`}
                                          initialCantidad={Number(m.cantidad) || undefined}
                                          onCancel={() => setEditMode(null)}
                                          onConfirm={(payload) => handleReplace(m, payload)}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 text-slate-600 space-y-2 text-xs text-center">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-800">Sin despiece individual</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Esta tipología no registra lista de corte por pieza en esta revisión. El análisis consolidado de insumos está disponible en el Paso 3.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="flex justify-between items-center px-6 py-3.5 border-t border-slate-100 bg-slate-50/70">
          <span className="text-xs text-slate-500 font-medium">
            Total {mats.length} materiales en {sortedFamilyKeys.length} familias
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
