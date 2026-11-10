import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Building2, Check, CheckCheck, Home, PackageCheck, Send, ShoppingCart, Square, Trash2, X } from 'lucide-react';
import { actualizarFabricacionesObra, certificarInstalacion, crearPendientesLote, getFichaVentana, getInstalacionObra, getVentanasObra, subirFotoInstalacion } from '../../../api/client';
import { Seccion } from '../../../components/ui/Seccion';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Aviso } from '../../../components/ui/Aviso';
import { Buscador } from '../../../components/ui/Buscador';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { IconButton } from '../../../components/ui/IconButton';
import { Segmentado } from '../../../components/ui/Segmentado';
import { Cargando, EstadoVacio, ErrorCarga } from '../../../components/ui/Estados';
import { Lista, FilaLista } from '../../../components/ui/Lista';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { usePermisos } from '../../../lib/permisos';
import { useMigas } from '../../../lib/migas';
import { navegar } from '../../../lib/navigation';
import { useAnchoContenedor } from '../../../lib/useAnchoContenedor';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { fecha } from '../../../lib/formato';
import { borrarBorrador, guardarBorrador, leerBorrador } from '../../../lib/borradorLocal';
import { useSession } from '../../../lib/useCloudflareAccessSession';
import type { EstadoVentanaObra, InstalacionObra, NodoUnidadInstalacion, ParteVentana, Proyecto, VentanaObra } from '../../../types';
import { CLASE_BARRA_ESTADO, CLASE_CHIP_ESTADO, ETIQUETA_ESTADO_VENTANA, ICONO_ESTADO_VENTANA, ORDEN_ESTADO_VENTANA, VARIANTE_ESTADO_VENTANA, nombreVentana } from './estadoVentana';
import { vocabulario } from '../cubicacion/vocabulario';
import { ETIQUETA_MOTIVO, ETIQUETA_TIPO } from '../pendientes/utils';
import { subirArchivos } from '../pendientes/adjuntos/subirArchivos';
import { prepararArchivo } from '../pendientes/adjuntos/prepararArchivo';
import { FormularioPendiente, type PendientePreparado } from '../pendientes/FormularioPendiente';
import { FormularioInstalacion, TEXTO_PARTE, partesPorInstalar, type InstalacionPreparada } from '../../instalacion/FormularioInstalacion';
import { FichaVentana } from './FichaVentana';

/**
 * Espacio de trabajo sobre las ventanas de una obra, para tablet en terreno. Lo usan dos secciones de Instaladores:
 *  - «Instalación» (modo instalacion): se marcan una o varias ventanas (o un departamento o un piso entero) y se
 *    certifican juntas, cada una con su propia foto.
 *  - «Pendientes» (modo pendientes; también desde la pestaña Pendientes de la obra): se elige una ventana y se detalla
 *    qué falta o falló, con la ventana a la vista.
 * En ambas lo ingresado se junta en un listado (carrito) que se revisa y se envía de una vez.
 *
 * Disposición (ancho REAL disponible, no el de la pantalla): desde 840 px, plano y detalle lado a lado (tablet
 * horizontal); bajo eso, una sola columna que muestra el plano o el detalle, con «Volver al plano» (tablet vertical,
 * celular). La acción principal va siempre en la barra fija de abajo, a la derecha, al alcance del pulgar.
 *
 * Sirve igual para obras cotizadas y manuales: lo que cambia es de dónde salen los datos de la ventana (la ficha los
 * resuelve).
 */
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

/** Ancho desde el que plano y detalle caben lado a lado (clase «expanded» de Material: tablet horizontal). */
const ANCHO_DOS_PANELES = 840;

// Busca en todo lo que identifica a la ventana: nomenclatura, código, apertura, torre, piso, depto, ubicación y documento.
const textoBusqueda = (v: VentanaObra) =>
  [nombreVentana(v), v.codigo, v.sistema, v.torre, v.piso != null ? `piso ${v.piso}` : '', v.nombreUnidad, v.ubicacion, v.lote?.nombre, v.lote?.descripcion, v.lote?.modelo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const ChipVentana: React.FC<{ v: VentanaObra; activa: boolean; enCarrito: number; onClick: () => void; conMarca?: boolean }> = ({ v, activa, enCarrito, onClick, conMarca }) => {
  const IconoEstado = ICONO_ESTADO_VENTANA[v.estado];
  return (
    // eslint-disable-next-line react/forbid-elements -- chip táctil del plano (48 px con el dedo)
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      title={`${nombreVentana(v)} · ${v.sistema} · ${ETIQUETA_ESTADO_VENTANA[v.estado]}`}
      className={`relative inline-flex min-h-9 pointer-coarse:min-h-12 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono font-bold leading-tight transition-colors hover:brightness-95 cursor-pointer ${CLASE_CHIP_ESTADO[v.estado]} ${
        activa ? 'ring-2 ring-brand-600 ring-offset-1' : ''
      }`}
    >
      {conMarca && activa ? <Check className="w-3.5 h-3.5 shrink-0 text-brand-700" aria-label="Elegida" /> : <IconoEstado className="w-3.5 h-3.5 shrink-0" aria-label={ETIQUETA_ESTADO_VENTANA[v.estado]} />}
      {nombreVentana(v)}
      {v.separada && <span className="font-sans font-normal text-[11px] opacity-80">½</span>}
      {enCarrito > 0 && <span className="rounded-full bg-brand-600 text-white px-1.5 text-[11px] font-sans">{enCarrito}</span>}
      {v.pendientesAbiertos > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-label="Con pendiente abierto" />}
    </button>
  );
};

interface PropsChips {
  activas: Set<string>;
  conteo: (id: string) => number;
  onVentana: (v: VentanaObra) => void;
  /** Instalación: se marcan varias; el botón «Todo» del departamento las elige de una vez. */
  multiple: boolean;
  onGrupo: (vs: VentanaObra[]) => void;
}

const TarjetaUnidad: React.FC<PropsChips & { nodo: NodoUnidadInstalacion; ventanas: VentanaObra[]; etiqueta: string }> = ({ nodo, ventanas, etiqueta, activas, conteo, onVentana, multiple, onGrupo }) => {
  if (ventanas.length === 0) return null;
  const instaladas = ventanas.filter((v) => v.estado === 'INSTALADA').length;
  const completa = multiple && instaladas === ventanas.length;
  const todasElegidas = ventanas.every((v) => activas.has(v.id));
  return (
    <div className={`rounded-xl border p-2.5 space-y-2 ${completa ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900 truncate">
          <span className="text-[11px] font-normal uppercase tracking-wider text-slate-500 mr-1">{etiqueta}</span>
          {nodo.nombre}
          {multiple && (
            <span className={`ml-2 text-[11px] font-mono font-normal tabular-nums ${completa ? 'text-emerald-700' : 'text-slate-500'}`}>
              {instaladas}/{ventanas.length}
            </span>
          )}
        </p>
        {multiple && !completa && ventanas.length > 1 && (
          <Button size="sm" variant="ghost" leftIcon={<CheckCheck className="w-3.5 h-3.5" />} onClick={() => onGrupo(ventanas)} aria-label={`${todasElegidas ? 'Quitar' : 'Elegir'} todas las ventanas de ${nodo.nombre}`}>
            {todasElegidas ? 'Quitar' : 'Todo'}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {ventanas.map((v) => (
          <ChipVentana key={v.id} v={v} activa={activas.has(v.id)} enCarrito={conteo(v.id)} onClick={() => onVentana(v)} conMarca={multiple} />
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
  proyecto: Pick<Proyecto, 'id' | 'obra' | 'codigoInterno' | 'origen'>;
  modo: 'pendientes' | 'instalacion';
  /** Dentro de la obra (pestaña Pendientes): volver a su lista de pendientes; también se llama al enviar el listado. */
  onCerrar?: () => void;
}

export const EspacioVentanas: React.FC<Props> = ({ proyecto, modo, onCerrar }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const { tiene } = usePermisos();
  const esInstalacion = modo === 'instalacion';
  const dentroDeObra = !!onCerrar;
  const puedeRegistrar = esInstalacion ? tiene('instalacion.certificar') : tiene('pendientes.crear');
  const [refPagina, anchoPagina] = useAnchoContenedor();
  const dosPaneles = anchoPagina >= ANCHO_DOS_PANELES;
  useMigas(dentroDeObra ? 2 : 1, dentroDeObra ? [{ label: 'Nuevos pendientes' }] : [{ label: proyecto.obra, codigo: proyecto.codigoInterno ?? undefined }]);

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('TODAS');
  // Ventanas elegidas en el plano: una en Pendientes, una o varias en Instalación.
  const [elegidas, setElegidas] = useState<string[]>([]);
  // Una columna: se ve el plano o el detalle de lo elegido.
  const [enDetalle, setEnDetalle] = useState(false);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [revisando, setRevisando] = useState(false);
  // Pisos y unidades especiales desplegados (id): todo comienza recogido.
  const [abiertosPisos, setAbiertosPisos] = useState<Set<string>>(new Set());
  const [especialesAbiertas, setEspecialesAbiertas] = useState<Set<string>>(new Set());
  const refArriba = useRef<HTMLDivElement>(null);

  // El listado se guarda en este dispositivo mientras no se envía (con sus fotos): salir de la pantalla, que el
  // navegador recargue la pestaña al volver de la cámara o quedarse sin batería ya no lo pierde. Va por persona y
  // por obra: en una tablet compartida, cada uno ve solo lo suyo.
  const { usuario } = useSession();
  const claveBorrador = `listado:${modo}:${proyecto.id}:${usuario?.email ?? 'local'}`;
  // Clave cuyo borrador ya se leyó: hasta entonces no se guarda (no se pisa lo guardado con el listado vacío).
  const [claveLeida, setClaveLeida] = useState<string | null>(null);
  const borradorListo = claveLeida === claveBorrador;
  useEffect(() => {
    let vigente = true;
    leerBorrador<ItemCarrito[]>(claveBorrador).then((guardado) => {
      if (!vigente) return;
      // Solo lo de esta sección: un listado antiguo de Instalación podía traer pendientes mezclados.
      const propios = (guardado ?? []).filter((c) => c.tipo === (esInstalacion ? 'INSTALACION' : 'PENDIENTE'));
      if (propios.length) {
        setCarrito((actual) => (actual.length ? actual : propios));
        mostrarToast(`Se recuperó un listado sin enviar (${propios.length}).`, { tipo: 'info' });
      }
      setClaveLeida(claveBorrador);
    });
    return () => {
      vigente = false;
    };
  }, [claveBorrador, esInstalacion]);
  useEffect(() => {
    if (!borradorListo) return;
    if (carrito.length) void guardarBorrador(claveBorrador, carrito);
    else void borrarBorrador(claveBorrador);
  }, [carrito, borradorListo, claveBorrador]);
  // Cerrar o recargar la pestaña con algo sin enviar: el navegador pregunta (el borrador queda igual).
  useEffect(() => {
    if (carrito.length === 0) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [carrito.length]);

  const arbol = useQuery<InstalacionObra>({
    queryKey: esInstalacion ? ['instalacion', proyecto.id] : ['ventanasObra', proyecto.id],
    queryFn: () => (esInstalacion ? getInstalacionObra(proyecto.id) : getVentanasObra(proyecto.id)),
  });
  const data = arbol.data;

  // Al abrir se pone al día la fabricación con HETMO (un documento marcado como fabricado allá cambia el estado de sus
  // ventanas acá), sin esperar al sync automático de cada 10 minutos. El API la limita a una vez cada 2 min por obra.
  const { mutate: pedirActualizacion } = useMutation({
    mutationFn: () => actualizarFabricacionesObra(proyecto.id),
    onSuccess: (r) => {
      if (r.omitida || (r.detectadas === 0 && r.refrescadas === 0)) return;
      for (const k of [['instalacion', proyecto.id], ['ventanasObra', proyecto.id], ['fichaVentana', proyecto.id], ['fabricaciones', proyecto.id], ['proyectoDetail', proyecto.id]]) {
        queryClient.invalidateQueries({ queryKey: k });
      }
    },
    // Silencioso: si HETMO no responde, se ve lo último guardado.
    meta: { silencioso: true },
  });
  useEffect(() => {
    pedirActualizacion();
  }, [pedirActualizacion, proyecto.id]);

  // Las ventanas elegidas se toman SIEMPRE del árbol vigente (tras certificar o enviar cambia su estado).
  const ventanaPorId = useMemo(() => {
    const m = new Map<string, VentanaObra>();
    if (!data) return m;
    const todas = [...data.torres.flatMap((t) => [...t.pisos.flatMap((p) => p.unidades.flatMap((u) => u.ventanas)), ...t.especiales.flatMap((u) => u.ventanas)]), ...data.unica, ...data.areasComunes];
    for (const v of todas) m.set(v.id, v);
    return m;
  }, [data]);
  const seleccion = useMemo(() => elegidas.map((id) => ventanaPorId.get(id)).filter((v): v is VentanaObra => !!v), [elegidas, ventanaPorId]);
  const activas = useMemo(() => new Set(elegidas), [elegidas]);
  const unica = seleccion.length === 1 ? seleccion[0] : null;
  const ficha = useQuery({ queryKey: ['fichaVentana', proyecto.id, unica?.id], queryFn: () => getFichaVentana(proyecto.id, unica!.id), enabled: !!unica, staleTime: 60_000 });

  const voc = vocabulario(data?.modo, proyecto.obra);
  const Icono = data?.modo === 'CASA' ? Home : Building2;
  const q = busqueda.trim().toLowerCase();
  const pasa = (v: VentanaObra) => (!q || textoBusqueda(v).includes(q)) && (!esInstalacion || pasaFiltro(v, filtro));
  const conteo = (id: string) => carrito.filter((c) => c.ventana.id === id).length;
  const partesEnListado = (id: string) => carrito.filter((c): c is Extract<ItemCarrito, { tipo: 'INSTALACION' }> => c.tipo === 'INSTALACION' && c.ventana.id === id).map((c) => c.parte as ParteVentana);
  const despachoDe = (v: VentanaObra) => data?.despachosPorRecibir.find((d) => d.items.some((i) => i.ventanaIndividualizadaId === v.id && i.pendiente > 0));
  const irArriba = () => refArriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Tocar una ventana: en Pendientes la abre; en Instalación la marca o desmarca (se certifican varias juntas).
  const tocarVentana = (v: VentanaObra) => {
    if (esInstalacion) {
      setElegidas((ids) => (ids.includes(v.id) ? ids.filter((x) => x !== v.id) : [...ids, v.id]));
      return;
    }
    setElegidas([v.id]);
    if (!dosPaneles) {
      setEnDetalle(true);
      irArriba();
    }
  };
  // «Todo» de un departamento o de un piso: elige las que faltan por certificar; si ya están todas, las quita.
  const tocarGrupo = (vs: VentanaObra[]) => {
    const porCertificar = vs.filter((v) => partesPorInstalar(v, partesEnListado(v.id)).length > 0).map((v) => v.id);
    const ids = porCertificar.length ? porCertificar : vs.map((v) => v.id);
    setElegidas((actual) => (ids.every((id) => actual.includes(id)) ? actual.filter((id) => !ids.includes(id)) : [...new Set([...actual, ...ids])]));
  };
  const soltarSeleccion = () => {
    setElegidas([]);
    setEnDetalle(false);
  };

  const refrescarTodo = () => {
    for (const k of [['pendientes'], ['ventanasObra', proyecto.id], ['instalacion', proyecto.id], ['instalacionObras'], ['fichaVentana', proyecto.id], ['ventanaInstalacion'], ['resumenObra', proyecto.id]]) {
      queryClient.invalidateQueries({ queryKey: k });
    }
  };

  const enviar = useMutation({
    mutationFn: async () => {
      const fallos: string[] = [];
      const hechos = new Set<string>();
      if (!esInstalacion) {
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
      // Una foto compartida por varias ventanas del lote se prepara (reduce) una sola vez.
      const preparadas = new Map<File, ReturnType<typeof prepararArchivo>>();
      const preparar = (f: File) => preparadas.get(f) ?? preparadas.set(f, prepararArchivo(f)).get(f)!;
      for (const it of items) {
        try {
          const { instalacion } = await certificarInstalacion(it.ventana.id, { parte: it.parte, notas: it.notas, forzar: it.forzar });
          hechos.add(it.clave);
          for (const foto of it.fotos) {
            try {
              const listo = await preparar(foto);
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
      mostrarToast(esInstalacion ? `${hechos.size} de ${total} instalación(es) certificada(s).` : `${hechos.size} pendiente(s) ingresado(s).`, { tipo: 'info' });
      // Hasta que se cierre: una foto que no subió no puede pasar inadvertida (pauta 121 de NN/g).
      if (fallos.length) mostrarToast(`${esInstalacion ? 'Quedó pendiente' : 'No se pudo subir'}: ${fallos.join(' · ')}.`, { duracionMs: 0 });
      if (quedan.length === 0) {
        setRevisando(false);
        if (dentroDeObra) onCerrar?.();
      }
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const claveNueva = (ventanaId: string, i: number) => `${ventanaId}-${Date.now()}-${i}`;
  const agregarPendientes = (ps: PendientePreparado[]) => {
    if (!unica) return;
    setCarrito((c) => [...c, ...ps.map((p, i): ItemCarrito => ({ ...p, tipo: 'PENDIENTE', clave: claveNueva(unica.id, c.length + i), ventana: unica }))]);
    mostrarToast(ps.length === 1 ? `Agregado: ${ps[0].resumen}` : `Agregados ${ps.length} pendientes de ${nombreVentana(unica)}`, { tipo: 'info' });
  };
  const agregarInstalaciones = (ps: InstalacionPreparada[]) => {
    setCarrito((c) => [...c, ...ps.map((p, i): ItemCarrito => ({ ...p, tipo: 'INSTALACION', clave: claveNueva(p.ventana.id, c.length + i) }))]);
    mostrarToast(ps.length === 1 ? `Agregado: ${ps[0].resumen}` : `Agregadas ${ps.length} ventanas al listado`, { tipo: 'info' });
    // Lo certificado sale de la selección: se sigue con el siguiente departamento.
    soltarSeleccion();
  };
  const quitar = (clave: string) => {
    setCarrito((c) => c.filter((x) => x.clave !== clave));
    if (carrito.length <= 1) setRevisando(false);
  };
  const nombreItems = esInstalacion ? 'instalaciones' : 'pendientes';
  const vaciar = async () => {
    if (await confirmar({ titulo: `¿Vaciar el listado de ${nombreItems}?`, mensaje: 'Lo que está en el listado se pierde.', confirmar: 'Vaciar', peligro: true })) {
      setCarrito([]);
      setRevisando(false);
    }
  };
  const salir = async () => {
    if (carrito.length === 0 || (await confirmar({ titulo: `¿Salir sin enviar ${carrito.length} pendiente(s)?`, mensaje: 'El listado queda guardado en este dispositivo y vuelve a aparecer cuando entres de nuevo a esta obra.', confirmar: 'Salir' }))) onCerrar?.();
  };

  const hayEstructura = useMemo(() => !!data && (data.torres.some((t) => t.pisos.length || t.especiales.length) || data.unica.length > 0 || data.areasComunes.length > 0), [data]);
  const resumen = data?.resumen;
  const pct = resumen?.total ? Math.round((resumen.INSTALADA / resumen.total) * 100) : 0;
  const filtros: { value: FiltroEstado; label: string; contador: number }[] = resumen
    ? [
        { value: 'TODAS', label: 'Todas', contador: resumen.total },
        { value: 'POR_INSTALAR', label: 'Por instalar', contador: resumen.RECIBIDA },
        { value: 'POR_RECIBIR', label: 'Por recibir', contador: resumen.DESPACHADA },
        { value: 'INSTALADAS', label: 'Instaladas', contador: resumen.INSTALADA },
        { value: 'CON_PENDIENTE', label: 'Con pendiente', contador: resumen.conPendiente },
      ]
    : [];
  const chips: PropsChips = { activas, conteo, onVentana: tocarVentana, multiple: esInstalacion, onGrupo: tocarGrupo };
  const textoEnviar = esInstalacion ? `Certificar ${carrito.length} ${carrito.length === 1 ? 'instalación' : 'instalaciones'}` : `Ingresar ${carrito.length} ${carrito.length === 1 ? 'pendiente' : 'pendientes'}`;

  // ---------- Revisión del listado (página, no ventana emergente) ----------
  const revision = (
    <Seccion
      icono={ShoppingCart}
      titulo={`Listado de ${nombreItems} (${carrito.length})`}
      descripcion="Revisa lo ingresado: se envía todo junto. Queda guardado en este dispositivo hasta enviarlo."
      acciones={
        <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />} disabled={enviar.isPending || carrito.length === 0} onClick={vaciar}>
          Vaciar
        </Button>
      }
      sinRelleno
    >
      <Lista>
        {carrito.map((c) => (
          <FilaLista
            key={c.clave}
            titulo={<span className="font-mono text-sm">{nombreVentana(c.ventana)}</span>}
            acciones={<IconButton icono={X} tono="peligro" etiqueta={`Quitar ${c.resumen}`} disabled={enviar.isPending} onClick={() => quitar(c.clave)} />}
          >
            {c.tipo === 'PENDIENTE' ? (
              <>
                <span className="text-xs">
                  {ETIQUETA_TIPO[c.payload.tipo]} · {ETIQUETA_MOTIVO[c.payload.motivo]}
                </span>
                <span className="block text-xs text-slate-700">{c.resumen}</span>
                {c.archivos.length > 0 && <span className="block">{c.archivos.length} foto(s) o archivo(s) por subir</span>}
              </>
            ) : (
              <>
                <span className="text-xs text-slate-700">{TEXTO_PARTE[c.parte]}</span>
                <span className="block">
                  {c.fotos.length} foto(s){c.forzar ? ' · certificada sin figurar recibida' : ''}
                </span>
              </>
            )}
          </FilaLista>
        ))}
      </Lista>
    </Seccion>
  );

  // ---------- Plano: torre → piso → departamento ----------
  const plano = data && (
    <div className="space-y-2">
      <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Piso 10, depto 1004, V01…" etiqueta="Buscar ventanas" />
      {data.torres.map((torre) => {
        const todasTorre = [...torre.pisos.flatMap((p) => p.unidades.flatMap((u) => u.ventanas)), ...torre.especiales.flatMap((u) => u.ventanas)];
        const visibles = todasTorre.filter(pasa);
        if (visibles.length === 0) return null;
        return (
          <Seccion key={torre.id} icono={Icono} titulo={voc.textoTorre(torre.nombre)} descripcion={esInstalacion ? `${todasTorre.filter((v) => v.estado === 'INSTALADA').length}/${todasTorre.length} instaladas` : `${visibles.length} ventana(s)`} sinRelleno>
            <div className="divide-y divide-slate-100">
              {[...torre.pisos].reverse().map((piso) => {
                const delPiso = piso.unidades.flatMap((u) => u.ventanas);
                const visiblesPiso = delPiso.filter(pasa);
                if (visiblesPiso.length === 0) return null;
                const inst = delPiso.filter((v) => v.estado === 'INSTALADA').length;
                const elegidasPiso = delPiso.filter((v) => activas.has(v.id)).length;
                const cerrado = !abiertosPisos.has(piso.id) && !q;
                return (
                  <div key={piso.id} className="px-3 py-1.5">
                    <BotonColapsar abierto={!cerrado} onClick={() => setAbiertosPisos((s) => alternar(s, piso.id))} className="w-full min-h-10 pointer-coarse:min-h-12">
                      <span className="flex items-center justify-between gap-2 flex-1 text-left">
                        <span className="text-sm font-bold text-slate-800">Piso {piso.numero}</span>
                        <span className="flex items-center gap-2">
                          {elegidasPiso > 0 && <Badge size="sm" variant="brand">{elegidasPiso} elegida(s)</Badge>}
                          <span className={`text-xs font-mono tabular-nums ${esInstalacion && inst === delPiso.length && delPiso.length > 0 ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>{esInstalacion ? `${inst}/${delPiso.length}` : visiblesPiso.length}</span>
                        </span>
                      </span>
                    </BotonColapsar>
                    {!cerrado && (
                      <div className="mt-1 mb-2 space-y-2">
                        {esInstalacion && puedeRegistrar && visiblesPiso.length > 1 && (
                          <Button size="sm" variant="outline" leftIcon={<CheckCheck className="w-3.5 h-3.5" />} onClick={() => tocarGrupo(visiblesPiso)}>
                            {visiblesPiso.every((v) => activas.has(v.id)) ? `Quitar el piso ${piso.numero}` : `Elegir todo el piso ${piso.numero}`}
                          </Button>
                        )}
                        {piso.unidades.map((u) => (
                          <TarjetaUnidad key={u.id} nodo={u} ventanas={u.ventanas.filter(pasa)} etiqueta={voc.unidadCorta} {...chips} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {torre.especiales.length > 0 && torre.especiales.some((u) => u.ventanas.some(pasa)) && (
              <div className="px-3 py-1.5 border-t border-slate-100">
                <BotonColapsar abierto={especialesAbiertas.has(torre.id) || !!q} onClick={() => setEspecialesAbiertas((s) => alternar(s, torre.id))} className="w-full min-h-10 pointer-coarse:min-h-12">
                  <span className="flex items-center justify-between gap-2 flex-1 text-left">
                    <span className="text-sm font-bold text-slate-800">{voc.modo === 'CASA' ? 'Exteriores' : 'Unidades especiales'}</span>
                    <span className="text-xs font-mono text-slate-500">{torre.especiales.flatMap((u) => u.ventanas).filter(pasa).length}</span>
                  </span>
                </BotonColapsar>
                {(especialesAbiertas.has(torre.id) || !!q) && (
                  <div className="mt-1 mb-2 space-y-2">
                    {torre.especiales.map((u) => (
                      <TarjetaUnidad key={u.id} nodo={u} ventanas={u.ventanas.filter(pasa)} etiqueta="" {...chips} />
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
          <div className="p-3 flex flex-wrap gap-2">
            {data.unica.filter(pasa).map((v) => (
              <ChipVentana key={v.id} v={v} activa={activas.has(v.id)} enCarrito={conteo(v.id)} onClick={() => tocarVentana(v)} conMarca={esInstalacion} />
            ))}
          </div>
        </Seccion>
      )}
      {data.areasComunes.filter(pasa).length > 0 && (
        <Seccion titulo="Áreas comunes" sinRelleno>
          <div className="p-3 flex flex-wrap gap-2">
            {data.areasComunes.filter(pasa).map((v) => (
              <ChipVentana key={v.id} v={v} activa={activas.has(v.id)} enCarrito={conteo(v.id)} onClick={() => tocarVentana(v)} conMarca={esInstalacion} />
            ))}
          </div>
        </Seccion>
      )}
      {data.sinPosicion > 0 && <p className="text-xs text-slate-500">{data.sinPosicion} ventana(s) contratadas aún sin posición en la cubicación (no se muestran).</p>}
    </div>
  );

  // ---------- Detalle: ficha de la ventana (si es una) y el registro ----------
  const despachoUnica = unica && esInstalacion ? despachoDe(unica) : undefined;
  const detalle =
    seleccion.length === 0 ? (
      <EstadoVacio
        icono={Square}
        titulo={esInstalacion ? 'Marca las ventanas instaladas' : 'Elige una ventana'}
        descripcion={esInstalacion ? 'Toca una o varias ventanas del plano, o «Todo» en un departamento, y certifícalas juntas, cada una con su foto.' : 'Toca una ventana del plano para ver su ficha y detallar qué falta o qué falló.'}
      />
    ) : (
      <div className="space-y-4">
        {unica ? (
          ficha.isLoading ? (
            <Cargando texto={`Leyendo ${nombreVentana(unica)}…`} />
          ) : ficha.isError || !ficha.data ? (
            <ErrorCarga que="la ventana" onReintentar={ficha.refetch} />
          ) : (
            <Seccion icono={Square} titulo={nombreVentana(unica)}>
              <FichaVentana proyectoId={proyecto.id} ficha={ficha.data} conHistorial={esInstalacion} />
            </Seccion>
          )
        ) : (
          <Seccion
            icono={CheckCheck}
            titulo={`${seleccion.length} ventanas elegidas`}
            descripcion="Se certifican juntas, como ventana completa, cada una con su foto. Toca una para sacarla."
            acciones={
              <Button size="sm" variant="ghost" onClick={soltarSeleccion}>
                Quitar selección
              </Button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {seleccion.map((v) => (
                <ChipVentana key={v.id} v={v} activa enCarrito={0} onClick={() => tocarVentana(v)} conMarca />
              ))}
            </div>
          </Seccion>
        )}

        {despachoUnica && (
          <Aviso
            tono="info"
            titulo={`Viene en el despacho ${despachoUnica.codigo}${despachoUnica.fechaDespacho ? ` (${fecha(despachoUnica.fechaDespacho)})` : ''}, aún sin recibir`}
            accion={
              tiene('instalacion.recibir') ? (
                <Button size="sm" variant="outline" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => navegar('/recepcion-obra', { obra: proyecto.id, despacho: despachoUnica.id })}>
                  Ir a Recepción
                </Button>
              ) : undefined
            }
          >
            Lo normal es acusar recibo antes de certificar la instalación.
          </Aviso>
        )}

        {!puedeRegistrar ? (
          <Aviso tono="neutro">{esInstalacion ? 'Tu rol puede ver el avance, pero no certificar instalaciones.' : 'Tu rol no puede ingresar pendientes.'}</Aviso>
        ) : esInstalacion ? (
          <Seccion titulo={unica ? 'Certificar instalación' : `Certificar ${seleccion.length} ventanas`} descripcion="Queda en el listado; se certifica al enviarlo.">
            <FormularioInstalacion key={elegidas.join('|')} proyectoId={proyecto.id} ventanas={seleccion} enListado={partesEnListado} onAgregar={agregarInstalaciones} />
          </Seccion>
        ) : (
          unica &&
          ficha.data && (
            <Seccion titulo="Pendiente de esta ventana" descripcion="Queda en el listado; puedes agregar varios por ventana.">
              <FormularioPendiente key={unica.id} proyectoId={proyecto.id} ficha={ficha.data} onAgregar={agregarPendientes} />
            </Seccion>
          )
        )}
      </div>
    );

  const verDetalle = !dosPaneles && enDetalle && seleccion.length > 0;
  const hayBarra = !revisando ? carrito.length > 0 || (esInstalacion && !dosPaneles && !verDetalle && seleccion.length > 0) : carrito.length > 0;

  return (
    <div ref={refPagina} className="space-y-4">
      <div ref={refArriba} className="flex flex-wrap items-start justify-between gap-3 scroll-mt-4">
        <div className="min-w-0">
          <h2 className="text-base font-black text-slate-900">{dentroDeObra ? 'Nuevos pendientes' : proyecto.obra}</h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            {esInstalacion ? 'Marca las ventanas instaladas, agrega la foto y envía el listado.' : 'Elige una ventana, indica qué falta o falló y envía el listado.'}
          </p>
        </div>
        {dentroDeObra && (
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={salir}>
            Volver a pendientes
          </Button>
        )}
      </div>

      {revisando ? (
        revision
      ) : (
        <>
          {esInstalacion && resumen && !verDetalle && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  <b className="text-slate-900 text-base tabular-nums">{resumen.INSTALADA}</b> de {resumen.total} ventanas instaladas
                </p>
                <span className="text-sm font-black text-emerald-700 tabular-nums">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-label="Avance de instalación">
                {ORDEN_ESTADO_VENTANA.filter((e: EstadoVentanaObra) => resumen[e] > 0 && e !== 'SIN_POSICION')
                  .reverse()
                  .map((e) => (
                    <span key={e} className={`h-full ${CLASE_BARRA_ESTADO[e]}`} style={{ width: `${(resumen[e] / resumen.total) * 100}%` }} title={`${ETIQUETA_ESTADO_VENTANA[e]}: ${resumen[e]}`} />
                  ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ORDEN_ESTADO_VENTANA.filter((e) => resumen[e] > 0).map((e) => (
                  <Badge key={e} size="sm" variant={VARIANTE_ESTADO_VENTANA[e]}>
                    <span className="inline-flex items-center gap-1">
                      {React.createElement(ICONO_ESTADO_VENTANA[e], { className: 'w-3 h-3', 'aria-hidden': true })}
                      {ETIQUETA_ESTADO_VENTANA[e]} {resumen[e]}
                    </span>
                  </Badge>
                ))}
              </div>
              <Segmentado etiqueta="Filtrar ventanas por estado" opciones={filtros} valor={filtro} onChange={setFiltro} />
            </div>
          )}

          {arbol.isLoading ? (
            <Cargando texto="Leyendo la cubicación de la obra…" />
          ) : arbol.isError || !data ? (
            <ErrorCarga que="la cubicación" onReintentar={arbol.refetch} />
          ) : !hayEstructura ? (
            <EstadoVacio icono={Square} titulo="Esta obra todavía no está cubicada" descripcion="Las ventanas aparecen aquí cuando Fabricación carga la cubicación (torres, pisos y departamentos)." />
          ) : dosPaneles ? (
            /* Tablet horizontal y escritorio: plano (≈1/3) y detalle (≈2/3) lado a lado, cada uno con su propio scroll. */
            <div className={`grid gap-4 items-start ${anchoPagina >= 1100 ? 'grid-cols-[22rem_1fr]' : 'grid-cols-[18rem_1fr]'}`}>
              <div className="sticky top-4 max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain pr-0.5">{plano}</div>
              <div className="min-w-0">{detalle}</div>
            </div>
          ) : verDetalle ? (
            /* Tablet vertical y celular: una columna; el detalle reemplaza al plano y se vuelve con un toque. */
            <div className="space-y-3">
              <Button variant="outline" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => (esInstalacion ? setEnDetalle(false) : soltarSeleccion())}>
                Volver al plano
              </Button>
              {detalle}
            </div>
          ) : (
            plano
          )}
        </>
      )}

      {/* Barra fija: lo siguiente por hacer, siempre abajo a la derecha (se sostiene la tablet por los lados). */}
      {hayBarra && (
        <div className="sticky bottom-2 z-10 rounded-2xl bg-white/95 backdrop-blur border border-slate-300 shadow-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {revisando ? (
            <>
              <Button variant="outline" size="lg" disabled={enviar.isPending} leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => setRevisando(false)}>
                Seguir agregando
              </Button>
              <Button variant="primary" size="lg" leftIcon={<Send className="w-4 h-4" />} isLoading={enviar.isPending} onClick={() => enviar.mutate()} className="max-sm:flex-1">
                {enviar.isPending ? 'Enviando…' : textoEnviar}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-600 min-w-0">
                {carrito.length > 0 ? (
                  <>
                    <b className="text-slate-900 text-sm tabular-nums">{carrito.length}</b> en el listado, sin enviar
                  </>
                ) : (
                  <>
                    <b className="text-slate-900 text-sm tabular-nums">{seleccion.length}</b> elegida(s)
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
                {esInstalacion && !dosPaneles && !verDetalle && seleccion.length > 0 && (
                  <>
                    <Button variant="ghost" size="lg" onClick={soltarSeleccion}>
                      Quitar
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => {
                        setEnDetalle(true);
                        irArriba();
                      }}
                    >
                      {puedeRegistrar ? `Certificar ${seleccion.length}` : `Ver ${seleccion.length}`}
                    </Button>
                  </>
                )}
                {carrito.length > 0 && (
                  <Button
                    variant={esInstalacion && !dosPaneles && !verDetalle && seleccion.length > 0 ? 'outline' : 'primary'}
                    size="lg"
                    leftIcon={<ShoppingCart className="w-4 h-4" />}
                    onClick={() => {
                      setRevisando(true);
                      irArriba();
                    }}
                  >
                    Revisar y enviar ({carrito.length})
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
