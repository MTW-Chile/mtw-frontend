import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearUnidadCubicacion, editarUnidadCubicacion, getFichaVentana } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ConfigCubicacion, TipoCubicacion, UnidadCubicacion, Proyecto } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { leerMilimetros } from '../pendientes/utils';
import { campo } from './estilos';
import { generarNomenclatura, mmATexto } from './utils';
import { vocabulario } from './vocabulario';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Aviso } from '../../../components/ui/Aviso';
import { describirVentana } from '../obra/descripcionVentana';
import { DibujoVentana } from '../obra/DibujoVentana';

interface Props {
  proyectoId: string;
  cubicacion: ConfigCubicacion;
  tipos: TipoCubicacion[];
  /** Si viene, se edita esa ventana; si no, se crea una. */
  unidad?: UnidadCubicacion;
  /** Valores de partida al crear (ej. el piso que se esta mirando). */
  inicial?: { torre?: string; piso?: number | '' };
  /** Obra legacy: las medidas vienen finales del documento de fabricación; no se rectifica. */
  legacy?: boolean;
  onClose: () => void;
}

const entero = (t: string): number | null => (t.trim() !== '' && /^-?\d+$/.test(t.trim()) ? Number(t.trim()) : null);

// Crea o edita una ventana fisica: su tipo, su posicion (torre / piso / nombre de la unidad -> nomenclatura
// final) y su rectificacion (rasgo medido en obra -> medida de fabricacion).
export const UnidadModal: React.FC<Props> = ({ proyectoId, cubicacion, tipos, unidad, inicial, legacy, onClose }) => {
  const queryClient = useQueryClient();
  const editando = !!unidad;
  const voc = vocabulario(cubicacion.modo, queryClient.getQueryData<Proyecto>(['proyectoDetail', proyectoId])?.obra);
  const casa = voc.modo === 'CASA';
  const tiposVentana = tipos.filter((t) => !t.esAreaComun);
  const [tipoId, setTipoId] = useState(unidad?.tipoId ?? '');
  const [torre, setTorre] = useState(unidad?.torre ?? inicial?.torre ?? '');
  const [piso, setPiso] = useState(unidad?.piso != null ? String(unidad.piso) : inicial?.piso !== undefined && inicial.piso !== '' ? String(inicial.piso) : '');
  const [nombreUnidad, setNombreUnidad] = useState(unidad?.nombreUnidad ?? '');
  const [ubicacion, setUbicacion] = useState(unidad?.ubicacion ?? '');
  const [rasgoAncho, setRasgoAncho] = useState(mmATexto(unidad?.rasgoAnchoMm));
  const [rasgoAlto, setRasgoAlto] = useState(mmATexto(unidad?.rasgoAltoMm));

  const tipo = tiposVentana.find((t) => t.id === tipoId);
  // Ventana que vino de un documento de fabricación (obra legacy): su dibujo y su descripción salen de ese documento,
  // con la misma ficha que usa Instalación (misma clave de caché).
  const deDocumento = legacy && editando && !!unidad!.documento;
  const ficha = useQuery({ queryKey: ['fichaVentana', proyectoId, unidad?.id], queryFn: () => getFichaVentana(proyectoId, unidad!.id), enabled: deDocumento, staleTime: 60_000, retry: false });
  const fv = ficha.data?.fabricacionVentana ?? null;
  // Misma descripción que la ficha y el PDF: la apertura sale de la geometría; sin dibujo, queda el texto del documento.
  const descrita = describirVentana(ficha.data?.dibujo);
  const descripcionDoc = descrita ? [descrita.apertura, descrita.composicion].filter(Boolean).join(' · ') : fv?.descripcionCorta || unidad?.sistema;
  const pisoNum = entero(piso);
  const anchoNum = leerMilimetros(rasgoAncho);
  const altoNum = leerMilimetros(rasgoAlto);
  const hayRasgo = rasgoAncho.trim() !== '' || rasgoAlto.trim() !== '';
  const holgura = tipo?.holguraMm ?? cubicacion.holguraMm;

  const nomenclatura = tipo ? generarNomenclatura(cubicacion.formatoNomenclatura, { codigo: tipo.codigo, torre, nombreUnidad: nombreUnidad.trim() || null }) : null;
  const fab = anchoNum !== null && altoNum !== null ? { ancho: Math.round((anchoNum - holgura) * 100) / 100, alto: Math.round((altoNum - holgura) * 100) / 100 } : null;

  // Una ventana NUEVA va siempre con su lugar; una existente (que puede estar aun sin posicion) puede guardarse a medias.
  const valido =
    !!tipo &&
    (editando ? piso.trim() === '' || pisoNum !== null : pisoNum !== null) &&
    (editando ? true : nombreUnidad.trim() !== '') &&
    (!hayRasgo || (anchoNum !== null && altoNum !== null && !!fab && fab.ancho > 0 && fab.alto > 0));

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        tipoId,
        torre: torre.trim() || null,
        piso: pisoNum,
        nombreUnidad: nombreUnidad.trim() || null,
        ubicacion: ubicacion.trim() || null,
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
    <Modal
      titulo={editando ? `Ventana ${unidad!.nomenclatura ?? unidad!.codigo}` : 'Nueva ventana'}
      ancho="lg"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!valido} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            {editando ? 'Guardar' : 'Agregar ventana'}
          </Button>
        </Modal.Pie>
      }
    >
      {/* Dibujo a la izquierda en pantallas anchas; arriba, a lo ancho, en el celular. */}
      <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
      {deDocumento ? (
        <DibujoVentana proyectoId={proyectoId} ventana={ficha.data?.dibujo ?? null} lineaHetmo={ficha.data && !ficha.data.dibujo ? fv?.hetmoVentanaMadreId : undefined} className="h-44 md:h-full md:min-h-72" etiqueta={`Dibujo de ${unidad!.nomenclatura ?? unidad!.codigo}`} />
      ) : (
        <DibujoVentana proyectoId={proyectoId} ventanaId={tipo?.ventanaId} lineaHetmo={tipo?.lineaHetmo} className="h-44 md:h-full md:min-h-72" etiqueta={tipo && !legacy ? `Dibujo del tipo ${tipo.codigo}` : 'Dibujo de la ventana'} />
      )}
      <div className="space-y-4 min-w-0">
      {/* Obra legacy: no hay tipos, solo ventanas; la ventana es la que vino de su documento de fabricación. */}
      {!legacy && <div>
        <Select label="Tipo" id="uni-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={campo}>
          <option value="">— elegir tipo —</option>
          {tiposVentana.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} · {t.sistema}
              {t.anchoPlanoMm != null ? ` · ${formatoMm(t.anchoPlanoMm)} × ${formatoMm(t.altoPlanoMm)} mm` : ''}
            </option>
          ))}
        </Select>
      </div>}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Input label={casa ? 'Casa' : 'Torre'} id="uni-torre" value={torre} onChange={(e) => setTorre(e.target.value.toUpperCase())} maxLength={10} placeholder={casa ? 'C1' : 'A'} />
        </div>
        <div>
          <Input label="Piso" id="uni-piso" inputMode="numeric" value={piso} onChange={(e) => setPiso(e.target.value)} className={`${piso.trim() !== '' && pisoNum === null ? 'border-rose-300' : ''}`} />
        </div>
        <div>
          <Input label={casa ? 'Recinto' : 'Depto'} id="uni-dpto" value={nombreUnidad} onChange={(e) => setNombreUnidad(e.target.value)} maxLength={40} placeholder={casa ? 'DORM 1' : '204'} />
        </div>
      </div>
      {/* En la obra legacy no se asigna nomenclatura: la ventana conserva el nombre de su documento de fabricación. */}
      {!legacy && <p className="text-[11px] text-slate-500 -mt-2">
        Nomenclatura:{' '}
        <b className="font-mono text-slate-800" data-testid="nomenclatura-vista">
          {nomenclatura ?? (tipo ? `${tipo.codigo} (sin posición: falta el ${voc.unidadCorta})` : '—')}
        </b>
      </p>}

      <div>
        <Input label="Ubicación" id="uni-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={100} placeholder="DORM 1, ESTAR, BAÑO 1…" />
      </div>

      {/* Conciliación con la planilla de control: sin fabricar, reposición o fuera de planilla. */}
      {legacy && editando && !unidad!.documento && (
        <Aviso tono="advertencia" titulo="Sin fabricar">
          La planilla de control espera esta ventana y ningún documento de fabricación la trae todavía. Cuando se vincule su documento, toma sola su nombre, su medida y su dibujo.
        </Aviso>
      )}
      {legacy && editando && unidad!.documento && unidad!.fabricacionesAnteriores.length > 0 && (
        <Aviso tono="neutro" titulo={`Reposición: fabricada ${unidad!.fabricacionesAnteriores.length + 1} veces`}>
          Vale la de <b>{unidad!.documento.nombre}</b> (la más nueva). Reemplazó a: {unidad!.fabricacionesAnteriores.map((f) => f.nombre).join(', ')}.
        </Aviso>
      )}
      {legacy && editando && unidad!.documento && unidad!.fueraDePlanilla && (
        <Aviso tono="advertencia" titulo="La planilla no la pide">
          Ninguna fila de la planilla de control reconoce esta ventana. Revisa su nombre en el documento o corrige la planilla.
        </Aviso>
      )}
      {legacy && editando && !unidad!.documento ? null : legacy ? (
        <p className="text-[11px] text-slate-500">
          {descripcionDoc && <>Descripción: <b className="text-slate-800">{descripcionDoc}</b> · </>}
          Medida final: <b className="font-mono text-slate-800">{unidad?.anchoFabricacionMm != null ? `${formatoMm(unidad.anchoFabricacionMm)} × ${formatoMm(unidad.altoFabricacionMm)} mm` : '—'}</b>
          {unidad?.documento && <> · documento <b>{unidad.documento.nombre}</b></>}. Viene del documento de fabricación; un cambio de medida se pide como pendiente.
        </p>
      ) : (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rectificación (lo medido en obra)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input label="Rasgo ancho (mm)" id="uni-rasgo-ancho" inputMode="decimal" value={rasgoAncho} onChange={(e) => setRasgoAncho(e.target.value)} className={`${hayRasgo && anchoNum === null ? 'border-rose-300' : ''}`} />
          </div>
          <div>
            <Input label="Rasgo alto (mm)" id="uni-rasgo-alto" inputMode="decimal" value={rasgoAlto} onChange={(e) => setRasgoAlto(e.target.value)} className={`${hayRasgo && altoNum === null ? 'border-rose-300' : ''}`} />
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
      )}
      </div>
      </div>
    </Modal>
  );
};
