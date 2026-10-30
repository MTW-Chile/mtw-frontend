import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crearTipoCubicacion, editarTipoCubicacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { TipoCubicacion } from '../../../types';
import { leerMilimetros } from '../pendientes/utils';
import { mmATexto } from './utils';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Casilla } from '../../../components/ui/Campos';

interface Props {
  proyectoId: string;
  moneda: string;
  /** Si viene, se edita ese tipo; si no, se crea uno. */
  tipo?: TipoCubicacion;
  /** Obra legacy: sin precio ni holgura (las medidas son las de fabricación). */
  legacy?: boolean;
  onClose: () => void;
}

const decimal = (t: string): number | null => {
  const n = Number(t.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return t.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

// Un tipo de ventana de la cubicacion (el equivalente a una fila de la hoja BASE). Un item sin medidas
// (muro cortina, antifuego, film...) es un area comun: por ahora una sola unidad.
export const TipoModal: React.FC<Props> = ({ proyectoId, moneda, tipo, legacy, onClose }) => {
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
    <Modal
      titulo={editando ? `Tipo ${tipo!.codigo}` : 'Nuevo tipo de ventana'}
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!valido} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            {editando ? 'Guardar' : 'Crear tipo'}
          </Button>
        </Modal.Pie>
      }
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Input label="Código" id="tipo-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} disabled={codigoBloqueado} maxLength={30} placeholder="V01" className="font-mono" />
        </div>
        <div className="sm:col-span-2">
          <Input label="Apertura" id="tipo-sistema" value={sistema} onChange={(e) => setSistema(e.target.value)} maxLength={200} placeholder="CORREDERA XO"  />
        </div>
      </div>
      {codigoBloqueado && <p className="text-[11px] text-slate-500 -mt-2">El código no se cambia mientras el tipo tenga ventanas con posición: su nomenclatura depende de él.</p>}

      <Casilla checked={areaComun} onChange={setAreaComun} disabled={tipoBloqueado} label={<><span>
          <b>Área común / fachada</b> (sin medidas: muro cortina, antifuego, film…). Por ahora cuenta como una sola unidad.
        </span></>} />

      {!areaComun && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Input label={legacy ? 'Ancho' : 'Ancho plano'} id="tipo-ancho" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} placeholder="mm"  />
          </div>
          <div>
            <Input label={legacy ? 'Alto' : 'Alto plano'} id="tipo-alto" inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} placeholder="mm"  />
          </div>
          <div>
            <Input label="Cuadros" id="tipo-cuadros" inputMode="numeric" value={cuadros} onChange={(e) => setCuadros(e.target.value)}  />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!legacy && <div>
          <Input label={<>Precio unitario ({moneda})</>} id="tipo-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} className={`${precio.trim() !== '' && precioNum === null ? 'border-rose-300' : ''}`}  />
        </div>}
        <div>
          <Input label={legacy ? 'Cantidad fabricada' : 'Cantidad contratada'} id="tipo-contratadas" inputMode="numeric" value={contratadas} onChange={(e) => setContratadas(e.target.value)}  />
        </div>
      </div>

      {!areaComun && !legacy && (
        <div className="sm:max-w-[12rem]">
          <Input label="Holgura propia (mm)" id="tipo-holgura" inputMode="decimal" value={holgura} onChange={(e) => setHolgura(e.target.value)} placeholder="la de la cubicación"  />
        </div>
      )}
    </Modal>
  );
};
