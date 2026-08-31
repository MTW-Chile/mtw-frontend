import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Layers, 
  ArrowUpDown, 
  FileDown, 
  X,
  ChevronDown,
  Maximize2,
  DoorClosed,
  Paintbrush,
  Boxes
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { VentanaCard } from './VentanaCard';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';

interface Step2LineasProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

export const Step2Lineas: React.FC<Step2LineasProps> = ({
  proyecto: _proyecto,
  activeVersion,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'linea' | 'modelo' | 'unidades' | 'superficie'>('linea');
  const [selectedVentanaForMaterials, setSelectedVentanaForMaterials] = useState<Ventana | null>(null);

  const ventanas = useMemo<Ventana[]>(() => activeVersion?.ventanas || [], [activeVersion?.ventanas]);

  // Filtrado y ordenamiento
  const filteredVentanas = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    let result = ventanas.filter((v) => {
      if (!term) return true;
      const matchModelo = v.modelo.toLowerCase().includes(term);
      const matchLinea = String(v.lineaHetmo).includes(term);
      const matchAcabado = (v.acabadoCodigo || '').toLowerCase().includes(term);
      const matchComentario = (v.comentarioPresupuesto || '').toLowerCase().includes(term);
      return matchModelo || matchLinea || matchAcabado || matchComentario;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'linea') return a.lineaHetmo - b.lineaHetmo;
      if (sortBy === 'modelo') return a.modelo.localeCompare(b.modelo, undefined, { numeric: true });
      if (sortBy === 'unidades') return b.unidades - a.unidades;
      if (sortBy === 'superficie') {
        const m2A = a.m2Ventana ?? ((a.anchoMm * a.altoMm) / 1_000_000);
        const m2B = b.m2Ventana ?? ((b.anchoMm * b.altoMm) / 1_000_000);
        return m2B - m2A;
      }
      return 0;
    });

    return result;
  }, [ventanas, searchTerm, sortBy]);

  const totalVentanasFiltradas = filteredVentanas.reduce((acc, v) => acc + v.unidades, 0);
  const totalM2Filtradas = filteredVentanas.reduce((acc, v) => {
    const m2 = v.m2Ventana ?? ((v.anchoMm * v.altoMm) / 1_000_000);
    return acc + m2 * v.unidades;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra de Control, Búsqueda y Filtros */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Revisión Técnica de Líneas y Tipologías
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-slate-100 border border-slate-300 text-slate-700">
                {filteredVentanas.length} de {ventanas.length} modelos
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {totalVentanasFiltradas} ventanas totales · {formatNumber(totalM2Filtradas, 2)} m² de superficie
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Buscador */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por modelo, acabado o comentario..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#E34A26] focus:bg-white transition-colors"
            />
          </div>

          {/* Ordenar */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="linea">Nº Línea</option>
              <option value="modelo">Modelo</option>
              <option value="unidades">Cantidad Uds</option>
              <option value="superficie">Superficie m²</option>
            </select>
          </div>

          {/* Exportar Catálogo PDF */}
          <button
            onClick={() => alert('La exportación de catálogo técnico en PDF se configurará con las especificaciones detalladas.')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Exportar Catálogo Técnico en PDF"
          >
            <FileDown className="w-4 h-4 text-[#E34A26]" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Ventana con Esquemas Vectoriales */}
      {filteredVentanas.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <p className="text-xs text-slate-500">No se encontraron líneas que coincidan con el criterio de búsqueda.</p>
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs font-bold text-[#E34A26] hover:underline cursor-pointer"
          >
            Limpiar filtro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVentanas.map((v) => (
            <VentanaCard
              key={v.id}
              ventana={v}
              monedaSimbolo={activeVersion?.monedaSimbolo || '$'}
              onOpenMaterials={(ventana) => setSelectedVentanaForMaterials(ventana)}
            />
          ))}
        </div>
      )}

      {/* Modal: Revisión de Materiales Individual de la Ventana (2 Columnas) */}
      {selectedVentanaForMaterials && (() => {
        const v = selectedVentanaForMaterials;
        const sup = v.m2Ventana ?? ((v.anchoMm * v.altoMm) / 1_000_000);
        const wLine = toWindowLine(v);
        const finish = createFinish(wLine?.acabadoCodigo, wLine?.acabadoDescripcion, wLine?.acabadoPatron);
        const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
        const apLabel = wLine ? core.apertureLabel(wLine) : v.modelo || '—';

        // Agrupar materiales por familia
        const mats = v.materiales || [];
        const groupedFamilies = mats.reduce<Record<string, typeof mats>>((acc, item) => {
          const fam = item.material?.familia || 'Otros';
          if (!acc[fam]) acc[fam] = [];
          acc[fam].push(item);
          return acc;
        }, {});

        const familyOrder = ['Perfileria', 'Herrajes', 'Juntas', 'Vidrios', 'Refuerzos', 'Superficies', 'Accesorios', 'Otros'];
        const sortedFamilyKeys = Object.keys(groupedFamilies).sort((a, b) => {
          const idxA = familyOrder.indexOf(a);
          const idxB = familyOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });

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
                {/* Botón Cerrar como icono X */}
                <button
                  onClick={() => setSelectedVentanaForMaterials(null)}
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
                    <span className="text-[11px] text-slate-400">
                      {sortedFamilyKeys.length} familias
                    </span>
                  </div>

                  {mats.length > 0 ? (
                    <div className="space-y-2.5">
                      {sortedFamilyKeys.map((fam) => {
                        const items = groupedFamilies[fam];
                        const totalUds = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
                        const badgeStyle = familyBadgeColors[fam] || familyBadgeColors.Otros;

                        return (
                          <details
                            key={fam}
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
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {items.map((m, idx) => (
                                      <tr key={m.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2 px-2 align-top">
                                          <div className="font-semibold text-slate-900 font-mono text-[11px]">
                                            {m.material?.skuInterno || '—'}
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
                                      </tr>
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
                  onClick={() => setSelectedVentanaForMaterials(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

