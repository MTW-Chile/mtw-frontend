import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Pencil, AlertCircle } from 'lucide-react';
import { getProveedores, getTiposProducto, getUnidadesMedida, updateMaterial } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { Material } from '../../../types';

/**
 * Edita lo que es del ERP en un material (docs/ARQUITECTURA.md 2.2): su tipo
 * de producto, su formato de compra propio (ej. un perfil que este proveedor
 * vende en barras de 6,5 m en vez de las 5,8 m del tipo) y su proveedor. Lo
 * que viene de HETMO (SKU, descripción, familia) no se edita acá.
 */
export const EditarMaterialModal: React.FC<{ material: Material; onClose: () => void }> = ({ material, onClose }) => {
  const queryClient = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ['tiposProducto'], queryFn: getTiposProducto });
  const { data: unidades = [] } = useQuery({ queryKey: ['unidadesMedida'], queryFn: getUnidadesMedida });
  const { data: proveedores = [] } = useQuery({ queryKey: ['proveedores'], queryFn: async () => (await getProveedores()).data });

  const [tipoProductoId, setTipoProductoId] = useState(material.tipoProductoId);
  const [formatoPropio, setFormatoPropio] = useState(material.unidadCompraId != null || material.factorCompra != null);
  const [unidadCompraId, setUnidadCompraId] = useState(material.unidadCompraId ?? '');
  const [factorCompra, setFactorCompra] = useState(material.factorCompra != null ? String(Number(material.factorCompra)) : '');
  const [proveedorId, setProveedorId] = useState(material.proveedorId ?? '');
  const [error, setError] = useState<string | null>(null);

  const tipo = tipos.find((t) => t.id === tipoProductoId);
  const factor = Number(factorCompra.replace(',', '.'));
  const formatoValido = !formatoPropio || (!!unidadCompraId && Number.isFinite(factor) && factor > 0);

  const guardar = useMutation({
    mutationFn: () =>
      updateMaterial(material.id, {
        tipoProductoId,
        unidadCompraId: formatoPropio ? unidadCompraId : null,
        factorCompra: formatoPropio ? factor : null,
        ...(proveedorId !== (material.proveedorId ?? '') ? { proveedorId: proveedorId || null } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
      // Cambia como se calcula el material en las versiones en curso.
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail'] });
      onClose();
    },
    onError: (err) => setError(extraerErrorParaToast(err).mensaje),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <Pencil className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-slate-900 font-mono">{material.skuInterno}</h2>
              <p className="text-[11px] text-slate-500 truncate" title={material.descripcion}>{material.descripcion}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Select
            label="Tipo de producto"
            options={tipos.filter((t) => t.activo || t.id === tipoProductoId).map((t) => ({ value: t.id, label: `${t.nombre} · ${t.partida.nombre}` }))}
            value={tipoProductoId}
            onChange={(e) => setTipoProductoId(e.target.value)}
            helperText={`Familia en HETMO: ${material.familia || '—'}`}
          />

          <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-brand-600" checked={formatoPropio} onChange={(e) => setFormatoPropio(e.target.checked)} />
              <span>
                <span className="block font-bold text-slate-800">Formato de compra propio</span>
                <span className="block text-[11px] text-slate-500">
                  {tipo
                    ? `Por defecto se compra como su tipo: ${tipo.unidadCompra.nombre.toLowerCase()}${Number(tipo.factorCompra) !== 1 ? ` de ${Number(tipo.factorCompra).toLocaleString('es-CL')} ${tipo.unidadPrecio.simbolo}` : ''}.`
                    : 'Por defecto se compra como su tipo.'}
                </span>
              </span>
            </label>
            {formatoPropio && (
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Unidad de compra"
                  options={[{ value: '', label: 'Elige…' }, ...unidades.filter((u) => u.activa || u.id === unidadCompraId).map((u) => ({ value: u.id, label: `${u.nombre} (${u.simbolo})` }))]}
                  value={unidadCompraId}
                  onChange={(e) => setUnidadCompraId(e.target.value)}
                />
                <Input
                  label={`${tipo?.unidadPrecio.simbolo ?? 'unid.'} por unidad`}
                  inputMode="decimal"
                  value={factorCompra}
                  onChange={(e) => setFactorCompra(e.target.value)}
                  placeholder="Ej: 6,5"
                />
              </div>
            )}
          </div>

          <Select
            label="Proveedor"
            options={[{ value: '', label: 'Sin proveedor asignado' }, ...proveedores.map((p) => ({ value: p.id, label: p.nombre }))]}
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            helperText="Elegido a mano, el sync con HETMO ya no lo cambia."
          />
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!formatoValido} isLoading={guardar.isPending}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};
