import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Material } from '../../../../types';
import { MaterialPicker } from './MaterialPicker';
import { Button } from '../../../../components/ui/Button';
import { IconButton } from '../../../../components/ui/IconButton';
import { Aviso } from '../../../../components/ui/Aviso';
import { Campo, InputCompacto } from '../../../../components/ui/Campos';

export interface MaterialLineaFormPayload {
  materialId: string;
  cantidad: number;
  piezas: number | null;
  acabado: string | null;
}

interface MaterialLineaFormProps {
  title: string;
  initialCantidad?: number;
  initialPiezas?: number | null;
  initialAcabado?: string | null;
  onCancel: () => void;
  onConfirm: (payload: MaterialLineaFormPayload) => Promise<void>;
}

/**
 * Formulario compartido por "Agregar material" y "Reemplazar material" en el
 * despiece de una línea: buscar en el maestro (MaterialPicker), elegir uno,
 * y cargar cantidad/piezas/acabado. Quien lo usa decide qué hacer con el
 * payload al confirmar (agregar vs. reemplazar son la misma UI, distinta
 * llamada a la API).
 */
export const MaterialLineaForm: React.FC<MaterialLineaFormProps> = ({
  title,
  initialCantidad,
  initialPiezas,
  initialAcabado,
  onCancel,
  onConfirm,
}) => {
  const [selected, setSelected] = useState<Material | null>(null);
  const [cantidad, setCantidad] = useState(initialCantidad !== undefined ? String(initialCantidad) : '1');
  const [piezas, setPiezas] = useState(initialPiezas !== undefined && initialPiezas !== null ? String(initialPiezas) : '');
  const [acabado, setAcabado] = useState(initialAcabado || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selected) return;
    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      setError('La cantidad debe ser un número mayor a 0.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onConfirm({
        materialId: selected.id,
        cantidad: cantidadNum,
        piezas: piezas.trim() ? Number(piezas) : null,
        acabado: acabado.trim() || null,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Error al guardar.');
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-brand-600">{title}</span>
        <IconButton icono={X} etiqueta="Cancelar" onClick={onCancel} disabled={isSaving} />
      </div>

      {error && (
        <Aviso tono="peligro">{error}</Aviso>
      )}

      {!selected ? (
        <MaterialPicker onSelect={setSelected} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <div className="font-mono font-semibold text-[11px] text-slate-900">{selected.skuInterno}</div>
              <div className="text-[11px] text-slate-600 leading-tight">{selected.descripcion}</div>
            </div>
            <Button variant="link" size="sm" className="shrink-0" onClick={() => setSelected(null)} disabled={isSaving}>
              Cambiar
            </Button>
          </div>

          {initialCantidad !== undefined && (
            <div className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="font-bold uppercase tracking-wide text-slate-400">Pendiente por reemplazar: </span>
              {initialCantidad} un
              {initialPiezas != null && ` · ${initialPiezas} ${initialPiezas === 1 ? 'pieza' : 'piezas'}`}
              {initialAcabado && ` · acabado ${initialAcabado}`}
              <span className="block mt-0.5 text-slate-400 normal-case font-normal">
                Los campos de abajo son los valores del material de reemplazo. Si esta línea necesita más de un material distinto
                (ej. una corredera con 2 manillas diferentes), puedes reemplazar solo una parte de la cantidad pendiente y repetir
                la operación con el resto para el otro material.
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Campo label="Cantidad *">
              <InputCompacto
                aria-label="Cantidad"
                type="number"
              min={0}
              max={initialCantidad}
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              disabled={isSaving}
                className="w-full"
              />
            </Campo>
            <Campo label="Piezas">
              <InputCompacto
                aria-label="Piezas"
                type="number"
              min={0}
              step="1"
              value={piezas}
              onChange={(e) => setPiezas(e.target.value)}
              disabled={isSaving}
              placeholder="—"
                className="w-full"
              />
            </Campo>
            <Campo label="Acabado">
              <InputCompacto
                aria-label="Acabado"
                type="text"
              value={acabado}
              onChange={(e) => setAcabado(e.target.value)}
              disabled={isSaving}
              placeholder="—"
                className="w-full"
              />
            </Campo>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} isLoading={isSaving}>
              Confirmar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
