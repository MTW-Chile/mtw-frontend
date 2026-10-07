import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { crearPendiente, getFabricacionDetalle, getFabricacionesProyecto, getMaterialesFabricacion } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import type {
  DestinoPendiente,
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
  DESTINOS_PENDIENTE,
  ETIQUETA_DESTINO,
  ETIQUETA_MOTIVO,
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO,
  MOTIVOS_PENDIENTE,
  ORIGENES_PENDIENTE,
  TIPOS_PENDIENTE,
  sugerirDescripcion,
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
  const [destino, setDestino] = useState<DestinoPendiente>('COMPRAS');
  const [tipo, setTipo] = useState<TipoElementoPendiente>('VIDRIO');
  const [motivo, setMotivo] = useState<MotivoPendiente>('FALLA');
  const [fabElegida, setFabElegida] = useState('');
  const [filtroVentana, setFiltroVentana] = useState('');
  const [ventanaId, setVentanaId] = useState('');
  const [elementoId, setElementoId] = useState(''); // vidrio / hoja / material elegido de la ventana
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [ubicacion, setUbicacion] = useState('');
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

  const cambiarTipo = (t: TipoElementoPendiente) => {
    setTipo(t);
    setElementoId('');
  };
  const cambiarVentana = (id: string) => {
    setVentanaId(id);
    setElementoId('');
    // Para el tipo VENTANA basta con elegir la ventana: sugiere la descripcion.
    const v = ventanas.find((x) => x.id === id);
    if (tipo === 'VENTANA' && v && !descripcion.trim()) setDescripcion(sugerirDescripcion({ tipo: 'VENTANA', ventanaModelo: v.modelo }));
  };

  const elegirVidrio = (id: string) => {
    const v = vidrios.find((x) => String(x.material_hetmo) === id);
    if (!v) return;
    setElementoId(id);
    setDescripcion(sugerirDescripcion({ tipo: 'VIDRIO', vidrio: { codigo: v.codigo_articulo, ancho: v.ANCHO, alto: v.ALTO } }));
    setCantidad(String(Math.max(1, Math.round(v.UDS))));
  };
  const elegirHoja = (id: string) => {
    const h = hojas.find((x) => x.id === id);
    if (!h) return;
    setElementoId(id);
    setDescripcion(sugerirDescripcion({ tipo: 'HOJA', hoja: { numero: h.numeroCuadro, ancho: h.anchoMm, alto: h.altoMm } }));
  };
  const elegirMaterial = (id: string) => {
    const m = mats[Number(id)];
    if (!m) return;
    setElementoId(id);
    setDescripcion(sugerirDescripcion({ tipo: 'MATERIAL', material: { codigo: m.codigo_articulo, descripcion: m.descripcion_articulo } }));
  };

  const cantidadNum = Number(cantidad);
  const cantidadValida = Number.isInteger(cantidadNum) && cantidadNum >= 1;
  const puedeCrear = !!descripcion.trim() && cantidadValida;

  const crear = useMutation({
    mutationFn: async () => {
      const creado = await crearPendiente(proyecto.id, {
        origen,
        destino,
        tipo,
        motivo,
        descripcion: descripcion.trim(),
        cantidad: cantidadNum,
        ubicacion: ubicacion.trim() || undefined,
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
            <span className={etiqueta}>Lo levanta</span>
            <Segmentado valor={origen} opciones={ORIGENES_PENDIENTE} etiquetas={ETIQUETA_ORIGEN} onChange={setOrigen} nombre="Origen" />
          </div>
          <div>
            <span className={etiqueta}>Va a</span>
            <Segmentado valor={destino} opciones={DESTINOS_PENDIENTE} etiquetas={ETIQUETA_DESTINO} onChange={setDestino} nombre="Destino" />
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
        </div>

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
                  <span>No se pudieron leer los materiales de esta ventana desde HETMO. Escribe la descripción a mano.</span>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label htmlFor="pend-desc" className={etiqueta}>
            Descripción
          </label>
          <textarea
            id="pend-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Qué falta o qué falló"
            className={campo}
          />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="pend-cant" className={etiqueta}>
              Cantidad
            </label>
            <input
              id="pend-cant"
              type="number"
              min={1}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className={`${campo} ${cantidadValida ? '' : 'border-rose-300'}`}
            />
          </div>
          <div>
            <label htmlFor="pend-ubic" className={etiqueta}>
              Ubicación (opcional)
            </label>
            <input id="pend-ubic" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Piso, depto, eje" maxLength={200} className={campo} />
          </div>
          <div>
            <label htmlFor="pend-fecha" className={etiqueta}>
              Se necesita para (opcional)
            </label>
            <input id="pend-fecha" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} className={campo} />
          </div>
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
