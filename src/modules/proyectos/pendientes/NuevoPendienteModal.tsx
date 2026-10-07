import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Ruler, X } from 'lucide-react';
import { crearPendiente, getFabricacionDetalle, getFabricacionesProyecto, getMaterialesFabricacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import type {
  MotivoPendiente,
  OrigenPendiente,
  Proyecto,
  TipoElementoPendiente,
} from '../../../types';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { formatoMm } from '../fabricacion/utils';
import { AdjuntosNuevoPendiente } from './adjuntos/AdjuntosNuevoPendiente';
import { subirArchivos } from './adjuntos/subirArchivos';
import {
  ETIQUETA_DESTINO,
  ETIQUETA_MOTIVO,
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO,
  MOTIVOS_PENDIENTE,
  ORIGENES_PENDIENTE,
  TIPOS_PENDIENTE,
  admiteRectificacion,
  areaDelPendiente,
  exigeResponsable,
  leerMilimetros,
  textoRectificacion,
  tituloPendiente,
  type DatosSugerencia,
} from './utils';

interface Props {
  proyecto: Proyecto;
  onClose: () => void;
  onCreado: () => void;
}

const campo =
  'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600';
const etiqueta = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5';

// Opciones excluyentes como botones (origen y destino): dos o tres, siempre a la vista.
function Segmentado<T extends string>({
  valor,
  opciones,
  etiquetas,
  onChange,
  nombre,
}: {
  valor: T;
  opciones: T[];
  etiquetas: Record<T, string>;
  onChange: (v: T) => void;
  nombre: string;
}) {
  return (
    <div role="radiogroup" aria-label={nombre} className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          onClick={() => onChange(o)}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
            valor === o ? 'bg-white text-brand-700 shadow-xs border border-slate-200' : 'text-slate-500 hover:text-slate-800 border border-transparent'
          }`}
        >
          {etiquetas[o]}
        </button>
      ))}
    </div>
  );
}

// Crea un pendiente. Si la obra tiene documentos de fabricacion vinculados, se
// elige el documento y la ventana, y para un vidrio, hoja o material el sistema
// ofrece los de ESA ventana tal como se fabricaron (con su medida real: una
// ventana rectificada pide el vidrio rectificado) y arma la descripcion.
export const NuevoPendienteModal: React.FC<Props> = ({ proyecto, onClose, onCreado }) => {
  const queryClient = useQueryClient();

  const [origen, setOrigen] = useState<OrigenPendiente>('OBRA');
  const [tipo, setTipo] = useState<TipoElementoPendiente>('VIDRIO');
  const [motivo, setMotivo] = useState<MotivoPendiente>('FALLA');
  const [fabElegida, setFabElegida] = useState('');
  const [filtroVentana, setFiltroVentana] = useState('');
  const [ventanaId, setVentanaId] = useState('');
  const [elementoId, setElementoId] = useState(''); // vidrio / hoja / material elegido de la ventana
  const [notas, setNotas] = useState('');
  const [responsable, setResponsable] = useState('');
  // Rectificacion de medidas (solo ventana o vidrio elegidos)
  const [rectificando, setRectificando] = useState(false);
  const [rectAncho, setRectAncho] = useState('');
  const [rectAlto, setRectAlto] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState('');
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [subiendoAdjuntos, setSubiendoAdjuntos] = useState(false);

  const { data: fabricaciones = [] } = useQuery({
    queryKey: ['fabricaciones', proyecto.id],
    queryFn: () => getFabricacionesProyecto(proyecto.id),
  });
  // Con un solo documento no hay nada que elegir.
  const fabId = fabElegida || (fabricaciones.length === 1 ? fabricaciones[0].id : '');

  const detalle = useQuery({
    queryKey: ['fabricacionDetalle', proyecto.id, fabId],
    queryFn: () => getFabricacionDetalle(proyecto.id, fabId),
    enabled: !!fabId,
  });
  const usaMateriales = tipo === 'VIDRIO' || tipo === 'MATERIAL';
  const materiales = useQuery({
    queryKey: ['fabricacionMateriales', proyecto.id, fabId],
    queryFn: () => getMaterialesFabricacion(proyecto.id, fabId),
    enabled: !!fabId && usaMateriales,
    staleTime: 1000 * 60,
    refetchInterval: false,
  });

  const ventanas = useMemo(() => (detalle.data?.ventanas ?? []).filter((v) => !v.retirada), [detalle.data]);
  const ventanasFiltradas = useMemo(() => {
    const f = filtroVentana.trim().toLowerCase();
    return f ? ventanas.filter((v) => `${v.orden} ${v.modelo}`.toLowerCase().includes(f)) : ventanas;
  }, [ventanas, filtroVentana]);
  const ventana = ventanas.find((v) => v.id === ventanaId);
  const entrada = materiales.data?.ventanas.find((e) => e.ventana.id === ventanaId);
  const vidrios = entrada?.vidrios ?? [];
  const mats = entrada?.materiales ?? [];
  const hojas = (ventana?.cuadros ?? []).filter((c) => c.tipo === 'HOJA' && !c.retirada);

  // Medida de lo que se puede rectificar: la ventana elegida (tipo Ventana) o el vidrio
  // elegido (tipo Vidrio). En los demas casos la rectificacion no aplica.
  const vidrioElegido = tipo === 'VIDRIO' && elementoId ? vidrios.find((x) => String(x.material_hetmo) === elementoId) : undefined;
  const medidaOriginal =
    tipo === 'VENTANA' && ventana && ventana.anchoMm != null && ventana.altoMm != null
      ? { ancho: Number(ventana.anchoMm), alto: Number(ventana.altoMm) }
      : vidrioElegido
        ? { ancho: Number(vidrioElegido.ANCHO), alto: Number(vidrioElegido.ALTO) }
        : null;
  const textoMedida = (n: number) => String(n).replace('.', ',');
  const cerrarRectificacion = () => {
    setRectificando(false);
    setRectAncho('');
    setRectAlto('');
  };
  const abrirRectificacion = () => {
    if (!medidaOriginal) return;
    setRectAncho(textoMedida(medidaOriginal.ancho));
    setRectAlto(textoMedida(medidaOriginal.alto));
    setRectificando(true);
  };
  const nuevoAncho = leerMilimetros(rectAncho);
  const nuevoAlto = leerMilimetros(rectAlto);
  const rectificacionValida =
    !!medidaOriginal && nuevoAncho !== null && nuevoAlto !== null && (nuevoAncho !== medidaOriginal.ancho || nuevoAlto !== medidaOriginal.alto);

  const cambiarTipo = (t: TipoElementoPendiente) => {
    setTipo(t);
    setElementoId('');
    cerrarRectificacion();
  };
  const cambiarVentana = (id: string) => {
    setVentanaId(id);
    setElementoId('');
    cerrarRectificacion();
  };
  const elegirVidrio = (id: string) => {
    setElementoId(id);
    cerrarRectificacion();
  };
  const elegirHoja = (id: string) => setElementoId(id);
  const elegirMaterial = (id: string) => setElementoId(id);

  // Titulo del pendiente: lo arma el sistema con lo elegido (ya no se escribe a mano).
  const datosTitulo: DatosSugerencia = { tipo, ventanaModelo: ventana?.modelo };
  if (tipo === 'VIDRIO' && vidrioElegido) datosTitulo.vidrio = { codigo: vidrioElegido.codigo_articulo, ancho: vidrioElegido.ANCHO, alto: vidrioElegido.ALTO };
  const hojaElegida = tipo === 'HOJA' && elementoId ? hojas.find((x) => x.id === elementoId) : undefined;
  if (hojaElegida) datosTitulo.hoja = { numero: hojaElegida.numeroCuadro, ancho: hojaElegida.anchoMm, alto: hojaElegida.altoMm };
  const materialElegido = tipo === 'MATERIAL' && elementoId ? mats[Number(elementoId)] : undefined;
  if (materialElegido) datosTitulo.material = { codigo: materialElegido.codigo_articulo, descripcion: materialElegido.descripcion_articulo };

  const area = areaDelPendiente(tipo, motivo);
  const pideResponsable = exigeResponsable(motivo);
  const notasObligatorias = tipo === 'OTRO';
  const puedeCrear =
    (!notasObligatorias || !!notas.trim()) && (!pideResponsable || !!responsable.trim()) && (!rectificando || rectificacionValida);

  const crear = useMutation({
    mutationFn: async () => {
      const creado = await crearPendiente(proyecto.id, {
        origen,
        tipo,
        motivo,
        descripcion: tituloPendiente(datosTitulo, notas),
        notas: notas.trim() || undefined,
        responsable: pideResponsable ? responsable.trim() : undefined,
        rectificacion:
          rectificando && rectificacionValida && medidaOriginal
            ? { anchoMm: nuevoAncho!, altoMm: nuevoAlto!, anchoOriginalMm: medidaOriginal.ancho, altoOriginalMm: medidaOriginal.alto }
            : undefined,
        ventanaRef: ventana ? `Pos ${ventana.orden} · ${ventana.modelo}` : undefined,
        fabricacionVentanaId: ventana?.id,
        fabricacionCuadroId: tipo === 'HOJA' && elementoId ? elementoId : undefined,
        fechaRequerida: fechaRequerida || undefined,
      });
      // El pendiente ya existe: si algun adjunto falla se avisa, pero el pendiente NO se pierde
      // (los archivos se pueden agregar de nuevo desde su detalle).
      if (adjuntos.length > 0) {
        setSubiendoAdjuntos(true);
        const r = await subirArchivos(creado.id, adjuntos);
        setSubiendoAdjuntos(false);
        if (r.fallidos.length) {
          mostrarToast(`El pendiente se creó, pero no se pudo subir: ${r.fallidos.join(' · ')}. Agrégalo desde su detalle.`);
        }
      }
      return creado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendientes', proyecto.id] });
      onCreado();
    },
    onError: (e) => {
      setSubiendoAdjuntos(false);
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const sinMateriales = usaMateriales && !!ventana && !materiales.isLoading && (materiales.isError || (vidrios.length === 0 && mats.length === 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">Nuevo pendiente</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className={etiqueta}>Origen</span>
            <Segmentado valor={origen} opciones={ORIGENES_PENDIENTE} etiquetas={ETIQUETA_ORIGEN} onChange={setOrigen} nombre="Origen" />
          </div>
          <div>
            <label htmlFor="pend-tipo" className={etiqueta}>
              Qué falta
            </label>
            <select id="pend-tipo" value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoElementoPendiente)} className={campo}>
              {TIPOS_PENDIENTE.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pend-motivo" className={etiqueta}>
              Motivo
            </label>
            <select id="pend-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoPendiente)} className={campo}>
              {MOTIVOS_PENDIENTE.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MOTIVO[m]}
                </option>
              ))}
            </select>
          </div>
          {pideResponsable && (
            <div className="sm:col-span-2">
              <label htmlFor="pend-responsable" className={etiqueta}>
                Responsable
              </label>
              <input
                id="pend-responsable"
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                maxLength={200}
                placeholder="Quién causó el daño"
                className={`${campo} ${responsable.trim() ? '' : 'border-rose-300'}`}
              />
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-500" data-testid="area-asignada">
          Se enviará a: <b className="text-slate-700">{ETIQUETA_DESTINO[area]}</b>
        </p>

        {/* Ventana del documento de fabricacion */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ventana (opcional)</p>
          {fabricaciones.length === 0 ? (
            <p className="text-xs text-slate-500">
              Esta obra no tiene documentos de fabricación vinculados: describe lo que falta a mano, o vincula los documentos en la sección Fabricación para poder elegir la ventana.
            </p>
          ) : (
            <>
              {fabricaciones.length > 1 && (
                <div>
                  <label htmlFor="pend-doc" className={etiqueta}>
                    Documento de fabricación
                  </label>
                  <select
                    id="pend-doc"
                    value={fabId}
                    onChange={(e) => {
                      setFabElegida(e.target.value);
                      setVentanaId('');
                      setElementoId('');
                    }}
                    className={campo}
                  >
                    <option value="">— elegir —</option>
                    {fabricaciones.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.descripcion || `Documento ${f.hetmoId}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {fabId && (
                <div className="space-y-2">
                  <label htmlFor="pend-ventana" className={etiqueta}>
                    Ventana {fabricaciones.length === 1 && <span className="normal-case font-medium text-slate-400">· {fabricaciones[0].descripcion}</span>}
                  </label>
                  {detalle.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando ventanas...
                    </div>
                  ) : (
                    <>
                      {ventanas.length > 12 && (
                        <input
                          value={filtroVentana}
                          onChange={(e) => setFiltroVentana(e.target.value)}
                          placeholder="Filtrar por posición o modelo..."
                          aria-label="Filtrar ventanas"
                          className={campo}
                        />
                      )}
                      <div className="flex gap-2">
                        <select
                          id="pend-ventana"
                          value={ventanaId}
                          onChange={(e) => cambiarVentana(e.target.value)}
                          className={campo}
                        >
                          <option value="">— sin ventana —</option>
                          {ventanasFiltradas.map((v) => (
                            <option key={v.id} value={v.id}>
                              Pos {v.orden} · {v.modelo} · {formatoMm(v.anchoMm)} × {formatoMm(v.altoMm)} mm
                            </option>
                          ))}
                        </select>
                        {admiteRectificacion(tipo) && (
                          <Button
                            type="button"
                            size="sm"
                            variant={rectificando ? 'secondary' : 'outline'}
                            leftIcon={<Ruler className="w-3.5 h-3.5" />}
                            disabled={!medidaOriginal}
                            onClick={() => (rectificando ? cerrarRectificacion() : abrirRectificacion())}
                            title={medidaOriginal ? 'Cambiar las medidas de lo que se pide' : tipo === 'VIDRIO' ? 'Elige primero el vidrio' : 'Elige primero la ventana'}
                            className="shrink-0"
                          >
                            Rectificar
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Que elemento de esa ventana: depende del tipo */}
              {ventana && tipo === 'VIDRIO' && (
                <div>
                  <span className={etiqueta}>Vidrio de esta ventana</span>
                  {materiales.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Leyendo vidrios de HETMO...
                    </div>
                  ) : vidrios.length > 0 ? (
                    <div className="space-y-1.5">
                      {vidrios.map((v) => (
                        <label key={v.material_hetmo} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="radio"
                            name="vidrio"
                            checked={elementoId === String(v.material_hetmo)}
                            onChange={() => elegirVidrio(String(v.material_hetmo))}
                          />
                          <span className="font-mono text-slate-500">{v.codigo_articulo}</span>
                          <span className="font-bold text-slate-800">
                            {formatoMm(v.ANCHO)} × {formatoMm(v.ALTO)} mm
                          </span>
                          <span className="text-slate-400">· {v.UDS} un</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
              {ventana && tipo === 'HOJA' && (
                <div>
                  <label htmlFor="pend-hoja" className={etiqueta}>
                    Hoja de esta ventana
                  </label>
                  {hojas.length === 0 ? (
                    <p className="text-xs text-slate-500">El documento no trae las hojas de esta ventana (aparecen cuando se optimiza el corte). Descríbela a mano.</p>
                  ) : (
                    <select id="pend-hoja" value={elementoId} onChange={(e) => elegirHoja(e.target.value)} className={campo}>
                      <option value="">— elegir hoja —</option>
                      {hojas.map((h) => (
                        <option key={h.id} value={h.id}>
                          Hoja {h.numeroCuadro} · {formatoMm(h.anchoMm)} × {formatoMm(h.altoMm)} mm
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {ventana && tipo === 'MATERIAL' && mats.length > 0 && (
                <div>
                  <label htmlFor="pend-material" className={etiqueta}>
                    Material de esta ventana
                  </label>
                  <select id="pend-material" value={elementoId} onChange={(e) => elegirMaterial(e.target.value)} className={campo}>
                    <option value="">— elegir material —</option>
                    {mats.map((m, i) => (
                      <option key={`${m.codigo_articulo}-${i}`} value={String(i)}>
                        {m.familia ? `${m.familia} · ` : ''}
                        {m.descripcion_articulo} ({m.codigo_articulo})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {sinMateriales && (
                <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No se pudieron leer los materiales de esta ventana desde HETMO. Descríbelo en las notas.</span>
                </div>
              )}
              {rectificando && medidaOriginal && (
                <div className="rounded-lg border border-brand-200 bg-white p-3 space-y-2" data-testid="panel-rectificar">
                  <p className="text-xs font-bold text-slate-700">
                    {tipo === 'VIDRIO' ? 'Medidas del vidrio a pedir' : 'Medidas rectificadas de la ventana'} (mm)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="pend-rect-ancho" className={etiqueta}>
                        Ancho
                      </label>
                      <input id="pend-rect-ancho" inputMode="decimal" value={rectAncho} onChange={(e) => setRectAncho(e.target.value)} className={`${campo} ${nuevoAncho === null ? 'border-rose-300' : ''}`} />
                    </div>
                    <div>
                      <label htmlFor="pend-rect-alto" className={etiqueta}>
                        Alto
                      </label>
                      <input id="pend-rect-alto" inputMode="decimal" value={rectAlto} onChange={(e) => setRectAlto(e.target.value)} className={`${campo} ${nuevoAlto === null ? 'border-rose-300' : ''}`} />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Original: {formatoMm(medidaOriginal.ancho)} × {formatoMm(medidaOriginal.alto)} mm.{' '}
                    {rectificacionValida && nuevoAncho !== null && nuevoAlto !== null ? (
                      <span className="text-brand-700 font-bold">
                        {textoRectificacion({
                          anchoOriginalMm: String(medidaOriginal.ancho),
                          altoOriginalMm: String(medidaOriginal.alto),
                          anchoRectificadoMm: String(nuevoAncho),
                          altoRectificadoMm: String(nuevoAlto),
                        })}
                        {tipo === 'VENTANA' ? ' — se envía a Fábrica junto con la solicitud.' : ''}
                      </span>
                    ) : (
                      <span className="text-amber-700">Cambia al menos una medida (números positivos en mm).</span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label htmlFor="pend-notas" className={etiqueta}>
            Notas {notasObligatorias ? <span className="normal-case font-medium text-rose-600">· obligatorias para "Otro"</span> : <span className="normal-case font-medium text-slate-400">· opcional</span>}
          </label>
          <textarea
            id="pend-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Qué falta o qué falló, piso/depto, cualquier detalle útil"
            className={`${campo} ${notasObligatorias && !notas.trim() ? 'border-rose-300' : ''}`}
          />
        </div>
        <div className="sm:max-w-xs">
          <label htmlFor="pend-fecha" className={etiqueta}>
            Se necesita para (opcional)
          </label>
          <input id="pend-fecha" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} className={campo} />
        </div>

        <AdjuntosNuevoPendiente proyectoId={proyecto.id} archivos={adjuntos} onChange={setAdjuntos} disabled={crear.isPending} />

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!puedeCrear} isLoading={crear.isPending} onClick={() => crear.mutate()}>
            {subiendoAdjuntos ? 'Subiendo archivos…' : 'Ingresar pendiente'}
          </Button>
        </div>
      </div>
    </div>
  );
};
