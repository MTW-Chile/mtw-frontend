import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, FilePlus2, AlertCircle } from 'lucide-react';
import { createAdicional, getProveedores } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { Adicional, CargoAdicional, FormaCobroInstalador, ObraPendienteDetalle } from '../../../types';
import { ETIQUETA_FORMA_COBRO } from '../../../types';
import { useTasasVigentes } from './comun';

/**
 * Alta de un adicional: a quién se le cobra (cliente, o instalador con su
 * forma de cobro) y sus divisas vigentes. Los ítems se agregan después. Desde
 * un pendiente, el cargo parte del que sugiere el pendiente.
 */
export const NuevoAdicionalModal: React.FC<{
  proyectoId: string;
  obraPendiente?: ObraPendienteDetalle;
  onClose: () => void;
  onCreado: (a: Adicional) => void;
}> = ({ proyectoId, obraPendiente, onClose, onCreado }) => {
  const { tasas, delDia } = useTasasVigentes();
  const { data: proveedores = [] } = useQuery({ queryKey: ['proveedores'], queryFn: async () => (await getProveedores()).data });
  const [titulo, setTitulo] = useState(obraPendiente ? obraPendiente.descripcion : '');
  const [cargoA, setCargoA] = useState<CargoAdicional>(obraPendiente?.cargoEfectivo === 'INSTALADOR' ? 'INSTALADOR' : 'CLIENTE');
  const [instaladorId, setInstaladorId] = useState('');
  const [forma, setForma] = useState<FormaCobroInstalador>('DESCUENTO_ESTADO_PAGO');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () =>
      createAdicional(proyectoId, {
        titulo: titulo.trim(),
        cargoA,
        instaladorProveedorId: cargoA === 'INSTALADOR' ? instaladorId : null,
        formaCobroInstalador: cargoA === 'INSTALADOR' ? forma : null,
        obraPendienteId: obraPendiente?.id ?? null,
        tasas: tasas ?? undefined,
      }),
    onSuccess: onCreado,
    onError: (err) => setError(extraerErrorParaToast(err).mensaje),
  });
  const completo = titulo.trim() && (cargoA === 'CLIENTE' || instaladorId) && tasas;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Nuevo adicional</h2>
              <p className="text-[11px] text-slate-500">Se cotiza con precios y divisas vigentes</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Cambio de ventana V12 a corredera" required />
          <Select
            label="A cargo de"
            options={[
              { value: 'CLIENTE', label: 'Cliente (se le vende)' },
              { value: 'INSTALADOR', label: 'Instalador (se le cobra)' },
            ]}
            value={cargoA}
            onChange={(e) => setCargoA(e.target.value as CargoAdicional)}
          />
          {cargoA === 'INSTALADOR' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Select
                label="Instalador"
                options={[{ value: '', label: 'Elige…' }, ...proveedores.map((p) => ({ value: p.id, label: p.nombre }))]}
                value={instaladorId}
                onChange={(e) => setInstaladorId(e.target.value)}
              />
              <Select
                label="Cómo se le cobra"
                options={(Object.keys(ETIQUETA_FORMA_COBRO) as FormaCobroInstalador[]).map((f) => ({ value: f, label: ETIQUETA_FORMA_COBRO[f] }))}
                value={forma}
                onChange={(e) => setForma(e.target.value as FormaCobroInstalador)}
              />
            </div>
          )}
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            {tasas
              ? `Divisas ${delDia ? 'del día' : 'de respaldo (no se pudieron obtener las del día)'}: dólar ${tasas.dolar.toLocaleString('es-CL')} · euro ${tasas.euro.toLocaleString('es-CL')} · UF ${tasas.uf.toLocaleString('es-CL')}.`
              : 'Cargando divisas…'}
          </p>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex justify-end gap-2.5 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => crear.mutate()} disabled={!completo} isLoading={crear.isPending}>
            Crear adicional
          </Button>
        </div>
      </div>
    </div>
  );
};
