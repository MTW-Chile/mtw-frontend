import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';
import { createTipoProducto, getPartidas, getUnidadesMedida, updateTipoProducto, type TipoProductoPayload } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { MedicionReceta, TipoProducto } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Interruptor, OpcionesTarjeta } from '../../../components/ui/Campos';

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
  compraPorPieza: t?.compraPorPieza ?? false,
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
    <Modal
      ancho="lg"
      icono={Boxes}
      titulo={tipo ? `Tipo de producto: ${tipo.nombre}` : 'Nuevo tipo de producto'}
      subtitulo="Cómo se mide, se valoriza y se compra todo material de este tipo"
      onClose={onClose}
      cerrable={!guardar.isPending}
      pie={
        <Modal.Pie>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!completo} isLoading={guardar.isPending}>
            {tipo ? 'Guardar cambios' : 'Crear tipo'}
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}

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

      <OpcionesTarjeta
        legend="Medición en la receta"
        opciones={MEDICIONES.map((m) => ({ value: m.value, label: m.label, ayuda: m.ayuda }))}
        valor={form.medicion}
        onChange={(v) => set('medicion', v)}
      />

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
          <Interruptor
            enTarjeta
            valor={form.compraDesdeResumenHetmo}
            onChange={(v) => set('compraDesdeResumenHetmo', v)}
            etiqueta="Comprar según el resumen de HETMO"
            label="Cantidad desde el resumen de HETMO"
            helperText="Usa la optimización de corte de HETMO (unidades de compra enteras) en vez de sumar la receta."
          />
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
              ['compraPorPieza', 'Compra por pieza a medida', 'Se cotiza por su unidad de precio, pero se compra y recibe por pieza con sus medidas y su ventana (ej. vidrios).'],
              ['monedaFija', 'Moneda fija', 'Ignora la moneda de cada precio y usa siempre esta.'],
              ['individualizado', 'Individualizado', 'Bodega registra cada unidad física (número de serie).'],
              ['porDefecto', 'Tipo por defecto', 'Se asigna a familias de HETMO sin mapeo.'],
              ['activo', 'Activo', 'Disponible para materiales nuevos.'],
            ] as const
          ).map(([campo, titulo, ayuda]) => (
            <Interruptor key={campo} enTarjeta valor={!!form[campo]} onChange={(v) => set(campo, v)} etiqueta={titulo} label={titulo} helperText={ayuda} />
          ))}
        </div>
      </fieldset>

      {tipo && (tipo._count?.materiales ?? 0) > 0 && (
        <Aviso tono="advertencia">
          {tipo._count?.materiales} materiales usan este tipo: el cambio recalcula la Analítica de toda cotización que no esté congelada.
        </Aviso>
      )}
    </Modal>
  );
};
