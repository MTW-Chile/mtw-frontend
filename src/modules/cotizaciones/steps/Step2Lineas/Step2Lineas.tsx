import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Layers, 
  ArrowUpDown, 
  FileDown, 
  Info 
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { VentanaCard } from './VentanaCard';

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
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
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
            className="text-xs font-bold text-[#E34A26] hover:underline"
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

      {/* Modal Informativo: Revisión de Materiales Individual (Pendiente) */}
      {selectedVentanaForMaterials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Despiece de Materiales: {selectedVentanaForMaterials.modelo}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Línea #{selectedVentanaForMaterials.lineaHetmo} · {selectedVentanaForMaterials.unidades} unidades
                </span>
              </div>
              <button
                onClick={() => setSelectedVentanaForMaterials(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 flex items-start gap-2.5 text-xs">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p>
                La revisión de materiales individual categorizada por ventana se encuentra en desarrollo. El análisis global consolidado de insumos está disponible en el <strong>Paso 3: Analítica de Materiales</strong>.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedVentanaForMaterials(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
