import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Layers,
  ArrowUpDown,
  FileDown,
  Loader2
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import { renderPdf } from '../../../../api/client';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { VentanaCard } from './VentanaCard';
import { CorrectorCorrederaModal } from './CorrectorCorrederaModal';
import { MaterialesLineaModal } from './MaterialesLineaModal';
import { buildCatalogoHtml, rasterizarDibujos } from './catalogoPdf';

interface Step2LineasProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

export const Step2Lineas: React.FC<Step2LineasProps> = ({
  proyecto,
  activeVersion,
}) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'linea' | 'modelo' | 'unidades' | 'superficie'>('linea');
  const [selectedVentanaIdForMaterials, setSelectedVentanaIdForMaterials] = useState<string | null>(null);
  const [selectedVentanaForCorrector, setSelectedVentanaForCorrector] = useState<Ventana | null>(null);
  const [ventanasOverrides, setVentanasOverrides] = useState<Record<string, Ventana>>({});

  const ventanas = useMemo<Ventana[]>(() => {
    const list = activeVersion?.ventanas || [];
    return list.map((v) => ventanasOverrides[v.id] || v);
  }, [activeVersion?.ventanas, ventanasOverrides]);

  // Deriva el objeto fresco desde `ventanas` (ya trae los overrides
  // aplicados) en vez de guardar una copia propia: así, cuando el modal edita
  // sus materiales, el override que actualiza este mismo estado alcanza al
  // modal sin necesidad de sincronizar dos copias a mano.
  const selectedVentanaForMaterials = useMemo(
    () => ventanas.find((v) => v.id === selectedVentanaIdForMaterials) || null,
    [ventanas, selectedVentanaIdForMaterials]
  );

  const handleVentanaMaterialesUpdated = (updated: Ventana) => {
    setVentanasOverrides((prev) => ({ ...prev, [updated.id]: updated }));
    if (proyecto?.id) {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    }
  };

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

  const [isExportingCatalogo, setIsExportingCatalogo] = useState(false);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);

  const exportarCatalogoPDF = async () => {
    if (!filteredVentanas.length) return;
    setCatalogoError(null);
    setIsExportingCatalogo(true);
    try {
      // Mismo pipeline de rasterizado que el PDF del Presupuesto (Paso 5):
      // recorta cada SVG a su bounding box real y lo convierte a PNG antes
      // de mandarlo al servidor, así Chromium no depende de que el dibujo
      // haya terminado de pintar a tiempo.
      const pngPorVentana = await rasterizarDibujos(filteredVentanas);
      const html = buildCatalogoHtml(proyecto, filteredVentanas, pngPorVentana);
      const filename = `catalogo-tecnico-${(proyecto.codigoInterno || proyecto.obra).replace(/\s+/g, '-')}.pdf`;
      const blob = await renderPdf(html, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setCatalogoError(err?.response?.data?.error || err.message || 'Error al generar el catálogo en PDF.');
    } finally {
      setIsExportingCatalogo(false);
    }
  };

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
            onClick={exportarCatalogoPDF}
            disabled={isExportingCatalogo || !filteredVentanas.length}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportar Catálogo Técnico en PDF"
          >
            {isExportingCatalogo ? (
              <Loader2 className="w-4 h-4 text-[#E34A26] animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 text-[#E34A26]" />
            )}
            <span className="hidden sm:inline">{isExportingCatalogo ? 'Generando…' : 'Exportar PDF'}</span>
          </button>
        </div>
      </div>

      {catalogoError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {catalogoError}
        </div>
      )}

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
              onOpenMaterials={(ventana) => setSelectedVentanaIdForMaterials(ventana.id)}
              onEditCorredera={(ventana) => setSelectedVentanaForCorrector(ventana)}
            />
          ))}
        </div>
      )}

      {/* Modal: Revisión de Materiales Individual de la Ventana */}
      {selectedVentanaForMaterials && (
        <MaterialesLineaModal
          key={selectedVentanaForMaterials.id}
          ventana={selectedVentanaForMaterials}
          isOpen={Boolean(selectedVentanaForMaterials)}
          onClose={() => setSelectedVentanaIdForMaterials(null)}
          onUpdated={handleVentanaMaterialesUpdated}
        />
      )}

      {/* Modal: Corrector Interactivo de Correderas */}
      {selectedVentanaForCorrector && (
        <CorrectorCorrederaModal
          key={selectedVentanaForCorrector.id}
          ventana={selectedVentanaForCorrector}
          isOpen={Boolean(selectedVentanaForCorrector)}
          onClose={() => setSelectedVentanaForCorrector(null)}
          onSaved={(updated) => {
            setVentanasOverrides((prev) => ({ ...prev, [updated.id]: updated }));
            if (proyecto?.id) {
              queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
            }
            setSelectedVentanaForCorrector(null);
          }}
        />
      )}
    </div>
  );
};


