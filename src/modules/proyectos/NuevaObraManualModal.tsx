import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { crearObraManual } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ClientePicker } from '../clientes/ClientePicker';
import type { Cliente, Proyecto } from '../../types';

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

  const campo =
    'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600';
  const etiqueta = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Nueva obra manual</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Para una obra que ya está en curso y nunca se cotizó. Nace aceptada y sin presupuesto: después le vinculas sus
          documentos de fabricación desde la sección Fabricación.
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="obra-manual-nombre" className={etiqueta}>
              Obra
            </label>
            <input
              id="obra-manual-nombre"
              autoFocus
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enviar();
              }}
              placeholder="Nombre de la obra"
              maxLength={200}
              className={campo}
            />
          </div>
          <ClientePicker value={cliente} onChange={setCliente} />
          <div>
            <label htmlFor="obra-manual-direccion" className={etiqueta}>
              Dirección de la obra (opcional)
            </label>
            <input
              id="obra-manual-direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enviar();
              }}
              placeholder="Si se deja vacía, se usa la del cliente"
              maxLength={300}
              className={campo}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!puedeCrear} isLoading={crear.isPending} onClick={enviar}>
            Crear obra
          </Button>
        </div>
      </div>
    </div>
  );
};
