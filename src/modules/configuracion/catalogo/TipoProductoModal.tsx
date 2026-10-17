import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Boxes, AlertCircle } from 'lucide-react';
import { createTipoProducto, getPartidas, getUnidadesMedida, updateTipoProducto, type TipoProductoPayload } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { MedicionReceta, TipoProducto } from '../../../types';
import { Interruptor } from './comun';

const MEDICIONES: { value: MedicionReceta; label: string; ayuda: string }[] = [
  { value: 'UNIDAD', label: 'Por unidad', ayuda: 'La receta trae una cantidad (piezas, juegos).' },
  { value: 'LONGITUD', label: 'Por longitud', ayuda: 'La receta trae metros (ej. juntas).' },
  { value: 'AREA', label: 'Por área', ayuda: 'La receta trae m² (ej. vidrios; base del film protector).' },
];

const MONEDAS = ['CLP', 'USD', 'EUR', 'UF'];

type Form = Omit<TipoProductoPayload, 'factorCompra'> & { factorCompra: string };

const formDesde = (t: TipoProducto | null): Form => ({
  nombre: t?.nombre ?? '',
  descripcion: t?.descripcion ?? '',
  partidaId: t?.partidaId ?? '',
  medicion: t?.medicion ?? 'UNIDAD',
  unidadConsumoId: t?.unidadConsumoId ?? '',
  unidadPrecioId: t?.unidadPrecioId ?? '',
  unidadCompraId: t?.unidadCompraId ?? '',
  factorCompra: t ? String(Number(t.factorCompra)) : '1',
  compraDesdeResumenHetmo: t?.compraDesdeResumenHetmo ?? false,
  moneda: t?.moneda ?? 'CLP',
  monedaFija: t?.monedaFija ?? false,
  individualizado: t?.individualizado ?? false,
  porDefecto: t?.porDefecto ?? false,
  orden: t?.orden ?? 0,
  activo: t?.activo ?? true,
});

/**
 * Alta y edición de un tipo de producto: la regla con que se calcula, se
 * valoriza y se compra todo material de ese tipo (docs/ARQUITECTURA.md 3.2).
 * Cambiar un tipo recalcula la Analítica de toda versión que no esté congelada.
 */
export const TipoProductoModal: React.FC<{ tipo: TipoProducto | null; onClose: () => void }> = ({ tipo, onClose }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => formDesde(tipo));
  const [error, setError] = useState<string | null>(null);
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const { data: unidades = [] } = useQuery({ queryKey: ['unidadesMedida'], queryFn: getUnidadesMedida });

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) => setForm((prev) => ({ ...prev, [campo]: valor }));
  const simbolo = (id: string) => unidades.find((u) => u.id === id)?.simbolo ?? '—';

  const guardar = useMutation({
    mutationFn: () => {
      const payload: TipoProductoPayload = {
        ...form,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || null,
        factorCompra: Number(form.factorCompra.replace(',', '.')),
      };
      return tipo ? updateTipoProducto(tipo.id, payload) : createTipoProducto(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiposProducto'] });
      queryClient.invalidateQueries({ queryKey: ['partidas'] });
      // La Analitica de las versiones en curso depende de estas reglas.
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail'] });
      onClose();
    },
    onError: (err) => setError(extraerErrorParaToast(err).mensaje),
  });

  const opcionesUnidad = [{ value: '', label: 'Elige…' }, ...unidades.filter((u) => u.activa || [form.unidadConsumoId, form.unidadPrecioId, form.unidadCompraId].includes(u.id)).map((u) => ({ value: u.id, label: `${u.nombre} (${u.simbolo})` }))];
  const factor = Number(form.factorCompra.replace(',', '.'));
  const completo =
    form.nombre.trim() && form.partidaId && form.unidadConsumoId && form.unidadPrecioId && form.unidadCompraId && Number.isFinite(factor) && factor > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">{tipo ? `Tipo de producto: ${tipo.nombre}` : 'Nuevo tipo de producto'}</h2>
              <p className="text-[11px] text-slate-500">Cómo se mide, se valoriza y se compra todo material de este tipo</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Nombre" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
            <Select
              label="Partida"
              options={[{ value: '', label: 'Elige…' }, ...partidas.filter((p) => p.activa || p.id === form.partidaId).map((p) => ({ value: p.id, label: p.nombre }))]}
              value={form.partidaId}
              onChange={(e) => set('partidaId', e.target.value)}
            />
          </div>
          <Input label="Descripción" value={form.descripcion ?? ''} onChange={(e) => set('descripcion', e.target.value)} placeholder="Opcional" />

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Medición en la receta</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MEDICIONES.map((m) => (
                <label
                  key={m.value}
                  className={`p-3 rounded-xl border cursor-pointer text-xs ${form.medicion === m.value ? 'border-brand-600 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <input type="radio" name="medicion" className="sr-only" checked={form.medicion === m.value} onChange={() => set('medicion', m.value)} />
                  <span className="block font-bold text-slate-900">{m.label}</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{m.ayuda}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Formato de venta del proveedor</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Select label="Unidad de consumo" options={opcionesUnidad} value={form.unidadConsumoId} onChange={(e) => set('unidadConsumoId', e.target.value)} />
              <Select label="Unidad de precio" options={opcionesUnidad} value={form.unidadPrecioId} onChange={(e) => set('unidadPrecioId', e.target.value)} />
              <Select label="Unidad de compra" options={opcionesUnidad} value={form.unidadCompraId} onChange={(e) => set('unidadCompraId', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
              <Input
                label={`${simbolo(form.unidadPrecioId)} por ${simbolo(form.unidadCompraId)}`}
                value={form.factorCompra}
                inputMode="decimal"
                onChange={(e) => set('factorCompra', e.target.value)}
                helperText="Cuántas unidades de precio trae cada unidad de compra (ej. 5,8 m por barra). Un material puede tener el suyo propio."
              />
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 text-xs cursor-pointer">
                <Interruptor valor={form.compraDesdeResumenHetmo} onChange={(v) => set('compraDesdeResumenHetmo', v)} etiqueta="Comprar según el resumen de HETMO" />
                <span>
                  <span className="block font-bold text-slate-800">Cantidad desde el resumen de HETMO</span>
                  <span className="block text-[11px] text-slate-500">Usa la optimización de corte de HETMO (unidades de compra enteras) en vez de sumar la receta.</span>
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Moneda y control</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Select label="Moneda del precio" options={MONEDAS.map((m) => ({ value: m, label: m }))} value={form.moneda} onChange={(e) => set('moneda', e.target.value)} />
              <Input label="Orden" type="number" min={0} value={String(form.orden ?? 0)} onChange={(e) => set('orden', Number(e.target.value) || 0)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {(
                [
                  ['monedaFija', 'Moneda fija', 'Ignora la moneda de cada precio y usa siempre esta.'],
                  ['individualizado', 'Individualizado', 'Bodega registra cada unidad física (número de serie).'],
                  ['porDefecto', 'Tipo por defecto', 'Se asigna a familias de HETMO sin mapeo.'],
                  ['activo', 'Activo', 'Disponible para materiales nuevos.'],
                ] as const
              ).map(([campo, titulo, ayuda]) => (
                <label key={campo} className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <Interruptor valor={!!form[campo]} onChange={(v) => set(campo, v)} etiqueta={titulo} />
                  <span>
                    <span className="block font-bold text-slate-800">{titulo}</span>
                    <span className="block text-[11px] text-slate-500">{ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {tipo && (tipo._count?.materiales ?? 0) > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              {tipo._count?.materiales} materiales usan este tipo: el cambio recalcula la Analítica de toda cotización que no esté congelada.
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!completo} isLoading={guardar.isPending}>
            {tipo ? 'Guardar cambios' : 'Crear tipo'}
          </Button>
        </div>
      </div>
    </div>
  );
};
