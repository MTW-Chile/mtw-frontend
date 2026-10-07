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

  const metricas = [
    {
      id: 'ventanas',
      label: 'Total Ventanas',
      sublabel: 'Unidades presupuestadas',
      value: String(totalVentanas),
      unit: 'uds',
      icon: Layers,
      iconColor: 'bg-blue-50 text-blue-600 border-blue-100',
      highlight: false,
    },
    {
      id: 'm2-ventanas',
      label: 'Superficie Ventanas',
      sublabel: 'Área total de aberturas',
      value: formatNumber(totalM2Ventanas, 2),
      unit: 'm²',
      icon: Ruler,
      iconColor: 'bg-brand-600/10 text-brand-600 border-brand-600/20',
      highlight: false,
    },
    {
      id: 'm2-vidrios',
      label: 'Superficie Vidrios',
      sublabel: 'Aprox. 82% de superficie',
      value: formatNumber(totalM2Vidrios, 2),
      unit: 'm²',
      icon: Maximize2,
      iconColor: 'bg-cyan-50 text-cyan-600 border-cyan-100',
      highlight: false,
    },
    {
      id: 'tipologias',
      label: 'Tipologías Únicas',
      sublabel: 'Modelos cargados',
      value: String(tipologiasDistintas),
      unit: 'modelos',
      icon: Hash,
      iconColor: 'bg-purple-50 text-purple-600 border-purple-100',
      highlight: false,
    },
    {
      id: 'panos',
      label: 'Paños / Hojas Totales',
      sublabel: 'Marcos y hojas soldadas',
      value: String(totalCuadrosHojas),
      unit: 'hojas',
      icon: SquareDot,
      iconColor: 'bg-amber-50 text-amber-600 border-amber-100',
      highlight: false,
    },
    {
      id: 'promedio',
      label: 'Promedio / Ventana',
      sublabel: 'Superficie media por unidad',
      value: formatNumber(promedioM2PorVentana, 2),
      unit: 'm²/ud',
      icon: Ruler,
      iconColor: 'bg-teal-50 text-teal-600 border-teal-100',
      highlight: false,
    },
    {
      id: 'materiales',
      label: 'Materiales Base',
      sublabel: 'Insumos de fábrica calculados',
      value: String(totalMateriales),
      unit: 'artículos',
      icon: Boxes,
      iconColor: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      highlight: false,
    },
    {
      id: 'importe',
      label: 'Importe Base HETMO',
      sublabel: 'Costo base exportado',
      value: `${moneda} ${formatNumber(importeBase, 0)}`,
      unit: '',
      icon: DollarSign,
      iconColor: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      highlight: true,
    },
  ];

  return (
    <div className="p-4 sm:p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-600/10 text-brand-600 border border-brand-600/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Resumen Técnico de Obra
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              Indicadores Técnicos y Métricos de la Obra
            </h3>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
          Rev {activeVersion?.versionNumero || 1} · {tipologiasDistintas} tipologías
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {metricas.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className="py-2.5 sm:py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0 hover:bg-slate-50/70 rounded-xl px-2.5 -mx-2.5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center shrink-0 ${m.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                    {m.label}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                    {m.sublabel}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm sm:text-base font-bold font-mono ${m.highlight ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {m.value}
                </span>
                {m.unit && (
                  <span className="ml-1 text-[10px] sm:text-xs font-normal text-slate-500">
                    {m.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
