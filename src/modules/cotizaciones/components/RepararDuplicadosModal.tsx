import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { aplicarReparacionProveedores, getPlanReparacionProveedores } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';

/**
 * Repara los proveedores duplicados que creaba el sync anterior (identificaba
 * al proveedor por nombre). Primero muestra el plan que arma mtw-api leyendo
 * HETMO, sin cambiar nada; al confirmar se aplica en una sola transacción.
 * Si el plan cambió entre medio, la API lo rechaza y hay que recargarlo.
 */
export const RepararDuplicadosModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['planReparacionProveedores'],
    queryFn: getPlanReparacionProveedores,
    staleTime: 0,
  });
  const plan = data?.data ?? [];

  const aplicar = useMutation({
    mutationFn: () => aplicarReparacionProveedores(plan.map((f) => f.origen.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
    },
    onError: () => refetch(),
  });

  const mensajeError = (e: unknown) => (e as any)?.response?.data?.error || (e as Error)?.message || 'Error inesperado.';

  return (
    <Modal
      titulo="Reparar proveedores duplicados"
      subtitulo="Revisa el plan antes de aplicarlo. Se fusionan materiales, OC y vínculos con HETMO."
      icono={GitMerge}
      ancho="lg"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="ghost" onClick={onClose}>
            {aplicar.isSuccess ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!aplicar.isSuccess && plan.length > 0 && (
            <Button onClick={() => aplicar.mutate()} isLoading={aplicar.isPending}>
              Aplicar {plan.length} fusión(es)
            </Button>
          )}
        </Modal.Pie>
      }
    >
      {isLoading && (
        <div className="py-10 flex items-center justify-center text-slate-400 gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando HETMO…
        </div>
      )}
      {isError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>No se pudo armar el plan: {mensajeError(error)}</span>
        </div>
      )}
      {aplicar.isError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{mensajeError(aplicar.error)} Se recargó el plan actualizado.</span>
        </div>
      )}
      {aplicar.isSuccess ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Listo: se fusionaron {aplicar.data.fusionados} proveedor(es).</span>
        </div>
      ) : (
        !isLoading &&
        !isError &&
        (plan.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">No hay duplicados que reparar.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {plan.map((f) => (
              <li key={f.origen.id} className="px-4 py-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{f.origen.nombre}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-brand-700">{f.destino.nombre}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {f.origen.materiales} material(es) · {f.origen.ordenesCompra} OC · {f.motivo}
                </div>
              </li>
            ))}
          </ul>
        ))
      )}
    </Modal>
  );
};
