import React, { useEffect, useMemo, useState } from 'react';
import { X, ShoppingCart, AlertCircle, Plus, Trash2, Package } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { createOrdenCompra, getProyectos, getProveedores, getProyectoById } from '../../api/client';
import { useMonedas } from '../../lib/monedas';
import { computeMaterialesFasePorProveedor, type GrupoFaseProveedor } from '../cotizaciones/lib/materialesConsolidados';
import type { CategoriaGasto, Fase } from '../../types';

// Mismo dominio que CategoriaGasto en mtw-api -- solo hace falta para items
// SIN materialId (partidas externas tipo flete/mano de obra): con
// materialId, mtw-api deriva la categoria sola de la familia del material.
const CATEGORIA_OPTIONS: { value: CategoriaGasto; label: string }[] = [
  { value: 'PERFILERIA', label: 'Perfilería' },
  { value: 'HERRAJES', label: 'Herrajes' },
  { value: 'VIDRIOS', label: 'Vidrios' },
  { value: 'ACCESORIOS', label: 'Accesorios' },
  { value: 'REFUERZOS', label: 'Refuerzos' },
  { value: 'MANO_DE_OBRA', label: 'Mano de obra' },
  { value: 'FLETE', label: 'Flete' },
  { value: 'INSTALACION', label: 'Instalación' },
  { value: 'OTROS', label: 'Otros' },
];

interface NuevaOrdenCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Cuando se abre desde la ficha de un proyecto ya sabemos el proyecto --
  // se fija y no se puede cambiar, en vez de mostrar el selector completo.
  proyectoIdFijo?: string;
  proyectoLabelFijo?: string;
}

interface ItemForm {
  // Presente cuando el item vino de los materiales calculados de una fase
  // (ver gruposPorProveedor) -- mtw-api deriva la categoria sola de la
  // familia del material, asi que estos items no piden categoria.
  materialId?: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: string;
  // Valor teorico antes de redondear a la unidad de compra (solo
  // Perfileria/Refuerzos, que se compran por barra entera) -- puramente
  // informativo, se guarda tal cual en OrdenCompraItem.cantidadCalculada.
  cantidadCalculada?: number | null;
  precioUnitario: string;
  categoria: CategoriaGasto | '';
}

const itemVacio = (): ItemForm => ({ descripcion: '', unidadMedida: 'UN', cantidad: '', precioUnitario: '', categoria: '' });

const itemFormDesdeCalculo = (item: GrupoFaseProveedor['items'][number]): ItemForm => ({
  materialId: item.materialId,
  descripcion: item.descripcion,
  unidadMedida: item.unidadMedida,
  cantidad: String(item.cantidad),
  cantidadCalculada: item.cantidadCalculada,
  precioUnitario: item.precioUnitario ? String(item.precioUnitario) : '',
  categoria: '',
});

export const NuevaOrdenCompraModal: React.FC<NuevaOrdenCompraModalProps> = ({
  isOpen,
  onClose,
  proyectoIdFijo,
  proyectoLabelFijo,
}) => {
  const queryClient = useQueryClient();
  const monedas = useMonedas();

  const [proyectoId, setProyectoId] = useState(proyectoIdFijo || '');
  const [faseId, setFaseId] = useState('');
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
  // Detalle completo del proyecto (ventanas + materiales + fases) para poder
  // calcular que se necesita comprar por fase -- mismo queryKey que usa
  // ProyectoWorkspace, asi que si se abre esta modal desde ahí, sale del
  // cache de react-query sin pegarle de nuevo al backend.
  const { data: proyectoDetalle, isLoading: cargandoDetalle } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
    enabled: isOpen && !!proyectoId,
  });

  // La ejecucion real de la obra sigue la version activa, igual que en
  // ProyectoWorkspace/Cotizaciones -- no siempre la de versionNumero mas alto.
  const activeVersion = useMemo(() => {
    if (!proyectoDetalle) return undefined;
    return (
      proyectoDetalle.versiones.find((v) => v.hetmoId === proyectoDetalle.versionActivaHetmoId) ||
      proyectoDetalle.versiones[0]
    );
  }, [proyectoDetalle]);

  // Si ya hay fases reales planificadas (Paso "Fases"), se compra por esas
  // -- Fase 0 (el 100% del proyecto tal como llego de HETMO) solo se ofrece
  // cuando todavia no se planifico ninguna fase real.
  const fasesReales = (activeVersion?.fases || []).filter((f) => f.numeroFase > 0).sort((a, b) => a.numeroFase - b.numeroFase);
  const opcionesFase: Fase[] = fasesReales.length > 0 ? fasesReales : (activeVersion?.fases || []).filter((f) => f.numeroFase === 0);

  // Materiales necesarios para fabricar la fase elegida, agrupados por
  // proveedor -- reusa EXACTAMENTE la misma logica de precio/cantidad que
  // la Analitica de Materiales (conversion de moneda, ajustes manuales,
  // descuento/recargo por familia, barras para Perfileria/Refuerzos) para
  // no mostrar un precio distinto al ya aprobado en el proyecto. Ver
  // comentario de computeMaterialesFasePorProveedor.
  const tasaDolar = Number(activeVersion?.tipoCambioDolar) || 950;
  const tasaUf = Number(activeVersion?.tipoCambioUF) || 38500;
  const tasaEuro = Number(activeVersion?.tipoCambioEuro) || 1030;
  const gruposPorProveedor: GrupoFaseProveedor[] = useMemo(() => {
    const fase = (activeVersion?.fases || []).find((f) => f.id === faseId);
    return computeMaterialesFasePorProveedor(activeVersion, fase, tasaDolar, tasaEuro, tasaUf, monedas);
  }, [activeVersion, faseId, tasaDolar, tasaEuro, tasaUf, monedas]);

  // Cambiar de proyecto o de fase invalida cualquier proveedor/items que ya
  // se hubieran elegido -- evita mezclar items de una fase con el proveedor
  // armado para otra.
  useEffect(() => {
    setFaseId('');
  }, [proyectoId]);

  useEffect(() => {
    setProveedorId('');
    setItems([itemVacio()]);
  }, [faseId]);

  const elegirGrupoProveedor = (grupo: GrupoFaseProveedor) => {
    if (!grupo.proveedorId) return; // sin proveedor asignado: no se puede generar OC para este grupo
    setProveedorId(grupo.proveedorId);
    setItems(grupo.items.length ? grupo.items.map(itemFormDesdeCalculo) : [itemVacio()]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!proyectoId || !proveedorId) {
        throw new Error('Proyecto y proveedor son obligatorios.');
      }
      const itemsValidos = items.filter((i) => i.descripcion.trim() && i.cantidad && i.precioUnitario);
      if (itemsValidos.length === 0) {
        throw new Error('Agrega al menos un item con descripción, cantidad y precio.');
      }
      if (itemsValidos.some((i) => !i.materialId && !i.categoria)) {
        throw new Error('Elige una categoría para cada item sin material del catálogo -- sirve para el Control de Presupuesto.');
      }
      return createOrdenCompra({
        proyectoId,
        faseId: faseId || null,
        proveedorId,
        requiereAprobacion,
        items: itemsValidos.map((i) => ({
          materialId: i.materialId,
          descripcion: i.descripcion.trim(),
          unidadMedida: i.unidadMedida || 'UN',
          cantidad: parseFloat(i.cantidad),
          cantidadCalculada: i.cantidadCalculada ?? undefined,
          precioUnitario: parseFloat(i.precioUnitario),
          categoria: i.materialId ? undefined : (i.categoria as CategoriaGasto),
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
    setFaseId('');
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
  const faseOptions = [
    { value: '', label: proyectoId ? 'Selecciona una fase...' : 'Elige primero un proyecto' },
    ...opcionesFase.map((f) => ({ value: f.id, label: f.numeroFase === 0 ? `Fase 0 - ${f.nombre}` : `Fase ${f.numeroFase} - ${f.nombre}` })),
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
            <Select
              label="Fase"
              options={faseOptions}
              value={faseId}
              onChange={(e) => setFaseId(e.target.value)}
              disabled={!proyectoId || cargandoDetalle}
              helperText={cargandoDetalle ? 'Cargando fases del proyecto...' : undefined}
              required
            />
          </div>

          {faseId && (
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Proveedores con materiales en esta fase
              </span>
              {gruposPorProveedor.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Esta fase no tiene materiales calculados (¿tiene líneas de ventana asignadas en la pestaña Fases?). Elige un
                  proveedor manualmente abajo para una compra externa (flete, mano de obra, etc.).
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {gruposPorProveedor.map((g) => {
                    const activo = !!g.proveedorId && proveedorId === g.proveedorId;
                    const sinProveedor = !g.proveedorId;
                    return (
                      <button
                        key={g.proveedorId || 'sin-proveedor'}
                        type="button"
                        disabled={sinProveedor}
                        onClick={() => elegirGrupoProveedor(g)}
                        title={sinProveedor ? 'Asígnale un proveedor a estos materiales en el Maestro para poder generar una OC' : undefined}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                          activo
                            ? 'bg-[#E34A26]/10 text-[#E34A26] border-[#E34A26]/30'
                            : sinProveedor
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        {g.proveedorNombre}
                        <span className="font-mono font-normal opacity-70">
                          · {g.items.length} {g.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Select
            label="Proveedor"
            options={proveedorOptions}
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            helperText="Se llena solo al elegir un proveedor arriba -- se puede cambiar a mano para una compra externa"
            required
          />

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
                <div key={index} className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        placeholder="Descripción"
                        value={item.descripcion}
                        onChange={(e) => setItemField(index, 'descripcion', e.target.value)}
                      />
                    </div>
                    <div className="w-44 shrink-0">
                      {item.materialId ? (
                        <div className="h-[38px] flex items-center justify-center gap-1 px-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] font-bold text-sky-700">
                          <Package className="w-3.5 h-3.5" />
                          Del catálogo
                        </div>
                      ) : (
                        <Select
                          options={[{ value: '', label: 'Categoría...' }, ...CATEGORIA_OPTIONS]}
                          value={item.categoria}
                          onChange={(e) => setItemField(index, 'categoria', e.target.value as CategoriaGasto)}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarItem(index)}
                      disabled={items.length === 1}
                      className="w-9 h-9 mt-0.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Unidad" value={item.unidadMedida} onChange={(e) => setItemField(index, 'unidadMedida', e.target.value)} />
                    <Input
                      type="number"
                      placeholder="Cantidad"
                      value={item.cantidad}
                      onChange={(e) => setItemField(index, 'cantidad', e.target.value)}
                      helperText={
                        item.cantidadCalculada != null
                          ? `Cálculo exacto: ${item.cantidadCalculada.toLocaleString('es-CL', { maximumFractionDigits: 2 })} (redondeado a entero por barra)`
                          : undefined
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Precio unit."
                      value={item.precioUnitario}
                      onChange={(e) => setItemField(index, 'precioUnitario', e.target.value)}
                    />
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
