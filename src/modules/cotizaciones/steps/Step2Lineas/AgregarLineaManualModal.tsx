import React, { useState } from 'react';
import { X, PanelTop, DoorClosed, AlertCircle, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { getPlantillasLinea, crearLineaManual } from '../../../../api/client';
import { MaterialPicker } from './MaterialPicker';
import type { Material } from '../../../../types';

interface AgregarLineaManualModalProps {
  versionId: string;
  proyectoId: string;
  onClose: () => void;
  onCreated: () => void;
}

type TipoLinea = 'DVH_FIJO' | 'PROTEX';

/**
 * Agrega una línea que no viene de HETMO: un paño de vidrio DVH fijo, o una
 * puerta Protex (vidrio + herrajes de una plantilla, ver Configuración ->
 * Plantillas de Puertas). El costo se calcula solo, sumando los materiales
 * -- mismo mecanismo que el resto de la Analítica.
 */
export const AgregarLineaManualModal: React.FC<AgregarLineaManualModalProps> = ({
  versionId,
  proyectoId,
  onClose,
  onCreated,
}) => {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState<TipoLinea>('DVH_FIJO');
  const [anchoMm, setAnchoMm] = useState('');
  const [altoMm, setAltoMm] = useState('');
  const [unidades, setUnidades] = useState('1');
  const [vidrio, setVidrio] = useState<Material | null>(null);
  const [plantillaId, setPlantillaId] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);

  const plantillasQuery = useQuery({
    queryKey: ['plantillasLinea'],
    queryFn: async () => (await getPlantillasLinea()).data,
    enabled: tipo === 'PROTEX',
  });
  const plantillaOptions = [
    { value: '', label: plantillasQuery.isLoading ? 'Cargando…' : 'Elegir plantilla…' },
    ...(plantillasQuery.data || []).filter((p) => p.activa).map((p) => ({ value: p.id, label: p.nombre })),
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      if (!vidrio) throw new Error('Elegí el vidrio de esta línea.');
      if (tipo === 'PROTEX' && !plantillaId) throw new Error('Elegí la plantilla de herrajes de la puerta.');
      return crearLineaManual({
        versionId,
        tipo,
        anchoMm: Number(anchoMm),
        altoMm: Number(altoMm),
        unidades: Number(unidades),
        materialVidrioId: vidrio.id,
        plantillaId: tipo === 'PROTEX' ? plantillaId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      onCreated();
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'Error al agregar la línea.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    const ancho = Number(anchoMm);
    const alto = Number(altoMm);
    const uds = Number(unidades);
    if (!Number.isFinite(ancho) || ancho <= 0 || !Number.isFinite(alto) || alto <= 0) {
      setGeneralError('Ancho y alto deben ser números mayores a 0.');
      return;
    }
    if (!Number.isFinite(uds) || uds <= 0) {
      setGeneralError('Unidades debe ser un número mayor a 0.');
      return;
    }
    if (!vidrio) {
      setGeneralError('Elegí el vidrio de esta línea.');
      return;
    }
    if (tipo === 'PROTEX' && !plantillaId) {
      setGeneralError('Elegí la plantilla de herrajes de la puerta.');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <PanelTop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Agregar Línea Manual</h2>
              <p className="text-[11px] text-slate-500">Una línea que no viene de HETMO</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Tipo de línea */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTipo('DVH_FIJO')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                tipo === 'DVH_FIJO' ? 'border-[#E34A26] bg-orange-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <PanelTop className={`w-5 h-5 mb-1.5 ${tipo === 'DVH_FIJO' ? 'text-[#E34A26]' : 'text-slate-400'}`} />
              <div className="text-xs font-bold text-slate-900">Vidrio DVH Fijo</div>
              <div className="text-[10px] text-slate-500">Paño de vidrio sin marco</div>
            </button>
            <button
              type="button"
              onClick={() => setTipo('PROTEX')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                tipo === 'PROTEX' ? 'border-[#E34A26] bg-orange-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <DoorClosed className={`w-5 h-5 mb-1.5 ${tipo === 'PROTEX' ? 'text-[#E34A26]' : 'text-slate-400'}`} />
              <div className="text-xs font-bold text-slate-900">Puerta Protex</div>
              <div className="text-[10px] text-slate-500">Vidrio + herrajes por hoja</div>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Ancho (mm)" type="number" min={0} value={anchoMm} onChange={(e) => setAnchoMm(e.target.value)} required />
            <Input label="Alto (mm)" type="number" min={0} value={altoMm} onChange={(e) => setAltoMm(e.target.value)} required />
            <Input label="Unidades" type="number" min={1} value={unidades} onChange={(e) => setUnidades(e.target.value)} required />
          </div>

          {/* Vidrio */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-500">Vidrio</span>
            {vidrio ? (
              <div className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-[11px] text-slate-900">{vidrio.skuInterno}</div>
                  <div className="text-[11px] text-slate-600 leading-tight truncate">{vidrio.descripcion}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setVidrio(null)}
                  className="text-[10px] font-semibold text-[#E34A26] hover:underline shrink-0 cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3">
                <MaterialPicker
                  placeholder="Buscar vidrio por SKU o descripción…"
                  onSelect={(m) => setVidrio(m)}
                />
              </div>
            )}
          </div>

          {/* Plantilla de herrajes (solo Protex) */}
          {tipo === 'PROTEX' && (
            <Select
              label="Plantilla de Herrajes"
              options={plantillaOptions}
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
              disabled={plantillasQuery.isLoading}
            />
          )}
          {tipo === 'PROTEX' && !plantillasQuery.isLoading && (plantillasQuery.data || []).length === 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              No hay plantillas de puerta configuradas todavía -- se arman desde Configuración → Plantillas de Puertas.
            </p>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Agregar Línea
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
