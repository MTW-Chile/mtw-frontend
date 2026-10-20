import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FilePlus2 } from 'lucide-react';
import { createAdicional, getProveedores } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { Adicional, CargoAdicional, FormaCobroInstalador, ObraPendienteDetalle } from '../../../types';
import { ETIQUETA_FORMA_COBRO } from '../../../types';
import { useTasasVigentes } from './comun';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';

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
  // Items sueltos o recotizar ventanas de la cotizacion (se eligen despues).
  const [origen, setOrigen] = useState<'ITEMS' | 'VENTANAS' | 'HETMO'>('ITEMS');
  const [cargoA, setCargoA] = useState<CargoAdicional>(obraPendiente?.cargoEfectivo === 'INSTALADOR' ? 'INSTALADOR' : 'CLIENTE');
  const [instaladorId, setInstaladorId] = useState('');
  const [forma, setForma] = useState<FormaCobroInstalador>('DESCUENTO_ESTADO_PAGO');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: () =>
      createAdicional(proyectoId, {
        titulo: titulo.trim(),
        origen,
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
    <Modal
      titulo="Nuevo adicional"
      subtitulo="Se cotiza con precios y divisas vigentes"
      icono={FilePlus2}
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => crear.mutate()} disabled={!completo} isLoading={crear.isPending}>
            Crear adicional
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Cambio de ventana V12 a corredera" required />
      <Select
        label="Cómo se cotiza"
        options={[
          { value: 'ITEMS', label: 'Ítems sueltos (materiales, servicios, ítems libres)' },
          { value: 'VENTANAS', label: 'Recotizar ventanas de la cotización' },
          { value: 'HETMO', label: 'Vincular un documento de venta de HETMO' },
        ]}
        value={origen}
        onChange={(e) => setOrigen(e.target.value as 'ITEMS' | 'VENTANAS' | 'HETMO')}
      />
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
    </Modal>
  );
};
