import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck } from 'lucide-react';
import { registrarRecepcionObra } from '../../api/client';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Aviso } from '../../components/ui/Aviso';
import { Textarea } from '../../components/ui/Campos';
import { fecha } from '../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import type { DespachoPorRecibir } from '../../types';
import { ETIQUETA_PARTE_CORTA, ETIQUETA_TIPO_GUIA } from '../proyectos/obra/estadoVentana';
import { FilaRecepcion } from '../abastecimiento/recepcion/FilaRecepcion';
import { estadoInicialRecepcion, itemsRecepcion, marcarTodas, resumenRecepcion, type EstadoRecepcion, type FilaRecepcion as Fila } from '../abastecimiento/recepcion/recepcion';

interface Props {
  proyectoId: string;
  despacho: DespachoPorRecibir;
  onClose: () => void;
}

/**
 * Acuse de recibo en obra de un despacho: misma lista de recepción que la OC
 * en bodega (FilaRecepcion): se marca lo que llegó; lo que no, queda
 * pendiente de recibir en el mismo despacho. Pensado para el celular o la
 * tablet del supervisor.
 */
export const RecibirDespachoModal: React.FC<Props> = ({ proyectoId, despacho, onClose }) => {
  const queryClient = useQueryClient();
  const filas = useMemo<Fila[]>(
    () =>
      despacho.items.map((i) => ({
        id: i.id,
        descripcion: i.descripcion,
        detalle: i.parte !== 'COMPLETA' ? ETIQUETA_PARTE_CORTA[i.parte] : null,
        unidad: 'un',
        pedido: i.cantidad,
        yaRecibido: i.cantidadRecibida,
        pendiente: i.pendiente,
        enteros: true,
      })),
    [despacho]
  );
  const [estado, setEstado] = useState<EstadoRecepcion>(() => estadoInicialRecepcion(filas));
  const [notas, setNotas] = useState('');
  const resumen = resumenRecepcion(filas, estado);

  const recibir = useMutation({
    mutationFn: () =>
      registrarRecepcionObra(despacho.id, {
        notas: notas.trim() || null,
        items: itemsRecepcion(filas, estado).map((i) => ({ despachoItemId: i.id, cantidadRecibida: i.cantidad, observacion: i.observacion })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacion', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['instalacionObras'] });
      queryClient.invalidateQueries({ queryKey: ['despachos', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['despacho', despacho.id] });
      mostrarToast(`Recepción registrada: ${resumen.marcadas} ítem(s) de ${despacho.codigo}.`, { tipo: 'info' });
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
        <Modal.Pie
          inicio={
            <span>
              {resumen.marcadas} de {resumen.pendientes} ítem(s)
              {resumen.quedaranPendientes > 0 ? ` · quedarán ${resumen.quedaranPendientes} pendientes` : ''}
            </span>
          }
        >
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={resumen.marcadas === 0} isLoading={recibir.isPending} onClick={() => recibir.mutate()}>
            Confirmar recepción
          </Button>
        </Modal.Pie>
      }
    >
      <div className="space-y-3">
        <Aviso tono="info" sinIcono>
          Marca lo que llegó a la obra. Lo que no marques queda pendiente en este mismo despacho; si algo llegó dañado, recíbelo, anótalo en la fila y después levanta el pendiente desde la ventana.
        </Aviso>
        <div className="flex justify-end gap-2 max-sm:[&>*]:flex-1">
          <Button size="sm" variant="outline" className="pointer-coarse:min-h-11" onClick={() => setEstado(marcarTodas(filas, estado, true))}>
            Llegó todo
          </Button>
          <Button size="sm" variant="ghost" className="pointer-coarse:min-h-11" onClick={() => setEstado(marcarTodas(filas, estado, false))}>
            Nada
          </Button>
        </div>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {filas.map((f) => (
            <FilaRecepcion
              key={f.id}
              fila={f}
              estado={estado[f.id]}
              onChange={(e) => setEstado({ ...estado, [f.id]: e })}
              etiquetaTotal="despachado"
              textoNoLlego="No llegó: queda pendiente en este despacho."
            />
          ))}
        </ul>
        <Textarea label="Notas de la recepción" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={1000} placeholder="Quién entregó, estado general de la carga…" />
      </div>
    </Modal>
  );
};
