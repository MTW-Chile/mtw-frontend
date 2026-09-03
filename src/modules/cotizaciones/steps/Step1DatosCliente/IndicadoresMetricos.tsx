import React from 'react';
import { 
  Layers, 
  Ruler, 
  Boxes, 
  DollarSign, 
  Sparkles, 
  Maximize2, 
  SquareDot, 
  Hash 
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { ProyectoVersion, Ventana } from '../../../../types';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { cuadrosFor } from '../../components/drawing/geometryCore';

interface IndicadoresMetricosProps {
  activeVersion?: ProyectoVersion;
}

export const IndicadoresMetricos: React.FC<IndicadoresMetricosProps> = ({ activeVersion }) => {
  const ventanas: Ventana[] = activeVersion?.ventanas || [];
  
  const totalVentanas = activeVersion?.totalVentanas || ventanas.reduce((acc, v) => acc + (v.unidades || 1), 0);
  const totalM2Ventanas = activeVersion?.totalM2Ventanas || ventanas.reduce((acc, v) => {
    const m2 = v.m2Ventana ?? ((v.anchoMm * v.altoMm) / 1_000_000);
    return acc + m2 * (v.unidades || 1);
  }, 0);
  
  const tipologiasDistintas = new Set(ventanas.map((v) => v.modelo.trim().toUpperCase())).size;
  const promedioM2PorVentana = totalVentanas > 0 ? totalM2Ventanas / totalVentanas : 0;
  
  // Estimación de m2 de vidrios (aprox. 82% de superficie o paños)
  const totalM2Vidrios = totalM2Ventanas * 0.82;
  
  // Total de cuadros (marcos de PVC soldados, ver cuadrosFor en geometryCore.ts)
  const totalCuadrosHojas = ventanas.reduce((acc, v) => {
    const line = toWindowLine(v);
    const count = line ? cuadrosFor(line) : 0;
    return acc + count * (v.unidades || 1);
  }, 0);

  const totalMateriales = activeVersion?.totalMateriales || 0;
  const importeBase = activeVersion?.importeTotal || 0;
  const moneda = activeVersion?.monedaSimbolo || '$';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#E34A26]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Indicadores Técnicos y Métricos de la Obra
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Revisión v{activeVersion?.versionNumero || 1} · {tipologiasDistintas} tipologías cargadas
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Cantidad de Ventanas */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Ventanas</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {totalVentanas} <span className="text-xs font-normal text-slate-500">uds</span>
            </div>
          </div>
        </div>

        {/* Superficie Total Ventanas */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Superficie Ventanas</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {formatNumber(totalM2Ventanas, 2)} <span className="text-xs font-normal text-slate-500">m²</span>
            </div>
          </div>
        </div>

        {/* Superficie Estimada Vidrios */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 flex items-center justify-center shrink-0">
            <Maximize2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Superficie Vidrios</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {formatNumber(totalM2Vidrios, 2)} <span className="text-xs font-normal text-slate-500">m²</span>
            </div>
          </div>
        </div>

        {/* Tipologías Únicas */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tipologías Únicas</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {tipologiasDistintas} <span className="text-xs font-normal text-slate-500">modelos</span>
            </div>
          </div>
        </div>

        {/* Cantidad Total de Paños / Hojas */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <SquareDot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Paños / Hojas Totales</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {totalCuadrosHojas} <span className="text-xs font-normal text-slate-500">hojas</span>
            </div>
          </div>
        </div>

        {/* Promedio m2 por Ventana */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Promedio / Ventana</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {formatNumber(promedioM2PorVentana, 2)} <span className="text-xs font-normal text-slate-500">m²/ud</span>
            </div>
          </div>
        </div>

        {/* Materiales Base de Fábrica */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Materiales Base</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {totalMateriales} <span className="text-xs font-normal text-slate-500">artículos</span>
            </div>
          </div>
        </div>

        {/* Importe Base HETMO */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Importe Base HETMO</div>
            <div className="text-lg font-bold font-mono text-emerald-600">
              {moneda} {formatNumber(importeBase, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
