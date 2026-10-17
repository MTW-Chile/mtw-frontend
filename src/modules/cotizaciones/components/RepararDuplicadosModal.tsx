import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, GitMerge, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { aplicarReparacionProveedores, getPlanReparacionProveedores } from '../../../api/client';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Reparar proveedores duplicados</h2>
              <p className="text-[11px] text-slate-500">Revisa el plan antes de aplicarlo. Se fusionan materiales, OC y vínculos con HETMO.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
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
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 shrink-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            {aplicar.isSuccess ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!aplicar.isSuccess && plan.length > 0 && (
            <Button onClick={() => aplicar.mutate()} isLoading={aplicar.isPending}>
              Aplicar {plan.length} fusión(es)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
