import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from 'lucide-react';
import { updateClienteObraManual } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { usePermisos } from '../../lib/permisos';
import { avisarError } from '../configuracion/catalogo/comun';
import { ClientePicker } from '../clientes/ClientePicker';
import type { Cliente, Proyecto } from '../../types';

/**
 * Cliente de una obra manual. Se elige al crearla (NuevaObraManualModal) y
 * aquí se puede corregir si se eligió mal. Las obras cotizadas cambian su
 * cliente en el paso 1 de la cotización, no aquí.
 */
export const ClienteObraManualCard: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const editable = tiene('obras.editar');
  const [cambiando, setCambiando] = useState(false);
  const [nuevo, setNuevo] = useState<Cliente | null>(null);

  const guardar = useMutation({
    mutationFn: (c: Cliente) => updateClienteObraManual(proyecto.id, c.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setCambiando(false);
      setNuevo(null);
    },
    onError: avisarError,
  });

  const cancelar = () => {
    setCambiando(false);
    setNuevo(null);
  };

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
          <User className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold text-slate-900">Cliente</h2>
          {!cambiando && (
            <>
              <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{proyecto.cliente?.nombre ?? proyecto.clienteNombreRaw}</p>
              <p className="text-[11px] text-slate-500 truncate">{proyecto.cliente?.rut ?? proyecto.clienteRutRaw ?? 'Sin RUT'}</p>
            </>
          )}
        </div>
        {editable && !cambiando && (
          <Button size="sm" variant="outline" onClick={() => setCambiando(true)} className="shrink-0">
            Cambiar cliente
          </Button>
        )}
      </div>
      {cambiando && (
        <>
          <ClientePicker value={nuevo} onChange={setNuevo} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={guardar.isPending} onClick={cancelar}>
              Cancelar
            </Button>
            <Button size="sm" variant="primary" disabled={!nuevo || nuevo.id === proyecto.clienteId} isLoading={guardar.isPending} onClick={() => nuevo && guardar.mutate(nuevo)}>
              Guardar cliente
            </Button>
          </div>
        </>
      )}
    </section>
  );
};
