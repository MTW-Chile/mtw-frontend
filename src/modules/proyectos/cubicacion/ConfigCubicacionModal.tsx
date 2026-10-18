import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarCubicacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ConfigCubicacion } from '../../../types';
import { leerMilimetros } from '../pendientes/utils';
import { FORMATO_NOMENCLATURA_DEFECTO, generarNomenclatura, mmATexto, validarFormato } from './utils';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';

interface Props {
  proyectoId: string;
  cubicacion: ConfigCubicacion;
  onClose: () => void;
}

// Holgura (mm que se restan al rasgo para fabricar) y formato de la nomenclatura. Cambiar el formato
// renombra las ventanas que ya tienen posicion.
export const ConfigCubicacionModal: React.FC<Props> = ({ proyectoId, cubicacion, onClose }) => {
  const queryClient = useQueryClient();
  const [holgura, setHolgura] = useState(mmATexto(cubicacion.holguraMm));
  const [formato, setFormato] = useState(cubicacion.formatoNomenclatura);

  const holguraNum = leerMilimetros(holgura);
  const errorFormato = validarFormato(formato);
  const ejemplo = errorFormato ? null : generarNomenclatura(formato, { codigo: 'V01', torre: 'A', nombreUnidad: '101' });
  const cambioFormato = formato !== cubicacion.formatoNomenclatura;
  const hayCambios = cambioFormato || holguraNum !== cubicacion.holguraMm;

  const guardar = useMutation({
    mutationFn: () => actualizarCubicacion(proyectoId, { holguraMm: holguraNum ?? undefined, formatoNomenclatura: formato }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyectoId] });
      onClose();
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  return (
    <Modal
      titulo="Configuración de la cubicación"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!hayCambios || holguraNum === null || !!errorFormato} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </Button>
        </Modal.Pie>
      }
    >
      <div>
        <Input label="Holgura (mm)"
          id="cub-holgura"
          inputMode="decimal"
          value={holgura}
          onChange={(e) => setHolgura(e.target.value)} className={`${holguraNum === null ? 'border-rose-300' : ''}`} />
        <p className="text-[11px] text-slate-500 mt-1">
          Se resta al rasgo (lo medido en obra), en ancho y en alto, para obtener la medida de fabricación. Cada tipo puede tener su propia holgura.
        </p>
      </div>

      <div>
        <Input label="Formato de la nomenclatura" id="cub-formato" value={formato} onChange={(e) => setFormato(e.target.value)} className={`font-mono ${errorFormato ? 'border-rose-300' : ''}`} />
        {errorFormato ? (
          <p className="text-[11px] text-rose-700 mt-1">{errorFormato}</p>
        ) : (
          <p className="text-[11px] text-slate-500 mt-1">
            Partes: <span className="font-mono">{'{codigo} {nombreUnidad} {torre}'}</span>. El código original va siempre primero. Ejemplo (V01, depto 101, torre A):{' '}
            <b className="font-mono text-slate-800" data-testid="ejemplo-nomenclatura">
              {ejemplo}
            </b>
          </p>
        )}
        {formato !== FORMATO_NOMENCLATURA_DEFECTO && (
          <Button variant="link" size="sm" onClick={() => setFormato(FORMATO_NOMENCLATURA_DEFECTO)} className="mt-1">Volver al formato por defecto</Button>
        )}
        {cambioFormato && !errorFormato && <p className="text-[11px] text-amber-800 mt-2">Las ventanas que ya tienen posición se renombrarán con este formato.</p>}
      </div>
    </Modal>
  );
};
