import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck } from 'lucide-react';
import { registrarRecepcionObra } from '../../api/client';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Aviso } from '../../components/ui/Aviso';
import { Casilla, InputCompacto, Textarea } from '../../components/ui/Campos';
import { fecha } from '../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import type { DespachoPorRecibir } from '../../types';
import { ETIQUETA_PARTE_CORTA, ETIQUETA_TIPO_GUIA } from '../proyectos/obra/estadoVentana';

interface Props {
  proyectoId: string;
  despacho: DespachoPorRecibir;
  onClose: () => void;
}

/**
 * Acuse de recibo en obra de un despacho (misma lógica que recepcionar una OC
 * en bodega): se marca lo que llegó; lo que no, queda pendiente de recibir en
 * el mismo despacho. Pensado para el celular del supervisor.
 */
export const RecibirDespachoModal: React.FC<Props> = ({ proyectoId, despacho, onClose }) => {
  const queryClient = useQueryClient();
  const pendientes = despacho.items.filter((i) => i.pendiente > 0);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(pendientes.map((i) => i.id)));
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(pendientes.map((i) => [i.id, String(i.pendiente)])));
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [notas, setNotas] = useState('');

  const alternar = (id: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const items = pendientes
    .filter((i) => marcados.has(i.id))
    .map((i) => ({ despachoItemId: i.id, cantidadRecibida: Math.min(i.pendiente, Math.max(0, Math.floor(Number(cantidades[i.id]) || 0))), observacion: observaciones[i.id]?.trim() || null }))
    .filter((i) => i.cantidadRecibida > 0);

  const recibir = useMutation({
    mutationFn: () => registrarRecepcionObra(despacho.id, { notas: notas.trim() || null, items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacion', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['instalacionObras'] });
      queryClient.invalidateQueries({ queryKey: ['despachos', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['despacho', despacho.id] });
      mostrarToast(`Recepción registrada: ${items.length} ítem(s) de ${despacho.codigo}.`, { tipo: 'info' });
      onClose();
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  return (
    <Modal
      icono={PackageCheck}
      titulo={`Recibir ${despacho.codigo}`}
      subtitulo={`${despacho.fase ? `Fase ${despacho.fase.numeroFase} · ${despacho.fase.nombre} · ` : ''}${despacho.fechaDespacho ? `despachado ${fecha(despacho.fechaDespacho)} · ` : ''}${ETIQUETA_TIPO_GUIA[despacho.tipoGuia]}${despacho.numeroGuia ? ` N° ${despacho.numeroGuia}` : ''}`}
      ancho="lg"
      onClose={onClose}
      cerrable={!recibir.isPending}
      pie={
        <Modal.Pie inicio={<span>{items.length} de {pendientes.length} ítem(s)</span>}>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={items.length === 0} isLoading={recibir.isPending} onClick={() => recibir.mutate()}>
            Confirmar recepción
          </Button>
        </Modal.Pie>
      }
    >
      <div className="space-y-3">
        <Aviso tono="info" sinIcono>
          Marca lo que llegó a la obra. Lo que no marques queda pendiente en este mismo despacho; si algo llegó dañado, recíbelo y después levanta el pendiente desde la ventana.
        </Aviso>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setMarcados(new Set(pendientes.map((i) => i.id)))}>
            Todo llegó
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMarcados(new Set())}>
            Desmarcar
          </Button>
        </div>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {pendientes.map((i) => (
            <li key={i.id} className="px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-3">
                <Casilla checked={marcados.has(i.id)} onChange={() => alternar(i.id)} aria-label={`Recibir ${i.descripcion}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {i.descripcion}
                    {i.parte !== 'COMPLETA' && <span className="text-slate-500 font-normal"> · {ETIQUETA_PARTE_CORTA[i.parte]}</span>}
                  </p>
                  {i.cantidad > 1 && (
                    <p className="text-[11px] text-slate-500">
                      despachadas {i.cantidad} · recibidas {i.cantidadRecibida} · pendientes {i.pendiente}
                    </p>
                  )}
                </div>
                {i.cantidad > 1 && marcados.has(i.id) && (
                  <InputCompacto type="number" inputMode="numeric" min={1} max={i.pendiente} value={cantidades[i.id] ?? ''} onChange={(e) => setCantidades((c) => ({ ...c, [i.id]: e.target.value }))} className="w-16 text-right" aria-label={`Cantidad recibida de ${i.descripcion}`} />
                )}
              </div>
              {marcados.has(i.id) && (
                <InputCompacto placeholder="Observación (opcional): llegó rayada, falta un herraje…" value={observaciones[i.id] ?? ''} onChange={(e) => setObservaciones((o) => ({ ...o, [i.id]: e.target.value }))} maxLength={500} aria-label={`Observación de ${i.descripcion}`} className="w-full" />
              )}
            </li>
          ))}
        </ul>
        <Textarea label="Notas de la recepción" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={1000} placeholder="Quién entregó, estado general de la carga…" />
      </div>
    </Modal>
  );
};
