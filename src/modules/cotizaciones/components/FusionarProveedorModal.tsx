import React, { useState } from 'react';
import { X, GitMerge, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Fusionar "{origen.nombre}"</h2>
              <p className="text-[11px] text-slate-500">Sus materiales y OC pasan al proveedor elegido</p>
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

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              size="sm"
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
          </div>
        </div>
      </div>
    </div>
  );
};
