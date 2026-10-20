import React, { useState } from 'react';
import { GitMerge } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { fusionarProveedor } from '../../../api/client';
import type { Proveedor } from '../../../types';

interface FusionarProveedorModalProps {
  origen: Proveedor;
  proveedores: Proveedor[];
  onClose: () => void;
}

/**
 * Fusiona un proveedor duplicado (origen) dentro del proveedor real
 * (destino): reasigna todos sus materiales/OC y lo elimina. Pensado para
 * limpiar los duplicados que dejo el bug de "codigo_proveedor" en
 * mtw-hetmo (ya corregido) -- antes cada material sincronizado creaba un
 * Proveedor nuevo en vez de enlazar al existente.
 */
export const FusionarProveedorModal: React.FC<FusionarProveedorModalProps> = ({ origen, proveedores, onClose }) => {
  const queryClient = useQueryClient();
  const [destinoId, setDestinoId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const opciones = proveedores.filter((p) => p.id !== origen.id);

  const mutation = useMutation({
    mutationFn: () => fusionarProveedor(origen.id, destinoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo fusionar el proveedor.'),
  });

  return (
    <Modal
      icono={GitMerge}
      ancho="sm"
      titulo={`Fusionar "${origen.nombre}"`}
      subtitulo="Sus materiales y OC pasan al proveedor elegido"
      onClose={onClose}
      cerrable={!mutation.isPending}
      pie={
        <Modal.Pie>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={!destinoId}
            isLoading={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            Fusionar y eliminar
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <p className="text-xs text-slate-600">
        Todos los materiales y Órdenes de Compra que hoy apuntan a <strong>{origen.nombre}</strong> van a quedar
        enlazados al proveedor que elijas abajo, y <strong>{origen.nombre}</strong> se elimina. Esta acción no se
        puede deshacer.
      </p>

      <Select
        label="Fusionar dentro de"
        options={[{ value: '', label: 'Selecciona el proveedor real...' }, ...opciones.map((p) => ({ value: p.id, label: p.nombre }))]}
        value={destinoId}
        onChange={(e) => setDestinoId(e.target.value)}
        required
      />
    </Modal>
  );
};
