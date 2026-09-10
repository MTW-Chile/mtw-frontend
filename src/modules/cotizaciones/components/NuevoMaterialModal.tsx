import React, { useState } from 'react';
import { X, PackagePlus, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { createMaterial, createProveedor, getProveedores } from '../../../api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Material, Proveedor } from '../../../types';

const NUEVO_PROVEEDOR_VALUE = '__nuevo__';

interface NuevoMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (material: Material) => void;
}

export const FAMILIAS_CATALOGO = [
  { value: 'PERFILERIA', label: 'Perfilería de Aluminio / PVC' },
  { value: 'CRISTALES', label: 'Cristales & Termopaneles (DVH)' },
  { value: 'HERRAJES', label: 'Herrajes, Manillas, Cremonas & Cierres' },
  { value: 'SELLOS_GOMAS', label: 'Sellos, Felpas & Gomas' },
  { value: 'FIJACIONES', label: 'Fijaciones, Tornillos & Anclajes' },
  { value: 'ACCESORIOS', label: 'Accesorios, Tapas & Escuadras' },
  { value: 'QUIMICOS', label: 'Siliconas, Espumas & Químicos' },
  { value: 'OTROS', label: 'Otros / Insumos Generales de Taller' },
];

export const UNIDADES_CATALOGO = [
  { value: 'ml', label: 'Metros Lineales (ml)' },
  { value: 'm2', label: 'Metros Cuadrados (m²)' },
  { value: 'un', label: 'Unidades (un)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'barra', label: 'Barra (6.0m / 6.5m)' },
  { value: 'tira', label: 'Tira' },
  { value: 'rollo', label: 'Rollo' },
  { value: 'juego', label: 'Juego / Kit' },
  { value: 'pliego', label: 'Pliego' },
];

export const MONEDAS_CATALOGO = [
  { value: 'CLP', label: 'CLP ($ - Peso Chileno)' },
  { value: 'UF', label: 'UF (Unidad de Fomento)' },
  { value: 'USD', label: 'USD ($ - Dólar USA)' },
  { value: 'EUR', label: 'EUR (€ - Euro)' },
];

export const NuevoMaterialModal: React.FC<NuevoMaterialModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    skuInterno: '',
    descripcion: '',
    familia: 'PERFILERIA',
    unidadMedida: 'ml',
    monedaOrigen: 'CLP',
    precioOrigen: '',
    proveedorId: '',
    proveedorNuevoNombre: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const proveedoresQuery = useQuery({
    queryKey: ['proveedores'],
    queryFn: async () => (await getProveedores()).data,
    enabled: isOpen,
  });
  const proveedorOptions = [
    { value: '', label: 'Sin proveedor asignado' },
    ...(proveedoresQuery.data || []).map((p) => ({ value: p.id, label: p.nombre })),
    { value: NUEVO_PROVEEDOR_VALUE, label: '+ Nuevo proveedor…' },
  ];

  // Ningún fallback local si la API falla: antes, si createMaterial()
  // fallaba, el modal fabricaba un material falso en memoria y cerraba
  // "con éxito" -- el usuario creía que había guardado algo que en
  // realidad nunca llegó a la base de datos.
  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const precioNum = data.precioOrigen ? parseFloat(data.precioOrigen) : null;

      let proveedorId: string | null = data.proveedorId || null;
      if (data.proveedorId === NUEVO_PROVEEDOR_VALUE) {
        const nombre = data.proveedorNuevoNombre.trim();
        if (!nombre) throw new Error('Ingresá el nombre del nuevo proveedor.');
        const proveedorCreado = await createProveedor(nombre);
        proveedorId = proveedorCreado.data.id;
        // Reflejar el proveedor recién creado de inmediato (cache + form): si
        // createMaterial falla más abajo y el usuario reintenta, el formulario
        // ya apunta al proveedor real en vez de a NUEVO_PROVEEDOR_VALUE, así
        // no se crea un proveedor duplicado en cada reintento.
        queryClient.setQueryData<Proveedor[]>(['proveedores'], (old) => [...(old || []), proveedorCreado.data]);
        setFormData((prev) => ({ ...prev, proveedorId: proveedorCreado.data.id, proveedorNuevoNombre: '' }));
      }

      const res = await createMaterial({
        skuInterno: data.skuInterno.trim().toUpperCase(),
        descripcion: data.descripcion.trim(),
        familia: data.familia,
        unidadMedida: data.unidadMedida,
        monedaOrigen: data.monedaOrigen,
        precioOrigen: isNaN(precioNum as number) ? null : precioNum,
        proveedorId,
      });
      const created = (res as any)?.data || res;
      return created as Material;
    },
    onSuccess: (newMat) => {
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      if (onSuccess) onSuccess(newMat);
      handleClose();
    },
    onError: (err: any) => {
      setGeneralError(
        err?.response?.data?.error || err?.message || 'Error al guardar el material en la base de datos.'
      );
    },
  });

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.skuInterno.trim()) {
      newErrors.skuInterno = 'El SKU o código interno es obligatorio';
    }
    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }
    if (formData.precioOrigen && isNaN(Number(formData.precioOrigen))) {
      newErrors.precioOrigen = 'El precio debe ser un número válido';
    }
    if (formData.proveedorId === NUEVO_PROVEEDOR_VALUE && !formData.proveedorNuevoNombre.trim()) {
      newErrors.proveedorNuevoNombre = 'Ingresá el nombre del nuevo proveedor';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validate()) return;
    mutation.mutate(formData);
  };

  const handleClose = () => {
    setFormData({
      skuInterno: '',
      descripcion: '',
      familia: 'PERFILERIA',
      unidadMedida: 'ml',
      monedaOrigen: 'CLP',
      precioOrigen: '',
      proveedorId: '',
      proveedorNuevoNombre: '',
    });
    setErrors({});
    setGeneralError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                Nuevo Artículo en Maestro
              </h2>
              <p className="text-[11px] text-slate-500">
                Registrar material con SKU, familia, unidad, divisa y precio de origen
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="SKU / Código Interno"
              placeholder="Ej: AL-PER-7020"
              value={formData.skuInterno}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, skuInterno: e.target.value }))
              }
              error={errors.skuInterno}
              required
            />

            <Select
              label="Familia / Categoría"
              options={FAMILIAS_CATALOGO}
              value={formData.familia}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, familia: e.target.value }))
              }
            />
          </div>

          <Input
            label="Descripción del Material"
            placeholder="Ej: Perfil Marco Superior Serie 70 Anodizado Mate"
            value={formData.descripcion}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
            }
            error={errors.descripcion}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Select
              label="Unidad de Medida"
              options={UNIDADES_CATALOGO}
              value={formData.unidadMedida}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, unidadMedida: e.target.value }))
              }
            />

            <Select
              label="Divisa de Origen"
              options={MONEDAS_CATALOGO}
              value={formData.monedaOrigen}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, monedaOrigen: e.target.value }))
              }
            />

            <Input
              label="Precio de Origen"
              placeholder="Ej: 14500 o 0.42"
              value={formData.precioOrigen}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, precioOrigen: e.target.value }))
              }
              error={errors.precioOrigen}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="Proveedor"
              options={proveedorOptions}
              value={formData.proveedorId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, proveedorId: e.target.value, proveedorNuevoNombre: '' }))
              }
              disabled={proveedoresQuery.isLoading}
            />

            {formData.proveedorId === NUEVO_PROVEEDOR_VALUE && (
              <Input
                label="Nombre del Nuevo Proveedor"
                placeholder="Ej: Vidrios del Sur"
                value={formData.proveedorNuevoNombre}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, proveedorNuevoNombre: e.target.value }))
                }
                error={errors.proveedorNuevoNombre}
                required
              />
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">
              ℹ️ Integración con Cotizador MTW ERP
            </p>
            <p>
              El artículo y su precio de origen quedarán disponibles de inmediato para
              los cálculos de costo, ajuste de divisas y despiece en presupuestos.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={mutation.isPending}
            >
              Guardar Artículo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
