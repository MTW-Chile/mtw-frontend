import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, ClipboardList, Home, PackageCheck, Send, ShoppingCart, Square, Trash2 } from 'lucide-react';
import { certificarInstalacion, crearPendientesLote, getFichaVentana, getInstalacionObra, getVentanasObra, subirFotoInstalacion } from '../../../api/client';
import { Seccion } from '../../../components/ui/Seccion';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Aviso } from '../../../components/ui/Aviso';
import { Buscador } from '../../../components/ui/Buscador';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { IconButton } from '../../../components/ui/IconButton';
import { Segmentado } from '../../../components/ui/Segmentado';
import { SelectCompacto } from '../../../components/ui/Campos';
import { Cargando, EstadoVacio, ErrorCarga } from '../../../components/ui/Estados';
import { Lista, FilaLista } from '../../../components/ui/Lista';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { usePermisos } from '../../../lib/permisos';
import { useMigas } from '../../../lib/migas';
import { useAnchoContenedor } from '../../../lib/useAnchoContenedor';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { fecha } from '../../../lib/formato';
import type { DespachoPorRecibir, EstadoVentanaObra, InstalacionObra, NodoUnidadInstalacion, ParteVentana, Proyecto, VentanaObra } from '../../../types';
import { CLASE_BARRA_ESTADO, CLASE_CHIP_ESTADO, ETIQUETA_ESTADO_VENTANA, ORDEN_ESTADO_VENTANA, VARIANTE_ESTADO_VENTANA, nombreVentana } from './estadoVentana';
import { vocabulario } from '../cubicacion/vocabulario';
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO } from '../pendientes/utils';
import { subirArchivos } from '../pendientes/adjuntos/subirArchivos';
import { prepararArchivo } from '../pendientes/adjuntos/prepararArchivo';
import { FormularioPendiente, type PendientePreparado } from '../pendientes/FormularioPendiente';
import { FormularioInstalacion, TEXTO_PARTE, partesPorInstalar, type InstalacionPreparada } from '../../instalacion/FormularioInstalacion';
import { RecibirDespachoModal } from '../../instalacion/RecibirDespachoModal';
import { FichaVentana } from './FichaVentana';

/**
 * Espacio de trabajo sobre las ventanas de una obra, común a «Nuevos pendientes» (Taller) e «Instalación»: a la izquierda
 * la cubicación (torre → piso → departamento, pisos recogidos y unidades especiales al final); a la derecha la ficha de
 * la ventana elegida, con su dibujo, y la acción a registrar. Se van juntando en un listado (carrito) y se envían todos
 * juntos, pero de un solo tipo a la vez: o pendientes, o instalaciones.
 *
 * Sirve igual para obras cotizadas y manuales: lo que cambia es de dónde salen los datos de la ventana (la ficha los
 * resuelve).
 */
type Accion = 'PENDIENTE' | 'INSTALAR';
type ItemCarrito =
  | ({ tipo: 'PENDIENTE'; clave: string; ventana: VentanaObra } & PendientePreparado)
  | ({ tipo: 'INSTALACION'; clave: string } & InstalacionPreparada);

type FiltroEstado = 'TODAS' | 'POR_RECIBIR' | 'POR_INSTALAR' | 'INSTALADAS' | 'CON_PENDIENTE';
const pasaFiltro = (v: VentanaObra, f: FiltroEstado): boolean => {
  switch (f) {
    case 'POR_RECIBIR':
      return v.estado === 'DESPACHADA';
    case 'POR_INSTALAR':
      return v.estado === 'RECIBIDA';
    case 'INSTALADAS':
      return v.estado === 'INSTALADA';
    case 'CON_PENDIENTE':
      return v.pendientesAbiertos > 0;
    default:
      return true;
  }
};

// Busca en todo lo que identifica a la ventana: nomenclatura, código, apertura, torre, piso, depto, ubicación y documento.
const textoBusqueda = (v: VentanaObra) =>
  [nombreVentana(v), v.codigo, v.sistema, v.torre, v.piso != null ? `piso ${v.piso}` : '', v.nombreUnidad, v.ubicacion, v.lote?.nombre, v.lote?.descripcion, v.lote?.modelo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const ChipVentana: React.FC<{ v: VentanaObra; activa: boolean; enCarrito: number; onClick: () => void }> = ({ v, activa, enCarrito, onClick }) => (
  // eslint-disable-next-line react/forbid-elements -- chip táctil del plano (mínimo 44 px en móvil)
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activa}
    title={`${nombreVentana(v)} · ${v.sistema} · ${ETIQUETA_ESTADO_VENTANA[v.estado]}`}
    className={`relative inline-flex min-h-11 sm:min-h-8 pointer-coarse:min-h-11 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono font-bold leading-tight transition-colors hover:brightness-95 cursor-pointer ${CLASE_CHIP_ESTADO[v.estado]} ${
      activa ? 'ring-2 ring-brand-500 ring-offset-1' : ''
    }`}
  >
    {v.estado === 'INSTALADA' ? '✓ ' : ''}
    {nombreVentana(v)}
    {v.separada && <span className="font-sans font-normal text-[10px] opacity-80">½</span>}
    {enCarrito > 0 && <span className="rounded-full bg-brand-600 text-white px-1.5 text-[10px] font-sans">{enCarrito}</span>}
    {v.pendientesAbiertos > 0 && <AlertTriangle className="w-3 h-3 text-amber-600" aria-label="Con pendiente abierto" />}
  </button>
);

const TarjetaUnidad: React.FC<{ nodo: NodoUnidadInstalacion; ventanas: VentanaObra[]; etiqueta: string; activa: string | null; conteo: (id: string) => number; onVentana: (v: VentanaObra) => void; avance?: boolean }> = ({
  nodo,
  ventanas,
  etiqueta,
  activa,
  conteo,
  onVentana,
  avance,
}) => {
  if (ventanas.length === 0) return null;
  const instaladas = ventanas.filter((v) => v.estado === 'INSTALADA').length;
  const completa = avance && instaladas === ventanas.length;
  return (
    <div className={`rounded-xl border p-2.5 space-y-1.5 ${completa ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900 truncate">
          <span className="text-[10px] font-normal uppercase tracking-wider text-slate-400 mr-1">{etiqueta}</span>
          {nodo.nombre}
        </p>
        {avance && (
          <span className={`text-[10px] font-mono tabular-nums ${completa ? 'text-emerald-700' : 'text-slate-500'}`}>
            {instaladas}/{ventanas.length}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ventanas.map((v) => (
          <ChipVentana key={v.id} v={v} activa={activa === v.id} enCarrito={conteo(v.id)} onClick={() => onVentana(v)} />
        ))}
      </div>
    </div>
  );
};

const alternar = (set: Set<string>, id: string) => {
  const n = new Set(set);
  if (n.has(id)) n.delete(id);
  else n.add(id);
  return n;
};

interface Props {
  proyecto: Proyecto;
  modo: 'pendientes' | 'instalacion';
  /** Pendientes: volver a la lista (se llama también al enviar el listado). */
  onCerrar?: () => void;
}

export const EspacioVentanas: React.FC<Props> = ({ proyecto, modo, onCerrar }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const { tiene } = usePermisos();
  const esInstalacion = modo === 'instalacion';
  // Plano y detalle lado a lado según el ancho REAL disponible (no el de la pantalla): una tablet vertical con el menú
  // contraído alcanza; si no, el detalle de la ventana elegida sube sobre el plano para no tener que bajar a buscarlo.
  const [refPagina, anchoPagina] = useAnchoContenedor();
  const dosColumnas = anchoPagina >= 640;
  useMigas(esInstalacion ? 1 : 2, esInstalacion ? [{ label: proyecto.obra, codigo: proyecto.codigoInterno ?? undefined }] : [{ label: 'Nuevos pendientes' }]);

  const acciones: Accion[] = useMemo(() => {
    const a: Accion[] = [];
    if (!esInstalacion || tiene('pendientes.crear')) a.push('PENDIENTE');
    if (esInstalacion && tiene('instalacion.certificar')) a.push('INSTALAR');
    return a;
  }, [esInstalacion, tiene]);
  const [accionElegida, setAccionElegida] = useState<Accion | null>(null);
  const accion: Accion | undefined = accionElegida && acciones.includes(accionElegida) ? accionElegida : acciones[0];

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('TODAS');
  const [activaId, setActivaId] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [revisando, setRevisando] = useState(false);
  const [recibiendo, setRecibiendo] = useState<DespachoPorRecibir | null>(null);
  // Pisos y unidades especiales desplegados (id): todo comienza recogido.
  const [abiertosPisos, setAbiertosPisos] = useState<Set<string>>(new Set());
  const [especialesAbiertas, setEspecialesAbiertas] = useState<Set<string>>(new Set());
  const [despachosAbiertos, setDespachosAbiertos] = useState(false);

  const arbol = useQuery<InstalacionObra>({
    queryKey: esInstalacion ? ['instalacion', proyecto.id] : ['ventanasObra', proyecto.id],
    queryFn: () => (esInstalacion ? getInstalacionObra(proyecto.id) : getVentanasObra(proyecto.id)),
  });
  const data = arbol.data;

  // La ventana elegida se toma SIEMPRE del árbol vigente (tras certificar o enviar cambia su estado).
  const ventanaPorId = useMemo(() => {
    const m = new Map<string, VentanaObra>();
    if (!data) return m;
    const todas = [...data.torres.flatMap((t) => [...t.pisos.flatMap((p) => p.unidades.flatMap((u) => u.ventanas)), ...t.especiales.flatMap((u) => u.ventanas)]), ...data.unica, ...data.areasComunes];
    for (const v of todas) m.set(v.id, v);
    return m;
  }, [data]);
  const activa = activaId ? (ventanaPorId.get(activaId) ?? null) : null;
  const ficha = useQuery({ queryKey: ['fichaVentana', proyecto.id, activaId], queryFn: () => getFichaVentana(proyecto.id, activaId!), enabled: !!activaId, staleTime: 60_000 });

  const voc = vocabulario(data?.modo, proyecto.obra);
  const Icono = data?.modo === 'CASA' ? Home : Building2;
  const q = busqueda.trim().toLowerCase();
  const pasa = (v: VentanaObra) => (!q || textoBusqueda(v).includes(q)) && (!esInstalacion || pasaFiltro(v, filtro));
  const conteo = (id: string) => carrito.filter((c) => c.ventana.id === id).length;
  const tipoCarrito = carrito[0]?.tipo ?? null;
  const despachoDe = (v: VentanaObra) => data?.despachosPorRecibir.find((d) => d.items.some((i) => i.ventanaIndividualizadaId === v.id && i.pendiente > 0));

  const refrescarTodo = () => {
    for (const k of [['pendientes'], ['ventanasObra', proyecto.id], ['instalacion', proyecto.id], ['instalacionObras'], ['fichaVentana', proyecto.id], ['ventanaInstalacion'], ['resumenObra', proyecto.id]]) {
      queryClient.invalidateQueries({ queryKey: k });
    }
  };
  const avisarError = (e: unknown) => {
    const { mensaje, detalle } = extraerErrorParaToast(e);
    mostrarToast(mensaje, { detalle });
  };

  const enviar = useMutation({
    mutationFn: async () => {
      const fallos: string[] = [];
      const hechos = new Set<string>();
      if (tipoCarrito === 'PENDIENTE') {
        const items = carrito.filter((c): c is Extract<ItemCarrito, { tipo: 'PENDIENTE' }> => c.tipo === 'PENDIENTE');
        const r = await crearPendientesLote(proyecto.id, items.map((c) => c.payload));
        // Los pendientes ya existen: si alguna foto falla se avisa, pero no se pierde ninguno. La API devuelve los creados en el mismo orden.
        for (const [i, creado] of r.creados.entries()) {
          hechos.add(items[i].clave);
          if (items[i].archivos.length === 0) continue;
          const sub = await subirArchivos(creado.id, items[i].archivos);
          fallos.push(...sub.fallidos.map((f) => `${items[i].resumen} → ${f}`));
        }
        return { hechos, fallos, total: items.length };
      }
      // Instalaciones: una por una (cada certificación es independiente); las que fallen quedan en el listado.
      const items = carrito.filter((c): c is Extract<ItemCarrito, { tipo: 'INSTALACION' }> => c.tipo === 'INSTALACION');
      for (const it of items) {
        try {
          const { instalacion } = await certificarInstalacion(it.ventana.id, { parte: it.parte, notas: it.notas, forzar: it.forzar });
          hechos.add(it.clave);
          for (const foto of it.fotos) {
            try {
              const listo = await prepararArchivo(foto);
              await subirFotoInstalacion(instalacion.id, listo.blob, listo.nombre, listo.mime);
            } catch (e) {
              fallos.push(`${it.resumen} → ${foto.name}: ${extraerErrorParaToast(e).mensaje}`);
            }
          }
        } catch (e) {
          fallos.push(`${it.resumen}: ${extraerErrorParaToast(e).mensaje}`);
        }
      }
      return { hechos, fallos, total: items.length };
    },
    onSuccess: ({ hechos, fallos, total }) => {
      refrescarTodo();
      const quedan = carrito.filter((c) => !hechos.has(c.clave));
      setCarrito(quedan);
      mostrarToast(tipoCarrito === 'PENDIENTE' ? `${hechos.size} pendiente(s) ingresado(s).` : `${hechos.size} de ${total} instalación(es) certificada(s).`, { tipo: 'info' });
      if (fallos.length) mostrarToast(`${tipoCarrito === 'PENDIENTE' ? 'No se pudo subir' : 'Quedó pendiente'}: ${fallos.join(' · ')}.`);
      if (quedan.length === 0) {
        setRevisando(false);
        if (tipoCarrito === 'PENDIENTE') onCerrar?.();
      }
    },
    onError: avisarError,
  });

  const claveNueva = (ventanaId: string, i: number) => `${ventanaId}-${Date.now()}-${i}`;
  const agregarPendientes = (ps: PendientePreparado[]) => {
    if (!activa) return;
    setCarrito((c) => [...c, ...ps.map((p, i): ItemCarrito => ({ ...p, tipo: 'PENDIENTE', clave: claveNueva(activa.id, c.length + i), ventana: activa }))]);
    mostrarToast(ps.length === 1 ? `Agregado: ${ps[0].resumen}` : `Agregados ${ps.length} pendientes de ${nombreVentana(activa)}`, { tipo: 'info' });
  };
  const agregarInstalacion = (p: InstalacionPreparada) => {
    setCarrito((c) => [...c, { ...p, tipo: 'INSTALACION', clave: claveNueva(p.ventana.id, c.length) }]);
    mostrarToast(`Agregado: ${p.resumen}`, { tipo: 'info' });
  };
  const quitar = (clave: string) => {
    setCarrito((c) => c.filter((x) => x.clave !== clave));
    if (carrito.length <= 1) setRevisando(false);
  };
  const vaciar = async () => {
    if (await confirmar({ titulo: `¿Vaciar el listado de ${tipoCarrito === 'PENDIENTE' ? 'pendientes' : 'instalaciones'}?`, mensaje: 'Lo que está en el listado se pierde.', confirmar: 'Vaciar', peligro: true })) setCarrito([]);
  };
  const salir = async () => {
    if (carrito.length === 0 || (await confirmar({ titulo: `¿Salir sin enviar ${carrito.length} pendiente(s)?`, mensaje: 'Lo que está en el listado se pierde.', confirmar: 'Salir', peligro: true }))) onCerrar?.();
  };

  const hayEstructura = useMemo(() => !!data && (data.torres.some((t) => t.pisos.length || t.especiales.length) || data.unica.length > 0 || data.areasComunes.length > 0), [data]);
  const nombreTipo = tipoCarrito === 'INSTALACION' ? 'instalaciones' : 'pendientes';

  const listadoModal = revisando && (
    <Modal
      titulo={`Listado de ${nombreTipo} (${carrito.length})`}
      subtitulo="Revisa lo ingresado: se envían todos juntos."
      icono={ShoppingCart}
      ancho="lg"
      onClose={() => setRevisando(false)}
      cerrable={!enviar.isPending}
      cuerpoClassName="p-0"
      pie={
        <Modal.Pie inicio={`${carrito.length} ${tipoCarrito === 'INSTALACION' ? 'instalación(es)' : 'pendiente(s)'}`}>
          <Button variant="outline" size="sm" disabled={enviar.isPending} onClick={() => setRevisando(false)}>
            Seguir agregando
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />} disabled={carrito.length === 0} isLoading={enviar.isPending} onClick={() => enviar.mutate()}>
            Enviar {carrito.length || ''}
          </Button>
        </Modal.Pie>
      }
    >
      {carrito.length === 0 ? (
        <p className="px-4 py-6 text-xs text-slate-400 text-center">Elige una ventana y agrega su registro.</p>
      ) : (
        <Lista>
          {carrito.map((c) => (
            <FilaLista
              key={c.clave}
              titulo={<span className="font-mono">{nombreVentana(c.ventana)}</span>}
              acciones={<IconButton icono={Trash2} tono="peligro" etiqueta={`Quitar ${c.resumen}`} onClick={() => quitar(c.clave)} />}
            >
              {c.tipo === 'PENDIENTE' ? (
                <>
                  {ETIQUETA_TIPO[c.payload.tipo]} · {ETIQUETA_MOTIVO[c.payload.motivo]}
                  <br />
                  <span className="text-slate-700">{c.resumen}</span>
                  {c.archivos.length > 0 && <span className="block text-[11px] text-slate-500">{c.archivos.length} foto(s) o archivo(s) por subir</span>}
                </>
              ) : (
                <>
                  <span className="text-slate-700">{TEXTO_PARTE[c.parte]}</span>
                  <span className="block text-[11px] text-slate-500">
                    {c.fotos.length} foto(s){c.forzar ? ' · certificada sin figurar recibida' : ''}
                  </span>
                </>
              )}
            </FilaLista>
          ))}
        </Lista>
      )}
    </Modal>
  );

  const resumen = data?.resumen;
  const pct = resumen?.total ? Math.round((resumen.INSTALADA / resumen.total) * 100) : 0;
  const filtros: { id: FiltroEstado; label: string; total: number }[] = resumen
    ? [
        { id: 'TODAS', label: 'Todas', total: resumen.total },
        { id: 'POR_RECIBIR', label: 'Por recibir', total: resumen.DESPACHADA },
        { id: 'POR_INSTALAR', label: 'Por instalar', total: resumen.RECIBIDA },
        { id: 'INSTALADAS', label: 'Instaladas', total: resumen.INSTALADA },
        { id: 'CON_PENDIENTE', label: 'Con pendiente', total: resumen.conPendiente },
      ]
    : [];

  return (
    <div ref={refPagina} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">{esInstalacion ? proyecto.obra : 'Nuevos pendientes'}</h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            {esInstalacion
              ? 'Elige una ventana de la cubicación y registra un pendiente o márcala como instalada. Se envían en lote, de un solo tipo a la vez.'
              : 'Busca y elige ventanas de la cubicación, detalla cada pendiente con la ventana a la vista y envíalos todos de una vez.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!esInstalacion && (
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={salir}>
              Volver a pendientes
            </Button>
          )}
          <Button variant="primary" size="sm" leftIcon={<ShoppingCart className="w-3.5 h-3.5" />} disabled={carrito.length === 0} onClick={() => setRevisando(true)} aria-label={`Revisar listado y enviar (${carrito.length})`}>
            Revisar listado y enviar
            <span className="ml-1 min-w-5 rounded-full bg-white/25 px-1.5 text-[11px] font-bold tabular-nums">{carrito.length}</span>
          </Button>
        </div>
      </div>

      {esInstalacion && resumen && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              <b className="text-slate-900 text-base tabular-nums">{resumen.INSTALADA}</b> de {resumen.total} ventanas instaladas
            </p>
            <span className="text-sm font-black text-emerald-700 tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-label="Avance de instalación">
            {ORDEN_ESTADO_VENTANA.filter((e) => resumen[e] > 0 && e !== 'SIN_POSICION')
              .reverse()
              .map((e) => (
                <span key={e} className={`h-full ${CLASE_BARRA_ESTADO[e]}`} style={{ width: `${(resumen[e] / resumen.total) * 100}%` }} title={`${ETIQUETA_ESTADO_VENTANA[e]}: ${resumen[e]}`} />
              ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ORDEN_ESTADO_VENTANA.filter((e) => resumen[e] > 0).map((e: EstadoVentanaObra) => (
              <Badge key={e} size="sm" variant={VARIANTE_ESTADO_VENTANA[e]}>
                {ETIQUETA_ESTADO_VENTANA[e]} {resumen[e]}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {esInstalacion && !!data?.despachosPorRecibir.length && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <BotonColapsar abierto={despachosAbiertos} onClick={() => setDespachosAbiertos((x) => !x)} className="w-full px-4 py-3">
            <PackageCheck className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-800">Por recibir en obra</span>
            <Badge size="sm" variant="warning">{data.despachosPorRecibir.length}</Badge>
          </BotonColapsar>
          {despachosAbiertos && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {data.despachosPorRecibir.map((d) => (
                <li key={d.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900">
                      <span className="font-mono">{d.codigo}</span>
                      {d.fase ? ` · Fase ${d.fase.numeroFase} ${d.fase.nombre}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {d.itemsPendientes} de {d.totalItems} ítem(s) por recibir{d.fechaDespacho ? ` · despachado ${fecha(d.fechaDespacho)}` : ''}
                      {d.numeroGuia ? ` · guía N° ${d.numeroGuia}` : ''}
                      {d.transportista ? ` · ${d.transportista}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.bsaleUrlPdf && (
                      <Button size="sm" variant="ghost" onClick={() => window.open(d.bsaleUrlPdf!, '_blank', 'noopener')}>
                        Guía
                      </Button>
                    )}
                    {tiene('instalacion.recibir') && (
                      <Button size="sm" variant="primary" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => setRecibiendo(d)}>
                        Recibir
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {arbol.isLoading ? (
        <Cargando texto="Leyendo la cubicación de la obra…" />
      ) : arbol.isError || !data ? (
        <ErrorCarga que="la cubicación" onReintentar={arbol.refetch} />
      ) : !hayEstructura ? (
        <EstadoVacio icono={Square} titulo="Esta obra todavía no está cubicada" descripcion="Las ventanas aparecen aquí cuando Fabricación carga la cubicación (torres, pisos y departamentos)." />
      ) : (
        /* Dos columnas (plano y ficha) si caben; el listado ingresado es el carrito del encabezado. */
        <div className={`grid gap-4 items-start ${dosColumnas ? (anchoPagina >= 1000 ? 'grid-cols-[20rem_1fr]' : 'grid-cols-[15rem_1fr]') : 'grid-cols-1'}`}>
          {/* Árbol */}
          <div className={`space-y-2 pr-0.5 ${dosColumnas ? 'sticky top-4 max-h-[80dvh] overflow-y-auto' : ''}`}>
            <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Piso 10, depto 1004, V01_1004A, documento…" etiqueta="Buscar ventanas" />
            {esInstalacion && (
              <SelectCompacto value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroEstado)} aria-label="Filtrar ventanas por estado" className="w-full">
                {filtros.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.total})
                  </option>
                ))}
              </SelectCompacto>
            )}
            {data.torres.map((torre) => {
              const visibles = [...torre.pisos.flatMap((p) => p.unidades.flatMap((u) => u.ventanas)), ...torre.especiales.flatMap((u) => u.ventanas)].filter(pasa);
              if (visibles.length === 0) return null;
              const todasTorre = [...torre.pisos.flatMap((p) => p.unidades.flatMap((u) => u.ventanas)), ...torre.especiales.flatMap((u) => u.ventanas)];
              return (
                <Seccion
                  key={torre.id}
                  icono={Icono}
                  titulo={voc.textoTorre(torre.nombre)}
                  descripcion={esInstalacion ? `${todasTorre.filter((v) => v.estado === 'INSTALADA').length}/${todasTorre.length} instaladas` : `${visibles.length} ventana(s)`}
                  sinRelleno
                >
                  <div className="divide-y divide-slate-100">
                    {[...torre.pisos].reverse().map((piso) => {
                      const delPiso = piso.unidades.flatMap((u) => u.ventanas);
                      const visiblesPiso = delPiso.filter(pasa);
                      if (visiblesPiso.length === 0) return null;
                      const inst = delPiso.filter((v) => v.estado === 'INSTALADA').length;
                      const cerrado = !abiertosPisos.has(piso.id) && !q;
                      return (
                        <div key={piso.id} className="px-3 py-2">
                          <BotonColapsar abierto={!cerrado} onClick={() => setAbiertosPisos((s) => alternar(s, piso.id))} className="w-full pointer-coarse:min-h-11">
                            <span className="flex items-center justify-between gap-2 flex-1 text-left">
                              <span className="text-xs font-bold text-slate-800">Piso {piso.numero}</span>
                              <span className={`text-[11px] font-mono tabular-nums ${esInstalacion && inst === delPiso.length && delPiso.length > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                {esInstalacion ? `${inst}/${delPiso.length}` : visiblesPiso.length}
                              </span>
                            </span>
                          </BotonColapsar>
                          {!cerrado && (
                            <div className="mt-2 space-y-2">
                              {piso.unidades.map((u) => (
                                <TarjetaUnidad key={u.id} nodo={u} ventanas={u.ventanas.filter(pasa)} etiqueta={voc.unidadCorta} activa={activaId} conteo={conteo} onVentana={(v) => setActivaId(v.id)} avance={esInstalacion} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {torre.especiales.length > 0 && (!q || torre.especiales.some((u) => u.ventanas.some(pasa))) && (
                    <div className="px-3 py-2 border-t border-slate-100">
                      <BotonColapsar abierto={especialesAbiertas.has(torre.id) || !!q} onClick={() => setEspecialesAbiertas((s) => alternar(s, torre.id))} className="w-full">
                        <span className="flex items-center justify-between gap-2 flex-1 text-left">
                          <span className="text-xs font-bold text-slate-800">{voc.modo === 'CASA' ? 'Exteriores' : 'Unidades especiales'}</span>
                          <span className="text-[11px] font-mono text-slate-500">{torre.especiales.flatMap((u) => u.ventanas).filter(pasa).length}</span>
                        </span>
                      </BotonColapsar>
                      {(especialesAbiertas.has(torre.id) || !!q) && (
                        <div className="mt-2 space-y-2">
                          {torre.especiales.map((u) => (
                            <TarjetaUnidad key={u.id} nodo={u} ventanas={u.ventanas.filter(pasa)} etiqueta="" activa={activaId} conteo={conteo} onVentana={(v) => setActivaId(v.id)} avance={esInstalacion} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Seccion>
              );
            })}
            {data.unica.filter(pasa).length > 0 && (
              <Seccion
                titulo={proyecto.origen === 'MANUAL_OBRA' ? 'Ventanas sin ubicar' : 'Cubicación única'}
                descripcion={proyecto.origen === 'MANUAL_OBRA' ? 'Aún sin torre, piso ni departamento; se pueden usar igual.' : 'Ventanas con nomenclatura sin torre ni piso.'}
                sinRelleno
              >
                <div className="p-3 flex flex-wrap gap-1.5">
                  {data.unica.filter(pasa).map((v) => (
                    <ChipVentana key={v.id} v={v} activa={activaId === v.id} enCarrito={conteo(v.id)} onClick={() => setActivaId(v.id)} />
                  ))}
                </div>
              </Seccion>
            )}
            {data.areasComunes.filter(pasa).length > 0 && (
              <Seccion titulo="Áreas comunes" sinRelleno>
                <div className="p-3 flex flex-wrap gap-1.5">
                  {data.areasComunes.filter(pasa).map((v) => (
                    <ChipVentana key={v.id} v={v} activa={activaId === v.id} enCarrito={conteo(v.id)} onClick={() => setActivaId(v.id)} />
                  ))}
                </div>
              </Seccion>
            )}
            {data.sinPosicion > 0 && <p className="text-[11px] text-slate-400">{data.sinPosicion} ventana(s) contratadas aún sin posición en la cubicación (no se muestran).</p>}
          </div>

          {/* Ficha y acción */}
          <div className={`space-y-4 min-w-0 ${!dosColumnas && activa ? 'order-first' : ''}`}>
            {!activa ? (
              <EstadoVacio icono={Square} titulo="Elige una ventana" descripcion={esInstalacion ? 'Toca una ventana del plano para ver su ficha y registrar un pendiente o su instalación.' : 'Toca una ventana del plano para ver todo lo que sabemos de ella y detallar su pendiente.'} />
            ) : ficha.isLoading ? (
              <Cargando texto={`Leyendo ${nombreVentana(activa)}…`} />
            ) : ficha.isError || !ficha.data ? (
              <ErrorCarga que="la ventana" onReintentar={ficha.refetch} />
            ) : (
              <>
                <Seccion icono={Square} titulo={nombreVentana(activa)}>
                  <FichaVentana proyectoId={proyecto.id} ficha={ficha.data} conHistorial={esInstalacion} />
                </Seccion>

                {esInstalacion && despachoDe(activa) && tiene('instalacion.recibir') && (
                  <Aviso
                    tono="info"
                    titulo={`Llegó en el despacho ${despachoDe(activa)!.codigo}${despachoDe(activa)!.fechaDespacho ? ` (${fecha(despachoDe(activa)!.fechaDespacho!)})` : ''}`}
                    accion={
                      <Button size="sm" variant="primary" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => setRecibiendo(despachoDe(activa)!)}>
                        Recibir
                      </Button>
                    }
                  >
                    Acusa recibo antes de certificar la instalación.
                  </Aviso>
                )}

                {accion && (
                  <Seccion
                    titulo={acciones.length > 1 ? undefined : 'Pendiente de esta ventana'}
                    descripcion={acciones.length > 1 ? undefined : 'Al agregarlo queda en el listado (carrito); puedes agregar varios por ventana.'}
                    acciones={
                      acciones.length > 1 ? (
                        <Segmentado
                          etiqueta="Qué registrar"
                          opciones={[
                            { value: 'PENDIENTE' as Accion, label: 'Pendiente', icono: ClipboardList },
                            { value: 'INSTALAR' as Accion, label: 'Marcar instalada', icono: CheckCircle2, disabled: activa.estado === 'INSTALADA' && partesPorInstalar(activa).length === 0, title: activa.estado === 'INSTALADA' ? 'Ya está instalada' : undefined },
                          ]}
                          valor={accion}
                          onChange={setAccionElegida}
                        />
                      ) : undefined
                    }
                  >
                    {ficha.data.hetmoError && accion === 'PENDIENTE' && (
                      <div className="mb-3">
                        <Aviso tono="advertencia">{ficha.data.hetmoError}</Aviso>
                      </div>
                    )}
                    {tipoCarrito && tipoCarrito !== (accion === 'PENDIENTE' ? 'PENDIENTE' : 'INSTALACION') ? (
                      <Aviso
                        tono="advertencia"
                        titulo={`El listado actual es de ${nombreTipo}`}
                        accion={
                          <Button size="sm" variant="outline" onClick={vaciar}>
                            Vaciar listado
                          </Button>
                        }
                      >
                        Un listado lleva un solo tipo de registro. Envíalo con «Revisar listado y enviar» o vacíalo para agregar {accion === 'PENDIENTE' ? 'pendientes' : 'instalaciones'}.
                      </Aviso>
                    ) : accion === 'PENDIENTE' ? (
                      <FormularioPendiente key={activa.id} proyectoId={proyecto.id} ficha={ficha.data} onAgregar={agregarPendientes} />
                    ) : (
                      <FormularioInstalacion
                        key={activa.id}
                        proyectoId={proyecto.id}
                        ventana={activa}
                        enListado={carrito.filter((c): c is Extract<ItemCarrito, { tipo: 'INSTALACION' }> => c.tipo === 'INSTALACION' && c.ventana.id === activa.id).map((c) => c.parte as ParteVentana)}
                        onAgregar={agregarInstalacion}
                      />
                    )}
                  </Seccion>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {listadoModal}
      {recibiendo && (
        <RecibirDespachoModal
          proyectoId={proyecto.id}
          despacho={recibiendo}
          onClose={() => {
            setRecibiendo(null);
            refrescarTodo();
          }}
        />
      )}
    </div>
  );
};
