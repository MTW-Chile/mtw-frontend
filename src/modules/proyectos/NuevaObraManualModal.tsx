import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crearObraManual } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ClientePicker } from '../clientes/ClientePicker';
import type { Cliente, Proyecto } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

interface Props {
  onClose: () => void;
  onCreada: (proyecto: Proyecto) => void;
}

// Obra que ya esta en curso y nunca se cotizo (cada piso es un documento
// suelto de HETMO). Nace ya aceptada, sin presupuesto: despues se le vinculan
// sus documentos de fabricacion desde la seccion Fabricacion. Exige un cliente
// del maestro (adjuntar o crear), igual que el presupuesto manual de
// Cotizaciones.
//
// No usa <form>: el selector de cliente puede abrir el formulario de cliente
// y sus eventos de envio no deben llegar a este modal.
export const NuevaObraManualModal: React.FC<Props> = ({ onClose, onCreada }) => {
  const queryClient = useQueryClient();
  const [obra, setObra] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [direccion, setDireccion] = useState('');

  const puedeCrear = !!obra.trim() && !!cliente;

  const crear = useMutation({
    mutationFn: () =>
      crearObraManual({
        obra: obra.trim(),
        clienteId: cliente!.id,
        direccion: direccion.trim() || undefined,
      }),
    onSuccess: ({ proyecto }) => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['proyectosCount'] });
      onCreada(proyecto);
    },
  });

  const enviar = () => {
    if (puedeCrear && !crear.isPending) crear.mutate();
  };

  return (
    <Modal
      titulo="Nueva obra manual"
      ancho="sm"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!puedeCrear} isLoading={crear.isPending} onClick={enviar}>
            Crear obra
          </Button>
        </Modal.Pie>
      }
    >
      <p className="text-xs text-slate-500">
        Para una obra que ya está en curso y nunca se cotizó. Nace aceptada y sin presupuesto: después le vinculas sus
        documentos de fabricación desde la sección Fabricación.
      </p>
      <div className="space-y-3">
        <div>
          <Input label="Obra"
            id="obra-manual-nombre"
            autoFocus
            value={obra}
            onChange={(e) => setObra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enviar();
            }}
            placeholder="Nombre de la obra"
            maxLength={200} />
        </div>
        <ClientePicker value={cliente} onChange={setCliente} />
        <div>
          <Input label="Dirección de la obra (opcional)"
            id="obra-manual-direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enviar();
            }}
            placeholder="Si se deja vacía, se usa la del cliente"
            maxLength={300} />
        </div>
      </div>
    </Modal>
  );
};
