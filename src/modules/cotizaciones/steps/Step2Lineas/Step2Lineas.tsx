import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Layers, FileDown, Loader2, Plus } from 'lucide-react';
import { formatNumber } from '../../../../lib/utils';
import { renderPdf, eliminarLineaManual, espejarVentana, invertirOrdenPanelesVentana } from '../../../../api/client';
import type { Proyecto, ProyectoVersion, Ventana } from '../../../../types';
import { VentanaCard } from './VentanaCard';
import { EditarLineaModal } from './EditarLineaModal';
import { AgregarLineaManualModal } from './AgregarLineaManualModal';
import { guardarCorreccionDibujo } from './correccionDibujo';
import { buildCatalogoHtml, rasterizarDibujos } from './catalogoPdf';
import { Button } from '../../../../components/ui/Button';
import { Paginacion, paginar } from '../../../../components/ui/Paginacion';
import { Buscador } from '../../../../components/ui/Buscador';
import { Select } from '../../../../components/ui/Select';
import { Aviso } from '../../../../components/ui/Aviso';
import { useConfirmar } from '../../../../components/ui/Confirmar';
import { mostrarToast } from '../../../../lib/toast';

interface Step2LineasProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

export const Step2Lineas: React.FC<Step2LineasProps> = ({
  proyecto,
  activeVersion,
}) => {
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'linea' | 'modelo' | 'unidades' | 'superficie'>('linea');
  const [selectedVentanaIdForEdicion, setSelectedVentanaIdForEdicion] = useState<string | null>(null);
  const [ventanasOverrides, setVentanasOverrides] = useState<Record<string, Ventana>>({});
  const [showAgregarLinea, setShowAgregarLinea] = useState(false);
  const [eliminandoLineaId, setEliminandoLineaId] = useState<string | null>(null);
  const [espejandoLineaId, setEspejandoLineaId] = useState<string | null>(null);
  const [invirtiendoOrdenLineaId, setInvirtiendoOrdenLineaId] = useState<string | null>(null);
  const [invirtiendoManoLineaId, setInvirtiendoManoLineaId] = useState<string | null>(null);

  const ventanas = useMemo<Ventana[]>(() => {
    const list = activeVersion?.ventanas || [];
    return list.map((v) => ventanasOverrides[v.id] || v);
  }, [activeVersion?.ventanas, ventanasOverrides]);

  // Deriva el objeto fresco desde `ventanas` (ya trae los overrides
  // aplicados) en vez de guardar una copia propia: así, cuando el modal edita
  // sus materiales, el override que actualiza este mismo estado alcanza al
  // modal sin necesidad de sincronizar dos copias a mano.
  const selectedVentanaForEdicion = useMemo(
    () => ventanas.find((v) => v.id === selectedVentanaIdForEdicion) || null,
    [ventanas, selectedVentanaIdForEdicion]
  );

  const handleVentanaMaterialesUpdated = (updated: Ventana) => {
    setVentanasOverrides((prev) => ({ ...prev, [updated.id]: updated }));
    if (proyecto?.id) {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    }
  };

  const handleEliminarLineaManual = async (ventana: Ventana) => {
    const ok = await confirmar({ titulo: `¿Quitar la línea "${ventana.modelo}"?`, mensaje: 'Esta acción no se puede deshacer.', confirmar: 'Quitar', peligro: true });
    if (!ok) return;
    setEliminandoLineaId(ventana.id);
    try {
      await eliminarLineaManual(ventana.id);
      if (proyecto?.id) {
        queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
      }
    } catch (err) {
      mostrarToast('No se pudo quitar la línea. Intenta de nuevo.');
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
      mostrarToast('No se pudo espejar la ventana. Intenta de nuevo.');
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
      mostrarToast('No se pudo invertir el orden de la ventana. Intenta de nuevo.');
    } finally {
      setInvirtiendoOrdenLineaId(null);
    }
  };

  const handleInvertirManoVentana = async (ventana: Ventana) => {
    setInvirtiendoManoLineaId(ventana.id);
    try {
      const updated = await guardarCorreccionDibujo(ventana, {
        invertirMano: !ventana.correccionGeometria?.invertirMano,
      });
      handleVentanaMaterialesUpdated(updated);
    } catch (err) {
      mostrarToast('No se pudo invertir la mano de la apertura. Intenta de nuevo.');
    } finally {
      setInvirtiendoManoLineaId(null);
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

  // Paginación: 15 por página por defecto; 0 = todas. Vuelve a la página 1 al buscar u ordenar.
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(15);
  useEffect(() => setPagina(1), [searchTerm, sortBy]);
  const { visibles: ventanasPagina, paginaEfectiva } = useMemo(
    () => paginar(filteredVentanas, pagina, porPagina),
    [filteredVentanas, pagina, porPagina]
  );

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
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      {/* Encabezado, acciones y búsqueda */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Catálogo técnico de obra</div>
              <h2 className="text-base font-extrabold text-slate-900">Revisión técnica de líneas</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {filteredVentanas.length} de {ventanas.length} líneas · {totalVentanasFiltradas} ventanas ·{' '}
                <strong className="text-slate-700">{formatNumber(totalM2Filtradas, 2)} m²</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={exportarCatalogoPDF}
              disabled={isExportingCatalogo || !filteredVentanas.length}
              leftIcon={isExportingCatalogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              title="Exportar Catálogo Técnico en PDF"
            >
              {isExportingCatalogo ? 'Generando…' : 'Exportar PDF'}
            </Button>
            {activeVersion && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAgregarLinea(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                title="Agregar una línea que no viene de HETMO"
              >
                Agregar línea
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 pt-5 border-t border-slate-100">
          <Buscador valor={searchTerm} onChange={setSearchTerm} placeholder="Buscar por modelo, acabado o comentario…" />

          <div className="sm:w-64">
            <Select
              aria-label="Ordenar líneas"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              options={[
                { value: 'linea', label: 'Orden: Nº línea (HETMO)' },
                { value: 'modelo', label: 'Orden: Modelo' },
                { value: 'unidades', label: 'Orden: Cantidad de uds' },
                { value: 'superficie', label: 'Orden: Superficie m²' },
              ]}
            />
          </div>
        </div>
      </section>

      {catalogoError && (
        <Aviso tono="peligro">{catalogoError}</Aviso>
      )}

      {filteredVentanas.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <p className="text-sm text-slate-500">No se encontraron líneas que coincidan con el criterio de búsqueda.</p>
          <Button variant="link" size="sm" onClick={() => setSearchTerm('')}>
            Limpiar filtro
          </Button>
        </div>
      ) : (
        <>
          {/* @container: el Sidebar le quita ancho al contenido, así que las columnas
              se deciden por el ancho real del área, no por el viewport. */}
          <div className="@container">
            <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-4 sm:gap-5">
              {ventanasPagina.map((v) => (
                <VentanaCard
                  key={v.id}
                  ventana={v}
                  onEditar={(ventana) => setSelectedVentanaIdForEdicion(ventana.id)}
                  onDeleteLineaManual={handleEliminarLineaManual}
                  isDeletingLineaManual={eliminandoLineaId === v.id}
                />
              ))}
            </div>
          </div>

          <Paginacion
            total={filteredVentanas.length}
            pagina={paginaEfectiva}
            porPagina={porPagina}
            onPaginaChange={setPagina}
            onPorPaginaChange={(n) => {
              setPorPagina(n);
              setPagina(1);
            }}
            etiqueta="líneas"
          />
        </>
      )}

      {/* Modal: Editar Línea (dibujo en vivo + materiales) */}
      {selectedVentanaForEdicion && (
        <EditarLineaModal
          key={selectedVentanaForEdicion.id}
          ventana={selectedVentanaForEdicion}
          onClose={() => setSelectedVentanaIdForEdicion(null)}
          onUpdated={handleVentanaMaterialesUpdated}
          onEspejar={handleEspejarVentana}
          isEspejando={espejandoLineaId === selectedVentanaForEdicion.id}
          onInvertirMano={handleInvertirManoVentana}
          isInvirtiendoMano={invirtiendoManoLineaId === selectedVentanaForEdicion.id}
          onInvertirOrden={handleInvertirOrdenVentana}
          isInvirtiendoOrden={invirtiendoOrdenLineaId === selectedVentanaForEdicion.id}
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


