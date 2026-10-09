import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { crearUnidadCubicacion, editarUnidadCubicacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { Cubicacion, TipoCubicacion, UnidadCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { leerMilimetros } from '../pendientes/utils';
import { cajaModal, campo, etiqueta, fondoModal } from './estilos';
import { generarNomenclatura, mmATexto } from './utils';

interface Props {
  proyectoId: string;
  cubicacion: Cubicacion;
  tipos: TipoCubicacion[];
  /** Si viene, se edita esa ventana; si no, se crea una. */
  unidad?: UnidadCubicacion;
  /** Valores de partida al crear (ej. el piso que se esta mirando). */
  inicial?: { torre?: string; piso?: number | '' };
  onClose: () => void;
}

const entero = (t: string): number | null => (t.trim() !== '' && /^-?\d+$/.test(t.trim()) ? Number(t.trim()) : null);

// Crea o edita una ventana fisica: su tipo, su posicion (torre / piso / depto -> nomenclatura final) y
// su rectificacion (rasgo medido en obra -> medida de fabricacion).
export const UnidadModal: React.FC<Props> = ({ proyectoId, cubicacion, tipos, unidad, inicial, onClose }) => {
  const queryClient = useQueryClient();
  const editando = !!unidad;
  const tiposVentana = tipos.filter((t) => !t.esAreaComun);
  const [tipoId, setTipoId] = useState(unidad?.tipoId ?? '');
  const [torre, setTorre] = useState(unidad?.torre ?? inicial?.torre ?? '');
  const [piso, setPiso] = useState(unidad?.piso != null ? String(unidad.piso) : inicial?.piso !== undefined && inicial.piso !== '' ? String(inicial.piso) : '');
  const [dpto, setDpto] = useState(unidad?.dpto != null ? String(unidad.dpto) : '');
  const [ubicacion, setUbicacion] = useState(unidad?.ubicacion ?? '');
  const [apertura, setApertura] = useState(unidad?.apertura ?? '');
  const [rasgoAncho, setRasgoAncho] = useState(mmATexto(unidad?.rasgoAnchoMm));
  const [rasgoAlto, setRasgoAlto] = useState(mmATexto(unidad?.rasgoAltoMm));

  const tipo = tiposVentana.find((t) => t.id === tipoId);
  const pisoNum = entero(piso);
  const dptoNum = entero(dpto);
  const anchoNum = leerMilimetros(rasgoAncho);
  const altoNum = leerMilimetros(rasgoAlto);
  const hayRasgo = rasgoAncho.trim() !== '' || rasgoAlto.trim() !== '';
  const holgura = tipo?.holguraMm ?? cubicacion.holguraMm;

  const nomenclatura = tipo ? generarNomenclatura(cubicacion.formatoNomenclatura, { codigo: tipo.codigo, torre, piso: pisoNum, dpto: dptoNum }) : null;
  const fab = anchoNum !== null && altoNum !== null ? { ancho: Math.round((anchoNum - holgura) * 100) / 100, alto: Math.round((altoNum - holgura) * 100) / 100 } : null;

  // Una ventana NUEVA va siempre con su lugar; una existente (que puede estar aun sin posicion) puede guardarse a medias.
  const valido =
    !!tipo &&
    (editando ? piso.trim() === '' || pisoNum !== null : pisoNum !== null) &&
    (editando ? dpto.trim() === '' || dptoNum !== null : dptoNum !== null) &&
    (!hayRasgo || (anchoNum !== null && altoNum !== null && !!fab && fab.ancho > 0 && fab.alto > 0));

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        tipoId,
        torre: torre.trim() || null,
        piso: pisoNum,
        dpto: dptoNum,
        ubicacion: ubicacion.trim() || null,
        apertura: apertura.trim() || null,
      };
      // El rasgo solo se manda si cambio: asi editar la posicion no vuelve a sellar quien/cuando rectifico.
      const nuevoAncho = hayRasgo ? anchoNum : null;
      const nuevoAlto = hayRasgo ? altoNum : null;
      if (!editando || nuevoAncho !== unidad!.rasgoAnchoMm || nuevoAlto !== unidad!.rasgoAltoMm) {
        Object.assign(datos, { rasgoAnchoMm: nuevoAncho, rasgoAltoMm: nuevoAlto });
      }
      return editando ? editarUnidadCubicacion(unidad!.id, datos) : crearUnidadCubicacion(proyectoId, datos);
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
    <div className={fondoModal} role="dialog" aria-modal="true" aria-label={editando ? 'Editar ventana' : 'Nueva ventana'}>
      <div className={`${cajaModal} max-w-lg`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">{editando ? `Ventana ${unidad!.nomenclatura ?? unidad!.codigo}` : 'Nueva ventana'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="uni-tipo" className={etiqueta}>
            Tipo
          </label>
          <select id="uni-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={campo}>
            <option value="">— elegir tipo —</option>
            {tiposVentana.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} · {t.sistema}
                {t.anchoPlanoMm != null ? ` · ${formatoMm(t.anchoPlanoMm)} × ${formatoMm(t.altoPlanoMm)} mm` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="uni-torre" className={etiqueta}>
              Torre
            </label>
            <input id="uni-torre" value={torre} onChange={(e) => setTorre(e.target.value.toUpperCase())} maxLength={10} placeholder="A" className={campo} />
          </div>
          <div>
            <label htmlFor="uni-piso" className={etiqueta}>
              Piso
            </label>
            <input id="uni-piso" inputMode="numeric" value={piso} onChange={(e) => setPiso(e.target.value)} className={`${campo} ${piso.trim() !== '' && pisoNum === null ? 'border-rose-300' : ''}`} />
          </div>
          <div>
            <label htmlFor="uni-dpto" className={etiqueta}>
              Depto
            </label>
            <input id="uni-dpto" inputMode="numeric" value={dpto} onChange={(e) => setDpto(e.target.value)} className={`${campo} ${dpto.trim() !== '' && dptoNum === null ? 'border-rose-300' : ''}`} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500 -mt-2">
          Nomenclatura:{' '}
          <b className="font-mono text-slate-800" data-testid="nomenclatura-vista">
            {nomenclatura ?? (tipo ? `${tipo.codigo} (sin posición: falta piso y depto)` : '—')}
          </b>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="uni-ubicacion" className={etiqueta}>
              Ubicación
            </label>
            <input id="uni-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={100} placeholder="DORM 1, ESTAR, BAÑO 1…" className={campo} />
          </div>
          <div>
            <label htmlFor="uni-apertura" className={etiqueta}>
              Apertura
            </label>
            <input id="uni-apertura" value={apertura} onChange={(e) => setApertura(e.target.value)} maxLength={50} className={campo} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rectificación (lo medido en obra)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="uni-rasgo-ancho" className={etiqueta}>
                Rasgo ancho (mm)
              </label>
              <input id="uni-rasgo-ancho" inputMode="decimal" value={rasgoAncho} onChange={(e) => setRasgoAncho(e.target.value)} className={`${campo} ${hayRasgo && anchoNum === null ? 'border-rose-300' : ''}`} />
            </div>
            <div>
              <label htmlFor="uni-rasgo-alto" className={etiqueta}>
                Rasgo alto (mm)
              </label>
              <input id="uni-rasgo-alto" inputMode="decimal" value={rasgoAlto} onChange={(e) => setRasgoAlto(e.target.value)} className={`${campo} ${hayRasgo && altoNum === null ? 'border-rose-300' : ''}`} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            {tipo?.anchoPlanoMm != null && <>Plano: {formatoMm(tipo.anchoPlanoMm)} × {formatoMm(tipo.altoPlanoMm)} mm. </>}
            Fabricación = rasgo − {formatoMm(holgura)} mm:{' '}
            <b className="font-mono text-slate-800" data-testid="fabricacion-vista">
              {fab ? `${formatoMm(fab.ancho)} × ${formatoMm(fab.alto)} mm` : '—'}
            </b>
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!valido} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            {editando ? 'Guardar' : 'Agregar ventana'}
          </Button>
        </div>
      </div>
    </div>
  );
};
