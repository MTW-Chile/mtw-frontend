import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { createFase } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { SeleccionFaseCubicacion } from '../../../types';
import { cajaModal, campo, etiqueta, fondoModal } from './estilos';
import { SelectorFaseDesdeCubicacion } from './SelectorFaseDesdeCubicacion';

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
    <div className={fondoModal} role="dialog" aria-modal="true" aria-label="Crear fase con esta selección">
      <div className={`${cajaModal} max-w-lg`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Crear fase desde la cubicación</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="fase-nombre" className={etiqueta}>
            Nombre de la fase
          </label>
          <input id="fase-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. Torre A, piso 1-5" />
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

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!nombre.trim() || !hayAlgoSeleccionado} isLoading={crear.isPending} onClick={() => crear.mutate()}>
            Crear fase
          </Button>
        </div>
      </div>
    </div>
  );
};
