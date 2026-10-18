import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Ruler } from 'lucide-react';
import { crearPendiente, getFabricacionDetalle, getFabricacionesProyecto, getMaterialesFabricacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import type {
  CargoPendiente,
  MotivoPendiente,
  Proyecto,
  TipoElementoPendiente,
} from '../../../types';
import { ETIQUETA_CARGO } from '../../../types';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { formatoMm } from '../fabricacion/utils';
import { AdjuntosNuevoPendiente } from './adjuntos/AdjuntosNuevoPendiente';
import { subirArchivos } from './adjuntos/subirArchivos';
import {
  ETIQUETA_DESTINO,
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  MOTIVOS_PENDIENTE,
  TIPOS_PENDIENTE,
  admiteRectificacion,
  areaDelPendiente,
  cargoDeMotivo,
  exigeResponsable,
  leerMilimetros,
  textoRectificacion,
  tituloPendiente,
  type DatosSugerencia,
} from './utils';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea, SelectCompacto, OpcionesTarjeta } from '../../../components/ui/Campos';
import { Buscador } from '../../../components/ui/Buscador';

interface Props {
  proyecto: Proyecto;
  onClose: () => void;
  onCreado: () => void;
}

const etiqueta = 'block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5';

// Crea un pendiente. Si la obra tiene documentos de fabricacion vinculados, se
// elige el documento y la ventana, y para un vidrio, hoja o material el sistema
// ofrece los de ESA ventana tal como se fabricaron (con su medida real: una
// ventana rectificada pide el vidrio rectificado) y arma la descripcion.
export const NuevoPendienteModal: React.FC<Props> = ({ proyecto, onClose, onCreado }) => {
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<TipoElementoPendiente>('VIDRIO');
  const [motivo, setMotivo] = useState<MotivoPendiente>('FALLA');
  const [fabElegida, setFabElegida] = useState('');
  const [filtroVentana, setFiltroVentana] = useState('');
  const [ventanaId, setVentanaId] = useState('');
  const [elementoId, setElementoId] = useState(''); // vidrio / hoja / material elegido de la ventana
  const [notas, setNotas] = useState('');
  const [responsable, setResponsable] = useState('');
  // A cargo de quien: '' = el que sugiere el motivo.
  const [cargo, setCargo] = useState<CargoPendiente | ''>('');
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
        origen: 'OBRA', // por ahora los pendientes solo se registran desde la obra
        tipo,
        motivo,
        descripcion: tituloPendiente(datosTitulo, notas),
        notas: notas.trim() || undefined,
        responsable: pideResponsable ? responsable.trim() : undefined,
        cargoA: cargo || undefined,
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
    <Modal
      titulo="Nuevo pendiente"
      ancho="lg"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!puedeCrear} isLoading={crear.isPending} onClick={() => crear.mutate()}>
            {subiendoAdjuntos ? 'Subiendo archivos…' : 'Ingresar pendiente'}
          </Button>
        </Modal.Pie>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Select label="Qué falta" id="pend-tipo" value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoElementoPendiente)}>
            {TIPOS_PENDIENTE.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Select label="Motivo" id="pend-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoPendiente)}>
            {MOTIVOS_PENDIENTE.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_MOTIVO[m]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Select label="A cargo de" id="pend-cargo" value={cargo} onChange={(e) => setCargo(e.target.value as CargoPendiente | '')}>
            <option value="">
              Según el motivo ({cargoDeMotivo(motivo) ? ETIQUETA_CARGO[cargoDeMotivo(motivo)!] : 'sin cargo aparte'})
            </option>
            {(['CLIENTE', 'INSTALADOR', 'MTW'] as CargoPendiente[]).map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CARGO[c]}
              </option>
            ))}
          </Select>
        </div>
        {pideResponsable && (
          <div className="sm:col-span-2">
            <Input label="Responsable"
              id="pend-responsable"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              maxLength={200}
              placeholder="Quién causó el daño" className={`${responsable.trim() ? '' : 'border-rose-300'}`} />
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500" data-testid="area-asignada">
        Se enviará a: <b className="text-slate-700">{ETIQUETA_DESTINO[area]}</b>
      </p>

      {/* Ventana del documento de fabricacion */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ventana (opcional)</p>
          {fabricaciones.length === 1 && <span className="text-[11px] text-slate-400 truncate">Documento: {fabricaciones[0].descripcion}</span>}
        </div>
        {fabricaciones.length === 0 ? (
          <p className="text-xs text-slate-500">
            Esta obra no tiene documentos de fabricación vinculados: describe lo que falta a mano, o vincula los documentos en la sección Fabricación para poder elegir la ventana.
          </p>
        ) : (
          <>
            {fabricaciones.length > 1 && (
              <div>
                <Select label="Documento de fabricación"
                  id="pend-doc"
                  value={fabId}
                  onChange={(e) => {
                    setFabElegida(e.target.value);
                    setVentanaId('');
                    setElementoId('');
                  }}>
                  <option value="">— elegir —</option>
                  {fabricaciones.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.descripcion || `Documento ${f.hetmoId}`}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {fabId && (
              <div className="space-y-2">
                <label htmlFor="pend-ventana" className="sr-only">
                  Ventana
                </label>
                {detalle.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando ventanas...
                  </div>
                ) : (
                  <>
                    {ventanas.length > 12 && (
                      <Buscador compacto valor={filtroVentana} onChange={setFiltroVentana} placeholder="Filtrar por posición o modelo…" etiqueta="Filtrar ventanas" />
                    )}
                    <div className="flex gap-2">
                      <SelectCompacto id="pend-ventana" value={ventanaId} onChange={(e) => cambiarVentana(e.target.value)}>
                        <option value="">— sin ventana —</option>
                        {ventanasFiltradas.map((v) => (
                          <option key={v.id} value={v.id}>
                            Pos {v.orden} · {v.modelo} · {formatoMm(v.anchoMm)} × {formatoMm(v.altoMm)} mm
                          </option>
                        ))}
                      </SelectCompacto>
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
                  <OpcionesTarjeta
                    columnas={2}
                    valor={elementoId}
                    onChange={elegirVidrio}
                    opciones={vidrios.map((v) => ({
                      value: String(v.material_hetmo),
                      label: `${formatoMm(v.ANCHO)} × ${formatoMm(v.ALTO)} mm`,
                      ayuda: `${v.codigo_articulo} · ${v.UDS} un`,
                    }))}
                  />
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
                  <SelectCompacto id="pend-hoja" value={elementoId} onChange={(e) => elegirHoja(e.target.value)}>
                    <option value="">— elegir hoja —</option>
                    {hojas.map((h) => (
                      <option key={h.id} value={h.id}>
                        Hoja {h.numeroCuadro} · {formatoMm(h.anchoMm)} × {formatoMm(h.altoMm)} mm
                      </option>
                    ))}
                  </SelectCompacto>
                )}
              </div>
            )}
            {ventana && tipo === 'MATERIAL' && mats.length > 0 && (
              <div>
                <Select label="Material de esta ventana" id="pend-material" value={elementoId} onChange={(e) => elegirMaterial(e.target.value)}>
                  <option value="">— elegir material —</option>
                  {mats.map((m, i) => (
                    <option key={`${m.codigo_articulo}-${i}`} value={String(i)}>
                      {m.familia ? `${m.familia} · ` : ''}
                      {m.descripcion_articulo} ({m.codigo_articulo})
                    </option>
                  ))}
                </Select>
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
                    <Input label="Ancho" id="pend-rect-ancho" inputMode="decimal" value={rectAncho} onChange={(e) => setRectAncho(e.target.value)} className={`${nuevoAncho === null ? 'border-rose-300' : ''}`} />
                  </div>
                  <div>
                    <Input label="Alto" id="pend-rect-alto" inputMode="decimal" value={rectAlto} onChange={(e) => setRectAlto(e.target.value)} className={`${nuevoAlto === null ? 'border-rose-300' : ''}`} />
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
        <Textarea label={<>Notas {notasObligatorias ? <span className="normal-case font-medium text-rose-600">· obligatorias para "Otro"</span> : <span className="normal-case font-medium text-slate-400">· opcional</span>}</>}
          id="pend-notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Qué falta o qué falló, piso/depto, cualquier detalle útil" className={`${notasObligatorias && !notas.trim() ? 'border-rose-300' : ''}`} />
      </div>
      <div className="sm:max-w-xs">
        <Input label="Se necesita para (opcional)" id="pend-fecha" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} />
      </div>

      <AdjuntosNuevoPendiente proyectoId={proyecto.id} archivos={adjuntos} onChange={setAdjuntos} disabled={crear.isPending} />
    </Modal>
  );
};
