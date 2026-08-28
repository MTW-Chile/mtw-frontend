import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Building2,
  Ruler,
  Layers,
  DollarSign,
  Boxes,
} from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Ventana } from '../../types';

export const CotizacionDetalleModal: React.FC<{
  proyectoId: string | null;
  onClose: () => void;
}> = ({ proyectoId, onClose }) => {
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId!),
    enabled: !!proyectoId,
  });

  if (!proyectoId) return null;

  const version = proyecto?.versiones[selectedVersionIdx] || proyecto?.versiones[0];
  const ventanas: Ventana[] = version?.ventanas || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full sm:max-w-5xl max-h-[94vh] sm:max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900 line-clamp-1">
                  {proyecto?.obra || 'Cargando Obra...'}
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold">
                  {proyecto?.codigoInterno || `PRJ-${proyecto?.numeroPresupuesto}`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cliente: <span className="text-slate-800 font-semibold">{proyecto?.clienteNombreRaw}</span>
                {proyecto?.clienteRutRaw && (
                  <span className="ml-1.5 font-mono text-slate-400">({proyecto.clienteRutRaw})</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-2 border-[#E34A26] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-mono">Cargando desglose de ventanas y cotas...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Version Selector & Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Version Picker */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#E34A26]" />
                  <span>Versión HETMO</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {proyecto?.versiones.map((v, idx) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersionIdx(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedVersionIdx === idx
                          ? 'bg-[#E34A26] text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      v{v.versionNumero}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500">
                  Estado:{' '}
                  <span className="text-emerald-700 font-bold">
                    {version?.estadoGlosa || 'Terminado'}
                  </span>
                </div>
              </div>

              {/* Superficie Total */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-sky-600" />
                  <span>Superficie Total</span>
                </div>
                <div className="text-xl font-black font-mono text-slate-900">
                  {formatNumber(version?.totalM2Ventanas, 2)}{' '}
                  <span className="text-xs font-normal text-slate-500 font-sans">m²</span>
                </div>
                <div className="text-[10px] text-slate-400">Calculado sobre paños reales</div>
              </div>

              {/* Cantidad Ventanas */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ventanas Físicas</span>
                </div>
                <div className="text-xl font-black font-mono text-slate-900">
                  {ventanas.length}{' '}
                  <span className="text-xs font-normal text-slate-500 font-sans">unidades</span>
                </div>
                <div className="text-[10px] text-slate-400">Total elementos presupuestados</div>
              </div>

              {/* Moneda / Monto */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Moneda Base</span>
                </div>
                <div className="text-lg font-black text-slate-900 truncate">
                  {version?.monedaDescripcion || 'UF'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  TC: {version?.tipoCambio || '1.0'}
                </div>
              </div>
            </div>

            {/* Matrix of Windows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span>Despiece de Ventanas y Paños</span>
                  <Badge variant="brand" size="sm">
                    {ventanas.length} ventanas
                  </Badge>
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Línea</th>
                      <th className="px-4 py-3">Modelo / Tipología</th>
                      <th className="px-4 py-3">Dimensiones (Ancho × Alto)</th>
                      <th className="px-4 py-3 text-center">Uds</th>
                      <th className="px-4 py-3 text-right">Superficie (m²)</th>
                      <th className="px-4 py-3 text-center">Geometría</th>
                      <th className="px-4 py-3">Comentarios</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ventanas.map((v, i) => (
                      <tr key={v.id || i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-500">
                          #{v.orden || i + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div>{v.modelo}</div>
                          {v.descripcionCorta && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {v.descripcionCorta}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[#E34A26] font-bold">
                          {formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">mm</span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {v.unidades}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {formatNumber(v.m2Ventana, 2)} m²
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-700 border border-slate-200">
                            {v.geometrias?.length || 0} cotas 2D
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate text-[11px]">
                          {v.comentarioPresupuesto || v.comentarioFabricacion || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="text-[11px] font-mono">
            ID HETMO: <strong className="text-slate-800">{version?.hetmoId}</strong>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar Ficha
          </Button>
        </div>
      </div>
    </div>
  );
};