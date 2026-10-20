import React, { useState } from 'react';
import { DoorClosed, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { IconButton } from '../../components/ui/IconButton';
import { Modal } from '../../components/ui/Modal';
import { Aviso } from '../../components/ui/Aviso';
import { Campo, InputCompacto, OpcionesTarjeta } from '../../components/ui/Campos';
import { MaterialPicker } from '../cotizaciones/steps/Step2Lineas/MaterialPicker';
import { createPlantillaLinea, updatePlantillaLinea } from '../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Material, PlantillaLinea } from '../../types';

interface PlantillaLineaEditModalProps {
  plantilla: PlantillaLinea | null; // null = crear nueva
  onClose: () => void;
}

interface ItemDraft {
  material: Material;
  cantidad: string;
}

/**
 * Receta de herrajes de un tipo de puerta Protex ("Puerta Protex 1 Hoja",
 * "Puerta Protex 2 Hojas"...): un nombre + una lista de (material del
 * Maestro, cantidad por puerta). Al agregar una puerta de este tipo a un
 * proyecto (Step2Lineas), cada item se copia como MaterialVentana con
 * cantidad = item.cantidad * unidades de la linea -- ver POST
 * /api/ventanas/manual en mtw-api.
 */
export const PlantillaLineaEditModal: React.FC<PlantillaLineaEditModalProps> = ({ plantilla, onClose }) => {
  const queryClient = useQueryClient();
  const esNueva = !plantilla;

  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [hojas, setHojas] = useState<1 | 2>(plantilla?.hojas || 1);
  const [items, setItems] = useState<ItemDraft[]>(
    (plantilla?.items || [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((it) => ({ material: it.material!, cantidad: String(it.cantidad) }))
  );
  const [showPicker, setShowPicker] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const payloadItems = items.map((it) => ({ materialId: it.material.id, cantidad: Number(it.cantidad) }));
      if (esNueva) {
        return createPlantillaLinea({ nombre: nombre.trim(), hojas, items: payloadItems });
      }
      return updatePlantillaLinea(plantilla!.id, { nombre: nombre.trim(), hojas, items: payloadItems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantillasLinea'] });
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'Error al guardar la plantilla.');
    },
  });

  const handleSubmit = () => {
    setGeneralError(null);
    if (!nombre.trim()) {
      setGeneralError('El nombre es obligatorio.');
      return;
    }
    if (items.length === 0) {
      setGeneralError('Agrega al menos un material.');
      return;
    }
    if (items.some((it) => !Number.isFinite(Number(it.cantidad)) || Number(it.cantidad) <= 0)) {
      setGeneralError('Todas las cantidades deben ser números mayores a 0.');
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      icono={DoorClosed}
      ancho="md"
      titulo={esNueva ? 'Nueva plantilla de puerta' : plantilla!.nombre}
      subtitulo="Herrajes que lleva cada puerta de este tipo"
      onClose={onClose}
      cerrable={!mutation.isPending}
      onSubmit={handleSubmit}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Guardar
          </Button>
        </Modal.Pie>
      }
    >
      {generalError && <Aviso tono="peligro">{generalError}</Aviso>}

      <Input label="Nombre de la plantilla" placeholder="Ej: Puerta Protex 2 Hojas - Quicio Sobrepiso" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

      <OpcionesTarjeta
        legend="Hojas"
        columnas={2}
        opciones={[
          { value: '1', label: '1 hoja' },
          { value: '2', label: '2 hojas' },
        ]}
        valor={String(hojas) as '1' | '2'}
        onChange={(v) => setHojas(v === '1' ? 1 : 2)}
      />

      <Campo label="Materiales (cantidad por puerta)">
        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.map((it, idx) => (
              <div key={it.material.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold text-[11px] text-slate-900">{it.material.skuInterno}</div>
                  <div className="text-[11px] text-slate-600 leading-tight truncate">{it.material.descripcion}</div>
                </div>
                <InputCompacto
                  aria-label={`Cantidad de ${it.material.skuInterno}`}
                  type="number"
                  min={0}
                  step="any"
                  value={it.cantidad}
                  onChange={(e) => {
                    const val = e.target.value;
                    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, cantidad: val } : p)));
                  }}
                  className="w-16 font-mono text-right"
                />
                <IconButton icono={Trash2} tono="peligro" etiqueta={`Quitar ${it.material.skuInterno}`} onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} />
              </div>
            ))}
          </div>
        )}

        {showPicker ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 space-y-2">
            <MaterialPicker
              onSelect={(material) => {
                if (!items.some((it) => it.material.id === material.id)) {
                  setItems((prev) => [...prev, { material, cantidad: '1' }]);
                }
                setShowPicker(false);
              }}
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowPicker(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" className="w-full border-dashed" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowPicker(true)}>
            Agregar material
          </Button>
        )}
      </Campo>
    </Modal>
  );
};
