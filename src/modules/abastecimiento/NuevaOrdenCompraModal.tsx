import React, { useState } from 'react';
import { X, ShoppingCart, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { createOrdenCompra, getProyectos, getProveedores } from '../../api/client';

interface NuevaOrdenCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Cuando se abre desde la ficha de un proyecto ya sabemos el proyecto --
  // se fija y no se puede cambiar, en vez de mostrar el selector completo.
  proyectoIdFijo?: string;
  proyectoLabelFijo?: string;
}

interface ItemForm {
  descripcion: string;
  unidadMedida: string;
  cantidad: string;
  precioUnitario: string;
}

const itemVacio = (): ItemForm => ({ descripcion: '', unidadMedida: 'UN', cantidad: '', precioUnitario: '' });

export const NuevaOrdenCompraModal: React.FC<NuevaOrdenCompraModalProps> = ({
  isOpen,
  onClose,
  proyectoIdFijo,
  proyectoLabelFijo,
}) => {
  const queryClient = useQueryClient();

  const [proyectoId, setProyectoId] = useState(proyectoIdFijo || '');
  const [proveedorId, setProveedorId] = useState('');
  const [requiereAprobacion, setRequiereAprobacion] = useState(false);
  const [items, setItems] = useState<ItemForm[]>([itemVacio()]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { data: proyectosData } = useQuery({
    queryKey: ['proyectos', 'todos-para-oc'],
    queryFn: () => getProyectos({ limit: 200 }),
    enabled: isOpen && !proyectoIdFijo,
  });
  const { data: proveedoresData } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => getProveedores(),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!proyectoId || !proveedorId) {
        throw new Error('Proyecto y proveedor son obligatorios.');
      }
      const itemsValidos = items.filter((i) => i.descripcion.trim() && i.cantidad && i.precioUnitario);
      if (itemsValidos.length === 0) {
        throw new Error('Agrega al menos un item con descripción, cantidad y precio.');
      }
      return createOrdenCompra({
        proyectoId,
        proveedorId,
        requiereAprobacion,
        items: itemsValidos.map((i) => ({
          descripcion: i.descripcion.trim(),
          unidadMedida: i.unidadMedida || 'UN',
          cantidad: parseFloat(i.cantidad),
          precioUnitario: parseFloat(i.precioUnitario),
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      handleClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'No se pudo crear la Orden de Compra.');
    },
  });

  const handleClose = () => {
    setProyectoId(proyectoIdFijo || '');
    setProveedorId('');
    setRequiereAprobacion(false);
    setItems([itemVacio()]);
    setGeneralError(null);
    onClose();
  };

  const setItemField = (index: number, campo: keyof ItemForm, valor: string) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)));
  };

  const agregarItem = () => setItems((prev) => [...prev, itemVacio()]);
  const quitarItem = (index: number) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const total = items.reduce((sum, i) => sum + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precioUnitario) || 0), 0);

  if (!isOpen) return null;

  const proyectoOptions = [
    { value: '', label: 'Selecciona un proyecto...' },
    ...(proyectosData?.data.map((p) => ({
      value: p.id,
      label: `${p.codigoInterno || `#${p.numeroPresupuesto}`} - ${p.obra}`,
    })) || []),
  ];
  const proveedorOptions = [
    { value: '', label: 'Selecciona un proveedor...' },
    ...(proveedoresData?.data.map((p) => ({ value: p.id, label: p.nombre })) || []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Nueva Orden de Compra</h2>
              <p className="text-[11px] text-slate-500">Se crea en BORRADOR -- el número se genera automáticamente</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setGeneralError(null);
            mutation.mutate();
          }}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {proyectoIdFijo ? (
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Proyecto (obra)</span>
                <div className="w-full py-2.5 px-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold">
                  {proyectoLabelFijo || 'Proyecto actual'}
                </div>
              </div>
            ) : (
              <Select label="Proyecto (obra)" options={proyectoOptions} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} required />
            )}
            <Select label="Proveedor" options={proveedorOptions} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required />
          </div>

          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requiereAprobacion}
              onChange={(e) => setRequiereAprobacion(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#E34A26] focus:ring-[#E34A26]/30"
            />
            Requiere aprobación de Gerencia antes de enviarse al proveedor
          </label>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">Items</span>
              <Button type="button" variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={agregarItem}>
                Agregar item
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      placeholder="Descripción"
                      value={item.descripcion}
                      onChange={(e) => setItemField(index, 'descripcion', e.target.value)}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input placeholder="Unidad" value={item.unidadMedida} onChange={(e) => setItemField(index, 'unidadMedida', e.target.value)} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      placeholder="Cantidad"
                      value={item.cantidad}
                      onChange={(e) => setItemField(index, 'cantidad', e.target.value)}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      placeholder="Precio unit."
                      value={item.precioUnitario}
                      onChange={(e) => setItemField(index, 'precioUnitario', e.target.value)}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-1 flex sm:justify-center">
                    <button
                      type="button"
                      onClick={() => quitarItem(index)}
                      disabled={items.length === 1}
                      className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-right text-xs text-slate-600">
              Total estimado:{' '}
              <span className="font-bold text-slate-900">
                {total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </form>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" isLoading={mutation.isPending} onClick={() => { setGeneralError(null); mutation.mutate(); }}>
            Crear Orden de Compra
          </Button>
        </div>
      </div>
    </div>
  );
};
