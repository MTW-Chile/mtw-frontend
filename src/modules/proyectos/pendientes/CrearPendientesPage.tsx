import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Building2, Home, Send, ShoppingCart, Square, Trash2 } from 'lucide-react';
import { crearPendientesLote, getFichaVentana, getVentanasObra } from '../../../api/client';
import { Seccion } from '../../../components/ui/Seccion';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Aviso } from '../../../components/ui/Aviso';
import { Buscador } from '../../../components/ui/Buscador';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { IconButton } from '../../../components/ui/IconButton';
import { Cargando, EstadoVacio, ErrorCarga } from '../../../components/ui/Estados';
import { Lista, FilaLista } from '../../../components/ui/Lista';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { useMigas } from '../../../lib/migas';
import { useAnchoContenedor } from '../../../lib/useAnchoContenedor';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { fecha } from '../../../lib/formato';
import type { FichaVentanaObra, NodoUnidadInstalacion, Proyecto, VentanaObra } from '../../../types';
import { CLASE_CHIP_ESTADO, ETIQUETA_ESTADO_VENTANA, VARIANTE_ESTADO_VENTANA, nombreVentana } from '../obra/estadoVentana';
import { DibujoVentana } from '../obra/DibujoVentana';
import { vocabulario } from '../cubicacion/vocabulario';
import { formatoMm, textoEstadoFabricacion, varianteEstadoFabricacion } from '../fabricacion/utils';
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO, codigoPendiente, etiquetaPieza, nombreCuadro } from './utils';
import { FormularioPendiente, type PendientePreparado } from './FormularioPendiente';

interface Props {
  proyecto: Proyecto;
  onCerrar: () => void;
}

interface ItemCarrito extends PendientePreparado {
  clave: string;
  ventana: VentanaObra;
}

// Busca en todo lo que identifica a la ventana: nomenclatura, código, apertura, torre, piso, depto, ubicación y documento.
const textoBusqueda = (v: VentanaObra) =>
  [nombreVentana(v), v.codigo, v.sistema, v.torre, v.piso != null ? `piso ${v.piso}` : '', v.nombreUnidad, v.ubicacion, v.lote?.nombre, v.lote?.descripcion, v.lote?.modelo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const ChipVentana: React.FC<{ v: VentanaObra; activa: boolean; enCarrito: number; onClick: () => void }> = ({ v, activa, enCarrito, onClick }) => (
  // eslint-disable-next-line react/forbid-elements -- chip táctil del plano (mínimo 44 px en móvil), mismo patrón que Instalación
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activa}
    title={`${nombreVentana(v)} · ${v.sistema} · ${ETIQUETA_ESTADO_VENTANA[v.estado]}`}
    className={`relative inline-flex min-h-11 sm:min-h-8 pointer-coarse:min-h-11 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono font-bold leading-tight transition-colors hover:brightness-95 cursor-pointer ${CLASE_CHIP_ESTADO[v.estado]} ${
      activa ? 'ring-2 ring-brand-500 ring-offset-1' : ''
    }`}
  >
    {nombreVentana(v)}
    {enCarrito > 0 && <span className="rounded-full bg-brand-600 text-white px-1.5 text-[10px] font-sans">{enCarrito}</span>}
    {v.pendientesAbiertos > 0 && <AlertTriangle className="w-3 h-3 text-amber-600" aria-label="Con pendiente abierto" />}
  </button>
);

const TarjetaUnidad: React.FC<{ nodo: NodoUnidadInstalacion; ventanas: VentanaObra[]; etiqueta: string; activa: string | null; conteo: (id: string) => number; onVentana: (v: VentanaObra) => void }> = ({
  nodo,
  ventanas,
  etiqueta,
  activa,
  conteo,
  onVentana,
}) => {
  if (ventanas.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5">
      <p className="text-xs font-bold text-slate-900 truncate">
        <span className="text-[10px] font-normal uppercase tracking-wider text-slate-400 mr-1">{etiqueta}</span>
        {nodo.nombre}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ventanas.map((v) => (
          <ChipVentana key={v.id} v={v} activa={activa === v.id} enCarrito={conteo(v.id)} onClick={() => onVentana(v)} />
        ))}
      </div>
    </div>
  );
};

/** Lo que sabemos de la ventana: dónde va, estado, documento, medidas, marcos y hojas, vidrios, materiales y pendientes. */
const FichaVentana: React.FC<{ proyectoId: string; ficha: FichaVentanaObra }> = ({ proyectoId, ficha }) => {
  const v = ficha.ventana;
  const fv = ficha.fabricacionVentana;
  const abiertos = ficha.pendientes.filter((p) => p.estado !== 'RESUELTO');
  const [tecnicoAbierto, setTecnicoAbierto] = useState(false);
  const Dato: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className="text-xs text-slate-800 break-words">{children}</dd>
    </div>
  );
  // @container: la ficha se acomoda al ancho real de su columna (en tablet es angosta), no al de la pantalla.
  return (
    <div className="space-y-2 @container">
      <div className="grid grid-cols-1 @xl:grid-cols-[9.5rem_1fr] gap-3">
        <DibujoVentana proyectoId={proyectoId} ventanaId={v.ventanaId} lineaHetmo={v.ventanaId ? undefined : fv?.hetmoVentanaMadreId} ventana={ficha.dibujo} className="h-32 @xl:h-full @xl:min-h-32" />
        <dl className="grid grid-cols-2 @3xl:grid-cols-3 gap-x-4 gap-y-1.5 content-start">
          <div className="col-span-2 @3xl:col-span-3 flex flex-wrap items-center gap-1.5">
            <Badge size="sm" variant={VARIANTE_ESTADO_VENTANA[v.estado]}>{ETIQUETA_ESTADO_VENTANA[v.estado]}</Badge>
            {ficha.documento && (
              <Badge size="sm" variant={varianteEstadoFabricacion(ficha.documento.estadoHetmo)}>
                {textoEstadoFabricacion(ficha.documento.estadoHetmo, ficha.documento.estadoGlosa)}
              </Badge>
            )}
            {abiertos.length > 0 && <Badge size="sm" variant="warning">{abiertos.length} pendiente(s) abierto(s)</Badge>}
          </div>
          <div className="col-span-2 @3xl:col-span-3">
            <Dato k="Apertura">{fv?.descripcionCorta || v.sistema}</Dato>
          </div>
          <Dato k="Ubicación">
            {[v.torre ? `Torre ${v.torre}` : null, v.piso != null ? `Piso ${v.piso}` : null, v.nombreUnidad, v.ubicacion].filter(Boolean).join(' · ') || 'Sin posición'}
          </Dato>
          <Dato k="Medida (mm)">{fv ? `${formatoMm(fv.anchoMm)} × ${formatoMm(fv.altoMm)}` : v.anchoFabricacionMm != null ? `${formatoMm(v.anchoFabricacionMm)} × ${formatoMm(v.altoFabricacionMm)}` : `${formatoMm(v.anchoPlanoMm)} × ${formatoMm(v.altoPlanoMm)}`}</Dato>
          <Dato k="Documento">{ficha.documento ? `${ficha.documento.nombreMostrado} · pos ${fv?.orden}` : 'Sin vincular'}</Dato>
          <div className="col-span-2 @3xl:col-span-3">
            <Dato k={`Vidrios (${ficha.vidrios.reduce((n, g) => n + Number(g.UDS || 1), 0)})`}>
              {ficha.vidrios.length === 0
                ? ficha.hetmoError ?? 'Sin vidrios en la línea.'
                : ficha.vidrios.map((g) => `${formatoMm(g.ANCHO)} × ${formatoMm(g.ALTO)} · ${g.codigo_articulo}${Number(g.UDS) > 1 ? ` · ${g.UDS} un` : ''}`).join('  |  ')}
            </Dato>
          </div>
        </dl>
      </div>

      {/* Lo técnico (marcos, hojas y materiales) va aparte: se abre solo si hace falta. */}
      <div className="rounded-xl border border-slate-200">
        <BotonColapsar abierto={tecnicoAbierto} onClick={() => setTecnicoAbierto((x) => !x)} className="w-full px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Marcos, hojas y materiales ({ficha.materiales.length})</span>
        </BotonColapsar>
        {tecnicoAbierto && (
          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-3 text-xs px-3 pb-3">
            <div className="rounded-lg border border-slate-200 p-2.5 space-y-1 max-h-52 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Marcos y hojas</p>
              {ficha.cuadros.length === 0 ? (
                <p className="text-slate-400">{fv ? 'El lote aún no trae los cuadros (se optimiza después).' : 'Sin documento de fabricación.'}</p>
              ) : (
                ficha.cuadros.map((c) => (
                  <div key={c.id}>
                    <p className="font-mono text-slate-700">
                      {nombreCuadro(c)} · {formatoMm(c.anchoMm)} × {formatoMm(c.altoMm)}
                    </p>
                    {c.piezas.map((p) => (
                      <p key={p.id} className="pl-3 text-[11px] text-slate-500 truncate" title={etiquetaPieza(p, true)}>
                        {etiquetaPieza(p)}
                      </p>
                    ))}
                  </div>
                ))
              )}
              {ficha.piezasSueltas.length > 0 && (
                <div>
                  <p className="font-mono text-slate-700">Piezas sueltas</p>
                  {ficha.piezasSueltas.map((p) => (
                    <p key={p.id} className="pl-3 text-[11px] text-slate-500 truncate" title={etiquetaPieza(p, true)}>
                      {etiquetaPieza(p)}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 space-y-1 max-h-52 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Materiales ({ficha.materiales.length})</p>
              {ficha.materiales.length === 0 ? (
                <p className="text-slate-400">{ficha.hetmoError ?? 'Sin materiales en la línea.'}</p>
              ) : (
                ficha.materiales.map((m, i) => (
                  <p key={`${m.codigo_articulo}-${i}`} className="text-slate-700 truncate" title={`${m.descripcion_articulo} (${m.codigo_articulo})`}>
                    {m.descripcion_articulo} <span className="text-slate-400 font-mono">{m.codigo_articulo}</span>
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {abiertos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 text-xs space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pendientes abiertos de esta ventana</p>
          {abiertos.map((p) => (
            <p key={p.id} className="text-amber-900 truncate">
              <span className="font-mono font-bold">{codigoPendiente(p.numero)}</span> · {ETIQUETA_TIPO[p.tipo]} · {ETIQUETA_MOTIVO[p.motivo]} · {p.descripcion} · {fecha(p.fechaReporte)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Nuevos pendientes de una obra: se eligen ventanas de la cubicación (buscando por piso, depto,
 * nomenclatura, documento…), se detalla cada pendiente con toda la información de la ventana a la
 * vista, se van juntando en un listado y se envían todos de una vez. Sirve para obras cotizadas y
 * manuales por igual: lo que cambia es de dónde salen los datos de la ventana.
 */
export const CrearPendientesPage: React.FC<Props> = ({ proyecto, onCerrar }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  // Plano y detalle lado a lado según el ancho REAL disponible (no el de la pantalla): una tablet vertical con el menú
  // contraído alcanza; si no, el detalle de la ventana elegida sube sobre el plano para no tener que bajar a buscarlo.
  const [refPagina, anchoPagina] = useAnchoContenedor();
  const dosColumnas = anchoPagina >= 640;
  useMigas(2, [{ label: 'Nuevos pendientes' }]);
  const [busqueda, setBusqueda] = useState('');
  const [activa, setActiva] = useState<VentanaObra | null>(null);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  // Pisos desplegados (id): todos comienzan replegados y se van abriendo.
  const [abiertosPisos, setAbiertosPisos] = useState<Set<string>>(new Set());
  // Listado (carrito) desplegado: «Revisar listado y enviar».
  const [revisando, setRevisando] = useState(false);

  const arbol = useQuery({ queryKey: ['ventanasObra', proyecto.id], queryFn: () => getVentanasObra(proyecto.id) });
  const ficha = useQuery({ queryKey: ['fichaVentana', proyecto.id, activa?.id], queryFn: () => getFichaVentana(proyecto.id, activa!.id), enabled: !!activa, staleTime: 60_000 });
  const voc = vocabulario(arbol.data?.modo, proyecto.obra);
  const Icono = arbol.data?.modo === 'CASA' ? Home : Building2;

  const q = busqueda.trim().toLowerCase();
  const pasa = (v: VentanaObra) => !q || textoBusqueda(v).includes(q);
  const conteo = (id: string) => carrito.filter((c) => c.ventana.id === id).length;

  const enviar = useMutation({
    mutationFn: () => crearPendientesLote(proyecto.id, carrito.map((c) => c.payload)),
    onSuccess: ({ creados }) => {
      mostrarToast(`${creados.length} pendiente(s) ingresado(s).`, { tipo: 'info' });
      queryClient.invalidateQueries({ queryKey: ['pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['ventanasObra', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['fichaVentana', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['resumenObra', proyecto.id] });
      setCarrito([]);
      setRevisando(false);
      onCerrar();
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const agregar = (ps: PendientePreparado[]) => {
    if (!activa) return;
    setCarrito((c) => [...c, ...ps.map((p, i) => ({ ...p, clave: `${activa.id}-${Date.now()}-${c.length + i}`, ventana: activa }))]);
    mostrarToast(ps.length === 1 ? `Agregado: ${ps[0].resumen}` : `Agregados ${ps.length} pendientes de ${nombreVentana(activa)}`, { tipo: 'info' });
  };
  const quitar = (clave: string) => {
    setCarrito((c) => c.filter((x) => x.clave !== clave));
    if (carrito.length <= 1) setRevisando(false);
  };
  const salir = async () => {
    if (carrito.length === 0 || (await confirmar({ titulo: `¿Salir sin enviar ${carrito.length} pendiente(s)?`, mensaje: 'Lo que está en el listado se pierde.', confirmar: 'Salir', peligro: true }))) onCerrar();
  };
  const alternarPiso = (id: string) =>
    setAbiertosPisos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const hayEstructura = useMemo(() => {
    const d = arbol.data;
    return !!d && (d.torres.some((t) => t.pisos.length || t.especiales.length) || d.unica.length > 0 || d.areasComunes.length > 0);
  }, [arbol.data]);

  // Listado de pendientes ya ingresados (carrito): se abre bajo demanda para no alargar la página.
  const listadoModal = revisando && (
    <Modal
      titulo={`Listado de pendientes (${carrito.length})`}
      subtitulo="Revisa lo ingresado: se envían todos juntos."
      icono={ShoppingCart}
      ancho="lg"
      onClose={() => setRevisando(false)}
      cerrable={!enviar.isPending}
      cuerpoClassName="p-0"
      pie={
        <Modal.Pie inicio={`${carrito.length} pendiente(s)`}>
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
        <p className="px-4 py-6 text-xs text-slate-400 text-center">Elige una ventana y agrega su pendiente.</p>
      ) : (
        <Lista>
          {carrito.map((c) => (
            <FilaLista key={c.clave} titulo={<span className="font-mono">{nombreVentana(c.ventana)}</span>} acciones={<IconButton icono={Trash2} tono="peligro" etiqueta={`Quitar ${c.resumen}`} onClick={() => quitar(c.clave)} />}>
              {ETIQUETA_TIPO[c.payload.tipo]} · {ETIQUETA_MOTIVO[c.payload.motivo]}
              <br />
              <span className="text-slate-700">{c.resumen}</span>
            </FilaLista>
          ))}
        </Lista>
      )}
    </Modal>
  );

  return (
    <div ref={refPagina} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Nuevos pendientes</h2>
          <p className="text-xs text-slate-500 max-w-2xl">Busca y elige ventanas de la cubicación, detalla cada pendiente con la ventana a la vista y envíalos todos de una vez.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={salir}>
            Volver a pendientes
          </Button>
          <Button variant="primary" size="sm" leftIcon={<ShoppingCart className="w-3.5 h-3.5" />} disabled={carrito.length === 0} onClick={() => setRevisando(true)} aria-label={`Revisar listado y enviar (${carrito.length} pendientes)`}>
            Revisar listado y enviar
            <span className="ml-1 min-w-5 rounded-full bg-white/25 px-1.5 text-[11px] font-bold tabular-nums">{carrito.length}</span>
          </Button>
        </div>
      </div>

      {arbol.isLoading ? (
        <Cargando texto="Leyendo la cubicación de la obra…" />
      ) : arbol.isError || !arbol.data ? (
        <ErrorCarga que="la cubicación" onReintentar={arbol.refetch} />
      ) : !hayEstructura ? (
        <EstadoVacio icono={Square} titulo="Esta obra todavía no está cubicada" descripcion="Los pendientes se levantan sobre las ventanas cubicadas. Carga la cubicación en Taller › Fabricación › Cubicación." />
      ) : (
        /* Dos columnas (plano y formulario) si caben; el listado de pendientes ingresados es el carrito del encabezado. */
        <div className={`grid gap-4 items-start ${dosColumnas ? (anchoPagina >= 1000 ? 'grid-cols-[20rem_1fr]' : 'grid-cols-[15rem_1fr]') : 'grid-cols-1'}`}>
          {/* Árbol */}
          <div className={`space-y-2 pr-0.5 ${dosColumnas ? 'sticky top-4 max-h-[80dvh] overflow-y-auto' : ''}`}>
            <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Piso 10, depto 1004, V01_1004A, documento…" etiqueta="Buscar ventanas" />
            {arbol.data.torres.map((torre) => {
              const visibles = [...torre.pisos.flatMap((p) => p.unidades.flatMap((u) => u.ventanas)), ...torre.especiales.flatMap((u) => u.ventanas)].filter(pasa);
              if (visibles.length === 0) return null;
              return (
                <Seccion key={torre.id} icono={Icono} titulo={voc.textoTorre(torre.nombre)} descripcion={`${visibles.length} ventana(s)`} sinRelleno>
                  {torre.especiales.length > 0 && (
                    <div className="px-3 py-2 border-b border-slate-100 space-y-2">
                      {torre.especiales.map((u) => (
                        <TarjetaUnidad key={u.id} nodo={u} ventanas={u.ventanas.filter(pasa)} etiqueta="" activa={activa?.id ?? null} conteo={conteo} onVentana={setActiva} />
                      ))}
                    </div>
                  )}
                  <div className="divide-y divide-slate-100">
                    {[...torre.pisos].reverse().map((piso) => {
                      const delPiso = piso.unidades.flatMap((u) => u.ventanas).filter(pasa);
                      if (delPiso.length === 0) return null;
                      const cerrado = !abiertosPisos.has(piso.id) && !q;
                      return (
                        <div key={piso.id} className="px-3 py-2">
                          <BotonColapsar abierto={!cerrado} onClick={() => alternarPiso(piso.id)} className="w-full">
                            <span className="flex items-center justify-between gap-2 flex-1 text-left">
                              <span className="text-xs font-bold text-slate-800">Piso {piso.numero}</span>
                              <span className="text-[11px] font-mono text-slate-500">{delPiso.length}</span>
                            </span>
                          </BotonColapsar>
                          {!cerrado && (
                            <div className="mt-2 space-y-2">
                              {piso.unidades.map((u) => (
                                <TarjetaUnidad key={u.id} nodo={u} ventanas={u.ventanas.filter(pasa)} etiqueta={voc.unidadCorta} activa={activa?.id ?? null} conteo={conteo} onVentana={setActiva} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Seccion>
              );
            })}
            {arbol.data.unica.filter(pasa).length > 0 && (
              <Seccion titulo={proyecto.origen === 'MANUAL_OBRA' ? 'Ventanas sin ubicar' : 'Cubicación única'} descripcion={proyecto.origen === 'MANUAL_OBRA' ? 'Aún sin torre, piso ni departamento; se pueden usar igual.' : undefined} sinRelleno>
                <div className="p-3 flex flex-wrap gap-1.5">
                  {arbol.data.unica.filter(pasa).map((v) => (
                    <ChipVentana key={v.id} v={v} activa={activa?.id === v.id} enCarrito={conteo(v.id)} onClick={() => setActiva(v)} />
                  ))}
                </div>
              </Seccion>
            )}
            {arbol.data.areasComunes.filter(pasa).length > 0 && (
              <Seccion titulo="Áreas comunes" sinRelleno>
                <div className="p-3 flex flex-wrap gap-1.5">
                  {arbol.data.areasComunes.filter(pasa).map((v) => (
                    <ChipVentana key={v.id} v={v} activa={activa?.id === v.id} enCarrito={conteo(v.id)} onClick={() => setActiva(v)} />
                  ))}
                </div>
              </Seccion>
            )}
          </div>

          {/* Ficha y formulario */}
          <div className={`space-y-4 min-w-0 ${!dosColumnas && activa ? 'order-first' : ''}`}>
            {!activa ? (
              <EstadoVacio icono={Square} titulo="Elige una ventana" descripcion="Toca una ventana del plano para ver todo lo que sabemos de ella y detallar su pendiente." />
            ) : ficha.isLoading ? (
              <Cargando texto={`Leyendo ${nombreVentana(activa)}…`} />
            ) : ficha.isError || !ficha.data ? (
              <ErrorCarga que="la ventana" onReintentar={ficha.refetch} />
            ) : (
              <>
                <Seccion icono={Square} titulo={nombreVentana(activa)}>
                  <FichaVentana proyectoId={proyecto.id} ficha={ficha.data} />
                </Seccion>
                <Seccion titulo="Pendiente de esta ventana" descripcion="Al agregarlo queda en el listado (carrito); puedes agregar varios por ventana.">
                  {ficha.data.hetmoError && <div className="mb-3"><Aviso tono="advertencia">{ficha.data.hetmoError}</Aviso></div>}
                  <FormularioPendiente key={activa.id} ficha={ficha.data} onAgregar={agregar} />
                </Seccion>
              </>
            )}
          </div>

        </div>
      )}
      {listadoModal}
    </div>
  );
};
