import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { crearTipoCubicacion, editarTipoCubicacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { TipoCubicacion } from '../../../types';
import { leerMilimetros } from '../pendientes/utils';
import { cajaModal, campo, etiqueta, fondoModal } from './estilos';
import { mmATexto } from './utils';

interface Props {
  proyectoId: string;
  moneda: string;
  /** Si viene, se edita ese tipo; si no, se crea uno. */
  tipo?: TipoCubicacion;
  onClose: () => void;
}

const decimal = (t: string): number | null => {
  const n = Number(t.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return t.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

// Un tipo de ventana de la cubicacion (el equivalente a una fila de la hoja BASE). Un item sin medidas
// (muro cortina, antifuego, film...) es un area comun: por ahora una sola unidad.
export const TipoModal: React.FC<Props> = ({ proyectoId, moneda, tipo, onClose }) => {
  const queryClient = useQueryClient();
  const editando = !!tipo;
  const [codigo, setCodigo] = useState(tipo?.codigo ?? '');
  const [sistema, setSistema] = useState(tipo?.sistema ?? '');
  const [areaComun, setAreaComun] = useState(tipo?.esAreaComun ?? false);
  const [ancho, setAncho] = useState(mmATexto(tipo?.anchoPlanoMm));
  const [alto, setAlto] = useState(mmATexto(tipo?.altoPlanoMm));
  const [cuadros, setCuadros] = useState(tipo?.cuadros != null ? String(tipo.cuadros) : '');
  const [precio, setPrecio] = useState(tipo?.precioUnitario != null ? String(tipo.precioUnitario).replace('.', ',') : '');
  const [contratadas, setContratadas] = useState(String(tipo?.cantidadContratada ?? 0));
  const [holgura, setHolgura] = useState(mmATexto(tipo?.holguraMm));

  // El codigo va al principio de cada nomenclatura: no se cambia si ya hay ventanas CON POSICION de este tipo
  // (las ventanas que el presupuesto dejo creadas sin posicion no cuentan). Un area comun no tiene posicion.
  const conPosicion = editando && !tipo!.esAreaComun && tipo!.cubicadas > 0;
  const codigoBloqueado = conPosicion;
  const tipoBloqueado = conPosicion;

  const anchoNum = leerMilimetros(ancho);
  const altoNum = leerMilimetros(alto);
  const precioNum = precio.trim() === '' ? null : decimal(precio);
  const contratadasNum = Number(contratadas);
  const holguraNum = holgura.trim() === '' ? null : leerMilimetros(holgura);
  const cuadrosNum = cuadros.trim() === '' ? null : Number(cuadros);

  const valido =
    !!codigo.trim() &&
    !!sistema.trim() &&
    Number.isInteger(contratadasNum) &&
    contratadasNum >= 0 &&
    (precio.trim() === '' || precioNum !== null) &&
    (holgura.trim() === '' || holguraNum !== null) &&
    (cuadrosNum === null || (Number.isInteger(cuadrosNum) && cuadrosNum >= 0)) &&
    (areaComun || (ancho.trim() === '' && alto.trim() === '') || (anchoNum !== null && altoNum !== null));

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        sistema: sistema.trim(),
        esAreaComun: areaComun,
        anchoPlanoMm: areaComun ? null : anchoNum,
        altoPlanoMm: areaComun ? null : altoNum,
        cuadros: areaComun ? null : cuadrosNum,
        precioUnitario: precioNum,
        cantidadContratada: contratadasNum,
        holguraMm: areaComun ? null : holguraNum,
      };
      return editando ? editarTipoCubicacion(tipo!.id, { ...datos, ...(codigoBloqueado ? {} : { codigo: codigo.trim() }) }) : crearTipoCubicacion(proyectoId, { codigo: codigo.trim(), ...datos });
    },
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
    <div className={fondoModal} role="dialog" aria-modal="true" aria-label={editando ? 'Editar tipo' : 'Nuevo tipo'}>
      <div className={`${cajaModal} max-w-lg`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">{editando ? `Tipo ${tipo!.codigo}` : 'Nuevo tipo de ventana'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="tipo-codigo" className={etiqueta}>
              Código
            </label>
            <input id="tipo-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} disabled={codigoBloqueado} maxLength={30} placeholder="V01" className={`${campo} font-mono disabled:opacity-60`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="tipo-sistema" className={etiqueta}>
              Apertura
            </label>
            <input id="tipo-sistema" value={sistema} onChange={(e) => setSistema(e.target.value)} maxLength={200} placeholder="CORREDERA XO" className={campo} />
          </div>
        </div>
        {codigoBloqueado && <p className="text-[11px] text-slate-500 -mt-2">El código no se cambia mientras el tipo tenga ventanas con posición: su nomenclatura depende de él.</p>}

        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={areaComun} disabled={tipoBloqueado} onChange={(e) => setAreaComun(e.target.checked)} />
          <span>
            <b>Área común / fachada</b> (sin medidas: muro cortina, antifuego, film…). Por ahora cuenta como una sola unidad.
          </span>
        </label>

        {!areaComun && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="tipo-ancho" className={etiqueta}>
                Ancho plano
              </label>
              <input id="tipo-ancho" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} placeholder="mm" className={campo} />
            </div>
            <div>
              <label htmlFor="tipo-alto" className={etiqueta}>
                Alto plano
              </label>
              <input id="tipo-alto" inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} placeholder="mm" className={campo} />
            </div>
            <div>
              <label htmlFor="tipo-cuadros" className={etiqueta}>
                Cuadros
              </label>
              <input id="tipo-cuadros" inputMode="numeric" value={cuadros} onChange={(e) => setCuadros(e.target.value)} className={campo} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tipo-precio" className={etiqueta}>
              Precio unitario ({moneda})
            </label>
            <input id="tipo-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} className={`${campo} ${precio.trim() !== '' && precioNum === null ? 'border-rose-300' : ''}`} />
          </div>
          <div>
            <label htmlFor="tipo-contratadas" className={etiqueta}>
              Cantidad contratada
            </label>
            <input id="tipo-contratadas" inputMode="numeric" value={contratadas} onChange={(e) => setContratadas(e.target.value)} className={campo} />
          </div>
        </div>

        {!areaComun && (
          <div className="sm:max-w-[12rem]">
            <label htmlFor="tipo-holgura" className={etiqueta}>
              Holgura propia (mm)
            </label>
            <input id="tipo-holgura" inputMode="decimal" value={holgura} onChange={(e) => setHolgura(e.target.value)} placeholder="la de la cubicación" className={campo} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!valido} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            {editando ? 'Guardar' : 'Crear tipo'}
          </Button>
        </div>
      </div>
    </div>
  );
};
