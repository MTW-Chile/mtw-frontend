import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { actualizarCubicacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { Cubicacion } from '../../../types';
import { leerMilimetros } from '../pendientes/utils';
import { cajaModal, campo, etiqueta, fondoModal } from './estilos';
import { FORMATO_NOMENCLATURA_DEFECTO, generarNomenclatura, mmATexto, validarFormato } from './utils';

interface Props {
  proyectoId: string;
  cubicacion: Cubicacion;
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
  const ejemplo = errorFormato ? null : generarNomenclatura(formato, { codigo: 'V01', torre: 'A', piso: 1, dpto: 1 });
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
    <div className={fondoModal} role="dialog" aria-modal="true" aria-label="Configuración de la cubicación">
      <div className={`${cajaModal} max-w-lg`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Configuración de la cubicación</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="cub-holgura" className={etiqueta}>
            Holgura (mm)
          </label>
          <input
            id="cub-holgura"
            inputMode="decimal"
            value={holgura}
            onChange={(e) => setHolgura(e.target.value)}
            className={`${campo} ${holguraNum === null ? 'border-rose-300' : ''}`}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Se resta al rasgo (lo medido en obra), en ancho y en alto, para obtener la medida de fabricación. Cada tipo puede tener su propia holgura.
          </p>
        </div>

        <div>
          <label htmlFor="cub-formato" className={etiqueta}>
            Formato de la nomenclatura
          </label>
          <input id="cub-formato" value={formato} onChange={(e) => setFormato(e.target.value)} className={`${campo} font-mono ${errorFormato ? 'border-rose-300' : ''}`} />
          {errorFormato ? (
            <p className="text-[11px] text-rose-700 mt-1">{errorFormato}</p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-1">
              Partes: <span className="font-mono">{'{codigo} {piso} {dpto} {torre}'}</span>. El código original va siempre primero. Ejemplo (V01, piso 1, depto 1, torre A):{' '}
              <b className="font-mono text-slate-800" data-testid="ejemplo-nomenclatura">
                {ejemplo}
              </b>
            </p>
          )}
          {formato !== FORMATO_NOMENCLATURA_DEFECTO && (
            <button type="button" onClick={() => setFormato(FORMATO_NOMENCLATURA_DEFECTO)} className="text-[11px] text-brand-700 hover:underline mt-1 cursor-pointer">
              Volver al formato por defecto
            </button>
          )}
          {cambioFormato && !errorFormato && <p className="text-[11px] text-amber-800 mt-2">Las ventanas que ya tienen posición se renombrarán con este formato.</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!hayCambios || holguraNum === null || !!errorFormato} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};
