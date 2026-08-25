import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Ventana, ProyectoVersion } from '../../../../types';

interface TipologiasPreviewTableProps {
  ventanas: Ventana[];
  activeVersion?: ProyectoVersion;
}

export const TipologiasPreviewTable: React.FC<TipologiasPreviewTableProps> = ({
  ventanas,
  activeVersion,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
          <FileSpreadsheet className="w-4 h-4 text-[#E34A26]" />
          <span>3. Tipologías Importadas de Fábrica ({ventanas.length} modelos)</span>
        </div>
        <span className="text-xs text-slate-500">
          Total: <strong className="font-mono text-slate-900">{activeVersion?.totalVentanas || 0} ventanas</strong>
        </span>
      </div>

      <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-wider sticky top-0 text-slate-600">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Línea</th>
              <th className="px-4 py-2.5 font-semibold">Modelo</th>
              <th className="px-4 py-2.5 font-semibold text-center">Uds</th>
              <th className="px-4 py-2.5 font-semibold text-right">Dimensiones (mm)</th>
              <th className="px-4 py-2.5 font-semibold text-right">Superficie (m²)</th>
              <th className="px-4 py-2.5 font-semibold">Acabado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {ventanas.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-slate-500">#{v.lineaHetmo}</td>
                <td className="px-4 py-2.5 font-semibold text-slate-900">{v.modelo}</td>
                <td className="px-4 py-2.5 text-center font-bold text-[#E34A26]">{v.unidades}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                  {formatNumber(v.m2Ventana, 2)}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{v.acabadoCodigo || 'Estándar'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
