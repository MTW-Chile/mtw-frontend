import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { trasladarBodega } from '../../api/client';
import type { Bodega, StockMaterial } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Aviso } from '../../components/ui/Aviso';

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
    <Modal
      icono={Send}
      ancho="sm"
      titulo="Enviar a obra"
      subtitulo={stock.material.descripcion}
      onClose={onClose}
      cerrable={!mutation.isPending}
      pie={
        <Modal.Pie>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!bodegaDestinoId || !cantidadValida}
            isLoading={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            Trasladar
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}
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
    </Modal>
  );
};
