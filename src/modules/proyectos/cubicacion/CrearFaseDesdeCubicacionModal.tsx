import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFase } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { SeleccionFaseCubicacion } from '../../../types';
import { etiqueta } from './estilos';
import { SelectorFaseDesdeCubicacion } from './SelectorFaseDesdeCubicacion';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';

interface Props {
  proyectoId: string;
  versionId: string;
  onClose: () => void;
}

export const CrearFaseDesdeCubicacionModal: React.FC<Props> = ({ proyectoId, versionId, onClose }) => {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [seleccion, setSeleccion] = useState<SeleccionFaseCubicacion>({});
  const [resumenSeleccion, setResumenSeleccion] = useState('nada seleccionado todavía');

  const crear = useMutation({
    mutationFn: () => createFase(versionId, { nombre: nombre.trim(), seleccionCubicacion: seleccion }),
    onSuccess: ({ avisos }) => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['cubicacionEstructura', proyectoId] });
      if (avisos.length) {
        mostrarToast(`Fase creada. ${avisos.length} exclusión(es): algo ya pertenecía a otra fase.`, { tipo: 'info' });
      }
      onClose();
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const hayAlgoSeleccionado =
    (seleccion.torreIds?.length || 0) + (seleccion.pisoIds?.length || 0) + (seleccion.unidadIds?.length || 0) + (seleccion.ventanaIndividualizadaIds?.length || 0) > 0;

  return (
    <Modal
      titulo="Crear fase desde la cubicación"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!nombre.trim() || !hayAlgoSeleccionado} isLoading={crear.isPending} onClick={() => crear.mutate()}>
            Crear fase
          </Button>
        </Modal.Pie>
      }
    >
      <div>
        <Input label="Nombre de la fase" id="fase-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Torre A, piso 1-5" />
      </div>

      <div>
        <p className={etiqueta}>Selecciona torres, pisos, deptos o ventanas sueltas</p>
        <SelectorFaseDesdeCubicacion
          proyectoId={proyectoId}
          onChange={(s, resumen) => {
            setSeleccion(s);
            setResumenSeleccion(resumen);
          }}
        />
        <p className="text-[11px] text-slate-500 mt-1">Seleccionado: {resumenSeleccion}. Una ventana que ya esté en otra fase se excluye sola, con aviso.</p>
      </div>
    </Modal>
  );
};
