import React, { useState } from 'react';
import { PanelTop, DoorClosed, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { getPlantillasLinea, crearLineaManual } from '../../../../api/client';
import { MaterialPicker } from './MaterialPicker';
import type { Material } from '../../../../types';
import { Modal } from '../../../../components/ui/Modal';
import { Aviso } from '../../../../components/ui/Aviso';
import { OpcionesTarjeta } from '../../../../components/ui/Campos';

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
  const [hojasElegidas, setHojasElegidas] = useState<1 | 2 | null>(null);
  const [plantillaId, setPlantillaId] = useState('');
  const [generalError, setGeneralError] = useState<string | null>(null);

  const plantillasQuery = useQuery({
    queryKey: ['plantillasLinea'],
    queryFn: async () => (await getPlantillasLinea()).data,
    enabled: tipo === 'PROTEX',
  });
  // Plantillas activas para la cantidad de hojas elegida -- si hay solo una
  // (el caso normal, un kit fijo por cantidad de hojas), se usa directo sin
  // pedirle al usuario que elija de nuevo.
  const plantillasParaHojas = (plantillasQuery.data || []).filter((p) => p.activa && p.hojas === hojasElegidas);
  React.useEffect(() => {
    if (plantillasParaHojas.length === 1) {
      setPlantillaId(plantillasParaHojas[0].id);
    } else {
      setPlantillaId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hojasElegidas, plantillasQuery.data]);
  const plantillaOptions = [
    { value: '', label: 'Elegir plantilla…' },
    ...plantillasParaHojas.map((p) => ({ value: p.id, label: p.nombre })),
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      if (!vidrio) throw new Error('Elegí el vidrio de esta línea.');
      if (tipo === 'PROTEX' && !hojasElegidas) throw new Error('Elegí si la puerta es de 1 o 2 hojas.');
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
    if (tipo === 'PROTEX' && !hojasElegidas) {
      setGeneralError('Elegí si la puerta es de 1 o 2 hojas.');
      return;
    }
    if (tipo === 'PROTEX' && !plantillaId) {
      setGeneralError('Elegí la plantilla de herrajes de la puerta.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      titulo="Agregar Línea Manual"
      subtitulo="Una línea que no viene de HETMO"
      icono={PanelTop}
      onClose={onClose}
      onSubmit={handleSubmit}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Agregar Línea
          </Button>
        </Modal.Pie>
      }
    >
      {generalError && <Aviso tono="peligro">{generalError}</Aviso>}

      {/* Tipo de línea */}
      <OpcionesTarjeta
        columnas={2}
        valor={tipo}
        onChange={setTipo}
        opciones={[
          { value: 'DVH_FIJO', label: 'Vidrio DVH fijo', ayuda: 'Paño de vidrio sin marco', icono: <PanelTop className="w-4 h-4 text-brand-600" /> },
          { value: 'PROTEX', label: 'Puerta Protex', ayuda: 'Vidrio + herrajes por hoja', icono: <DoorClosed className="w-4 h-4 text-brand-600" /> },
        ]}
      />

      <div className="grid grid-cols-3 gap-3">
        <Input
          label="Ancho (mm)"
          type="number"
          min={0}
          value={anchoMm}
          onChange={(e) => setAnchoMm(e.target.value)}
          required
        />
        <Input label="Alto (mm)" type="number" min={0} value={altoMm} onChange={(e) => setAltoMm(e.target.value)} required />
        <Input label="Unidades" type="number" min={1} value={unidades} onChange={(e) => setUnidades(e.target.value)} required />
      </div>
      {tipo === 'PROTEX' && (
        <p className="text-[11px] text-slate-500 -mt-2.5">
          El ancho es el de una hoja individual -- si son 2 hojas, el ancho total de la puerta y el vidrio se calculan solos.
        </p>
      )}

      {/* Vidrio */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase text-slate-500">Vidrio</span>
        {vidrio ? (
          <div className="flex items-center justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
            <div className="min-w-0">
              <div className="font-mono font-semibold text-[11px] text-slate-900">{vidrio.skuInterno}</div>
              <div className="text-[11px] text-slate-600 leading-tight truncate">{vidrio.descripcion}</div>
            </div>
            <Button variant="link" size="sm" className="shrink-0" onClick={() => setVidrio(null)}>
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
            <MaterialPicker
              placeholder="Buscar vidrio por SKU o descripción…"
              onSelect={(m) => setVidrio(m)}
            />
          </div>
        )}
      </div>

      {/* Cantidad de hojas + plantilla de herrajes (solo Protex) */}
      {tipo === 'PROTEX' && (
        <div className="space-y-2">
          <OpcionesTarjeta
            legend="Cantidad de hojas"
            columnas={2}
            disabled={plantillasQuery.isLoading}
            valor={hojasElegidas ? (String(hojasElegidas) as '1' | '2') : null}
            onChange={(v) => setHojasElegidas(v === '1' ? 1 : 2)}
            opciones={[
              { value: '1', label: '1 hoja' },
              { value: '2', label: '2 hojas' },
            ]}
          />

          {hojasElegidas && !plantillasQuery.isLoading && plantillasParaHojas.length === 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              No hay ninguna plantilla activa de {hojasElegidas} {hojasElegidas === 1 ? 'hoja' : 'hojas'} -- se arman desde Configuración → Plantillas de Puertas.
            </p>
          )}

          {/* Solo se pide elegir si hay más de un kit activo para esa cantidad de hojas */}
          {hojasElegidas && plantillasParaHojas.length > 1 && (
            <Select
              label="Plantilla de Herrajes"
              options={plantillaOptions}
              value={plantillaId}
              onChange={(e) => setPlantillaId(e.target.value)}
            />
          )}
        </div>
      )}

    </Modal>
  );
};
