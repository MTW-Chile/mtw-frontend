import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Layers,
  ArrowUpDown,
  FileDown,
  Loader2,
  Plus,
  X,
  ChevronDown
} from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import { renderPdf, eliminarLineaManual, espejarVentana, invertirOrdenPanelesVentana } from '../../../../api/client';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { VentanaCard } from './VentanaCard';
import { CorrectorCorrederaModal } from './CorrectorCorrederaModal';
import { MaterialesLineaModal } from './MaterialesLineaModal';
import { AgregarLineaManualModal } from './AgregarLineaManualModal';
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
  const [showAgregarLinea, setShowAgregarLinea] = useState(false);
  const [eliminandoLineaId, setEliminandoLineaId] = useState<string | null>(null);
  const [espejandoLineaId, setEspejandoLineaId] = useState<string | null>(null);
  const [invirtiendoOrdenLineaId, setInvirtiendoOrdenLineaId] = useState<string | null>(null);

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

  const handleEliminarLineaManual = async (ventana: Ventana) => {
    if (!window.confirm(`¿Quitar la línea "${ventana.modelo}"? Esta acción no se puede deshacer.`)) return;
    setEliminandoLineaId(ventana.id);
    try {
      await eliminarLineaManual(ventana.id);
      if (proyecto?.id) {
        queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
      }
    } catch (err) {
      window.alert('No se pudo quitar la línea. Intenta de nuevo.');
    } finally {
      setEliminandoLineaId(null);
    }
  };

  const handleEspejarVentana = async (ventana: Ventana) => {
    setEspejandoLineaId(ventana.id);
    try {
      const { data } = await espejarVentana(ventana.id);
      handleVentanaMaterialesUpdated(data);
    } catch (err) {
      window.alert('No se pudo espejar la ventana. Intenta de nuevo.');
    } finally {
      setEspejandoLineaId(null);
    }
  };

  const handleInvertirOrdenVentana = async (ventana: Ventana) => {
    setInvirtiendoOrdenLineaId(ventana.id);
    try {
      const { data } = await invertirOrdenPanelesVentana(ventana.id);
      handleVentanaMaterialesUpdated(data);
    } catch (err) {
      window.alert('No se pudo invertir el orden de la ventana. Intenta de nuevo.');
    } finally {
      setInvirtiendoOrdenLineaId(null);
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
      <div className="p-4 sm:p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
        {/* Fila Superior: Encabezado y Acciones Principales */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-600/10 text-brand-600 border border-brand-600/20 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Catálogo Técnico de Obra
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-base font-bold text-slate-900 truncate">
                  Revisión Técnica de Líneas y Tipologías
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0 whitespace-nowrap">
                  {filteredVentanas.length} de {ventanas.length} modelos
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {totalVentanasFiltradas} ventanas totales · <strong className="font-mono text-slate-700">{formatNumber(totalM2Filtradas, 2)} m²</strong> de superficie
              </p>
            </div>
          </div>

          {/* Botones de Acción Primaria */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={exportarCatalogoPDF}
              disabled={isExportingCatalogo || !filteredVentanas.length}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-semibold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar Catálogo Técnico en PDF"
            >
              {isExportingCatalogo ? (
                <Loader2 className="w-3.5 h-3.5 text-brand-600 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isExportingCatalogo ? 'Generando…' : 'Exportar PDF'}</span>
            </button>

            {activeVersion && (
              <button
                onClick={() => setShowAgregarLinea(true)}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm shadow-brand-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Agregar una línea que no viene de HETMO"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Línea</span>
              </button>
            )}
          </div>
        </div>

        {/* Fila Inferior: Buscador y Filtro de Orden */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por modelo, acabado o comentario..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Orden */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:inline">
              Ordenar:
            </span>
            <div className="relative w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto pl-8 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-brand-600 cursor-pointer appearance-none"
              >
                <option value="linea">Nº Línea (Hetmo)</option>
                <option value="modelo">Modelo</option>
                <option value="unidades">Cantidad Uds</option>
                <option value="superficie">Superficie m²</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
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
            className="text-xs font-bold text-brand-600 hover:underline cursor-pointer"
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
              onDeleteLineaManual={handleEliminarLineaManual}
              isDeletingLineaManual={eliminandoLineaId === v.id}
              onEspejar={handleEspejarVentana}
              isEspejando={espejandoLineaId === v.id}
              onInvertirOrden={handleInvertirOrdenVentana}
              isInvirtiendoOrden={invirtiendoOrdenLineaId === v.id}
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

      {/* Modal: Agregar Línea Manual */}
      {showAgregarLinea && activeVersion && (
        <AgregarLineaManualModal
          versionId={activeVersion.id}
          proyectoId={proyecto.id}
          onClose={() => setShowAgregarLinea(false)}
          onCreated={() => setShowAgregarLinea(false)}
        />
      )}
    </div>
  );
};


