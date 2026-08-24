import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Building2, 
  Ruler, 
  Layers, 
  DollarSign, 
  Boxes
} from 'lucide-react';
import { getProyectoById } from '../../api/client';
import { formatNumber } from '../../lib/utils';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0E131F] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  {proyecto?.obra || 'Cargando Obra...'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-300 font-mono">
                  {proyecto?.codigoInterno || `PRJ-${proyecto?.numeroPresupuesto}`}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cliente: <span className="text-slate-200">{proyecto?.clienteNombreRaw}</span>
                {proyecto?.clienteRutRaw && <span className="ml-2 font-mono text-slate-400">({proyecto.clienteRutRaw})</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs">Cargando desglose de ventanas y cotas...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Version Selector & Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Version Picker */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Versión HETMO</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {proyecto?.versiones.map((v, idx) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersionIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedVersionIdx === idx
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      v{v.versionNumero}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-400">
                  Estado: <span className="text-emerald-400 font-medium">{version?.estadoGlosa || 'Terminado'}</span>
                </div>
              </div>

              {/* Superficie Total */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-blue-400" />
                  <span>Superficie Total</span>
                </div>
                <div className="text-2xl font-bold text-slate-100">
                  {formatNumber(version?.totalM2Ventanas, 2)} <span className="text-xs font-normal text-slate-400">m²</span>
                </div>
                <div className="text-[10px] text-slate-400">Calculado sobre paños reales</div>
              </div>

              {/* Cantidad Ventanas */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ventanas Físicas</span>
                </div>
                <div className="text-2xl font-bold text-slate-100">
                  {ventanas.length} <span className="text-xs font-normal text-slate-400">unidades</span>
                </div>
                <div className="text-[10px] text-slate-400">Desglose individual en tabla</div>
              </div>

              {/* Moneda / Monto */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Moneda Base</span>
                </div>
                <div className="text-lg font-bold text-slate-100 truncate">
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
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span>Despiece de Ventanas y Paños</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/40 font-mono">
                    {ventanas.length} ventanas
                  </span>
                </h3>
              </div>

              <div className="overflow-x-auto border border-white/10 rounded-xl bg-slate-900/30">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Línea</th>
                      <th className="px-4 py-3 font-semibold">Modelo / Tipología</th>
                      <th className="px-4 py-3 font-semibold">Dimensiones (Ancho × Alto)</th>
                      <th className="px-4 py-3 font-semibold text-center">Uds</th>
                      <th className="px-4 py-3 font-semibold text-right">Superficie (m²)</th>
                      <th className="px-4 py-3 font-semibold text-center">Geometría</th>
                      <th className="px-4 py-3 font-semibold">Comentarios</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ventanas.map((v, i) => (
                      <tr key={v.id || i} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-400">
                          #{v.orden || i + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                            <span>{v.modelo}</span>
                          </div>
                          {v.descripcionCorta && (
                            <span className="text-[10px] text-slate-400 ml-4 block">{v.descripcionCorta}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-cyan-300 font-semibold">
                          {formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)} <span className="text-[10px] text-slate-400 font-normal">mm</span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-200">
                          {v.unidades}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-200 font-semibold">
                          {formatNumber(v.m2Ventana, 2)} m²
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 border border-white/5">
                            {v.geometrias?.length || 0} cotas 2D
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 max-w-xs truncate text-[11px]">
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
        <div className="px-6 py-3 border-t border-white/[0.08] bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div>ID HETMO: <span className="font-mono text-slate-300 font-semibold">{version?.hetmoId}</span></div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};