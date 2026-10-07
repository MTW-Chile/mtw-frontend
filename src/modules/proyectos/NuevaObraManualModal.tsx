import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { crearObraManual } from '../../api/client';
import { Button } from '../../components/ui/Button';
import type { Proyecto } from '../../types';

interface Props {
  onClose: () => void;
  onCreada: (proyecto: Proyecto) => void;
}

// Obra que ya esta en curso y nunca se cotizo en HETMO (cada piso es un
// documento suelto). No genera presupuesto: despues se le vinculan sus
// documentos de fabricacion desde la seccion Fabricacion.
export const NuevaObraManualModal: React.FC<Props> = ({ onClose, onCreada }) => {
  const queryClient = useQueryClient();
  const [obra, setObra] = useState('');
  const [cliente, setCliente] = useState('');
  const [direccion, setDireccion] = useState('');

  const crear = useMutation({
    mutationFn: () =>
      crearObraManual({
        obra: obra.trim(),
        clienteNombre: cliente.trim() || undefined,
        direccion: direccion.trim() || undefined,
      }),
    onSuccess: ({ proyecto }) => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['proyectosCount'] });
      onCreada(proyecto);
    },
  });

  const campo =
    'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600';
  const etiqueta = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <form
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (obra.trim() && !crear.isPending) crear.mutate();
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Nueva obra manual</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Para una obra que ya está en curso y no se cotizó en HETMO. Se crea sin presupuesto: después le vinculas sus
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
              placeholder="Nombre de la obra"
              maxLength={200}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="obra-manual-cliente" className={etiqueta}>
              Cliente (opcional)
            </label>
            <input
              id="obra-manual-cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
              maxLength={200}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="obra-manual-direccion" className={etiqueta}>
              Dirección (opcional)
            </label>
            <input
              id="obra-manual-direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección de la obra"
              maxLength={300}
              className={campo}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!obra.trim()} isLoading={crear.isPending}>
            Crear obra
          </Button>
        </div>
      </form>
    </div>
  );
};
