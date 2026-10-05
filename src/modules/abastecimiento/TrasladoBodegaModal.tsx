import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { trasladarBodega } from '../../api/client';
import type { Bodega, StockMaterial } from '../../types';

interface TrasladoBodegaModalProps {
  stock: StockMaterial;
  bodegasDestino: Bodega[];
  onClose: () => void;
}

const labelBodega = (bodega: Bodega) => bodega.proyecto?.obra || bodega.centroCosto?.nombre || bodega.nombre;

/**
 * Traslada stock de una bodega a otra (ej. desde "Obras Mayores" hacia la
 * bodega de una obra puntual, cuando se le asigna material que estaba en
 * stock general) -- POST /bodega/:bodegaId/trasladar, primer uso real de
 * TRASLADO_SALIDA/TRASLADO_ENTRADA (existian en el modelo desde antes de
 * la Bodega General, sin nada que los disparara).
 */
export const TrasladoBodegaModal: React.FC<TrasladoBodegaModalProps> = ({ stock, bodegasDestino, onClose }) => {
  const queryClient = useQueryClient();
  const [bodegaDestinoId, setBodegaDestinoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cantidadDisponible = Number(stock.cantidad);

  const mutation = useMutation({
    mutationFn: () =>
      trasladarBodega(stock.bodegaId, {
        materialId: stock.materialId,
        cantidad: parseFloat(cantidad),
        bodegaDestinoId,
        notas: notas.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bodegaGlobal'] });
      queryClient.invalidateQueries({ queryKey: ['bodegaProyecto'] });
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo trasladar el stock.'),
  });

  const cantidadNum = parseFloat(cantidad);
  const cantidadValida = cantidad !== '' && cantidadNum > 0 && cantidadNum <= cantidadDisponible + 0.0001;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Enviar a obra</h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{stock.material.descripcion}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Select
            label="Destino"
            options={[{ value: '', label: 'Selecciona la bodega destino...' }, ...bodegasDestino.map((b) => ({ value: b.id, label: labelBodega(b) }))]}
            value={bodegaDestinoId}
            onChange={(e) => setBodegaDestinoId(e.target.value)}
            required
          />

          <Input
            label={`Cantidad (disponible: ${cantidadDisponible.toLocaleString('es-CL')} ${stock.material.unidadMedida})`}
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="0"
            required
          />

          <Input label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: para la fase 2 de..." />

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!bodegaDestinoId || !cantidadValida}
              isLoading={mutation.isPending}
              onClick={() => {
                setError(null);
                mutation.mutate();
              }}
            >
              Trasladar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
