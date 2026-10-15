import React from 'react';
import { 
  Layers, 
  Ruler, 
  Boxes, 
  Sparkles, 
  Maximize2, 
  SquareDot,
  Square,
  Hash 
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { ProyectoVersion, Ventana } from '../../../../types';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { marcosFor, vidriosFor } from '../../components/drawing/geometryCore';

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
  
  // Marcos de PVC soldados y vidrios individuales (ver marcosFor / vidriosFor en geometryCore.ts)
  const { totalMarcos, totalVidrios } = ventanas.reduce(
    (acc, v) => {
      const line = toWindowLine(v);
      const uds = v.unidades || 1;
      acc.totalMarcos += (line ? marcosFor(line) : 0) * uds;
      acc.totalVidrios += (line ? vidriosFor(line) : 0) * uds;
      return acc;
    },
    { totalMarcos: 0, totalVidrios: 0 }
  );

  const totalMateriales = activeVersion?.totalMateriales || 0;

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
      id: 'marcos',
      label: 'Marcos',
      sublabel: 'Cuadros de PVC soldados',
      value: String(totalMarcos),
      unit: 'marcos',
      icon: SquareDot,
      iconColor: 'bg-amber-50 text-amber-600 border-amber-100',
      highlight: false,
    },
    {
      id: 'vidrios',
      label: 'Vidrios',
      sublabel: 'Paños de vidrio individuales',
      value: String(totalVidrios),
      unit: 'vidrios',
      icon: Square,
      iconColor: 'bg-sky-50 text-sky-600 border-sky-100',
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
  ];

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Resumen técnico de obra</div>
            <h2 className="text-base font-extrabold text-slate-900">Indicadores técnicos y métricos</h2>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
          Rev {activeVersion?.versionNumero || 1} · {tipologiasDistintas} tipologías
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metricas.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${m.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">{m.label}</div>
                <div className="text-lg font-extrabold text-slate-900 leading-none whitespace-nowrap">
                  {m.value}
                  {m.unit && <span className="ml-1 text-xs font-semibold text-slate-500">{m.unit}</span>}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate" title={m.sublabel}>{m.sublabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
