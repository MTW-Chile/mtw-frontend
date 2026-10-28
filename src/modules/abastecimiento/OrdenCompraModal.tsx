import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Package, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import {
  completarOrdenCompra,
  createOrdenCompra,
  getAdicionales,
  getBodegaProyecto,
  getMateriales,
  getOrdenCompraById,
  getPartidas,
  getProveedores,
  getProyectoById,
  getProyectos,
  getUltimosPrecios,
  updateOrdenCompraEstado,
  type ItemOrdenCompraPayload,
} from '../../api/client';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Aviso } from '../../components/ui/Aviso';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Segmentado } from '../../components/ui/Segmentado';
import { BotonAlternar } from '../../components/ui/BotonAlternar';
import { BotonFila } from '../../components/ui/Lista';
import { IconButton } from '../../components/ui/IconButton';
import { InputCompacto, OpcionesTarjeta, SelectCompacto, Textarea } from '../../components/ui/Campos';
import { useAnalitica, useRequerimientoFase } from '../cotizaciones/lib/useAnalitica';
import { useParametrosGenerales } from '../../lib/parametrosGenerales';
import { precioCompraCLP, unidadCompra } from '../../lib/formatoMaterial';
import { cantidad as fmtCantidad, clp } from '../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { ETIQUETA_NATURALEZA } from '../../types';
import type { Fase, GrupoRequerimiento, ItemRequerimiento, Material, NaturalezaCompra } from '../../types';

// Descripcion de un item manual: con proveedor elegido busca en vivo en el
// catalogo filtrado a ese proveedor; sin match sigue como texto libre (item
// externo con partida).
const BuscadorProductoProveedor: React.FC<{
  proveedorId: string;
  descripcion: string;
  seleccionado: boolean;
  onCambiarTexto: (valor: string) => void;
  onSeleccionar: (material: Material) => void;
  onQuitarSeleccion: () => void;
}> = ({ proveedorId, descripcion, seleccionado, onCambiarTexto, onSeleccionar, onQuitarSeleccion }) => {
  const [resultados, setResultados] = useState<Material[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (seleccionado || !proveedorId || descripcion.trim().length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getMateriales({ q: descripcion.trim(), proveedorId, limit: 8 });
        if (!cancelado) setResultados(data);
      } catch {
        if (!cancelado) setResultados([]);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [descripcion, proveedorId, seleccionado]);

  if (seleccionado) {
    return (
      <div className="min-h-[34px] flex items-center justify-between gap-1.5 px-2.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] font-bold text-sky-700">
        <span className="flex items-center gap-1.5 truncate">
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{descripcion}</span>
        </span>
        <IconButton icono={X} etiqueta="Quitar del catálogo" onClick={onQuitarSeleccion} className="shrink-0" />
      </div>
    );
  }
  return (
    <div className="relative">
      <InputCompacto
        aria-label="Descripción"
        placeholder={proveedorId ? 'Buscar producto de este proveedor o escribir uno nuevo…' : 'Descripción'}
        value={descripcion}
        onChange={(e) => onCambiarTexto(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        className="w-full"
      />
      {abierto && proveedorId && descripcion.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-lg">
          {buscando ? (
            <div className="p-2.5 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Buscando…
            </div>
          ) : resultados.length === 0 ? (
            <div className="p-2.5 text-[11px] text-slate-400">Sin productos de este proveedor que coincidan: se guarda como ítem nuevo.</div>
          ) : (
            resultados.map((m) => (
              <BotonFila key={m.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onSeleccionar(m); setAbierto(false); }}>
                <div className="text-[11px] font-semibold text-slate-800 leading-tight">{m.descripcion}</div>
                <div className="text-[10px] text-slate-400">
                  {m.skuInterno} · {unidadCompra(m)}
                </div>
              </BotonFila>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const AYUDA_NATURALEZA: Record<NaturalezaCompra, string> = {
  PRESUPUESTO: 'Lo cotizado para esta obra.',
  REPOSICION: 'Rehacer o recomprar algo ya cotizado: consume la holgura de su partida.',
  ADICIONAL: 'Fuera del presupuesto: se cobra al cliente. Se sugiere el precio del maestro.',
};

interface ItemOC {
  clave: string;
  materialId?: string;
  descripcion: string;
  unidadMedida: string;
  /** Lo que pidió la obra (o lo que necesita la fase). 0 en un ítem agregado a mano. */
  solicitado: number;
  /** Stock en la bodega de la obra y en Obras Mayores. */
  obra: number;
  obrasMayores: number;
  /** Lo que se reserva trasladando desde Obras Mayores al guardar. */
  traslado: number;
  /** A comprar (editable). */
  cantidad: string;
  precioUnitario: string;
  /** Precio que venía de la solicitud / cotización, para avisar si el sugerido difiere. */
  precioReferencia: number | null;
  precioEditado: boolean;
  cantidadCalculada: number | null;
  partidaId: string;
  anchoMm?: number | null;
  altoMm?: number | null;
  ventanaId?: string | null;
  referenciaVentana?: string | null;
  sinMedidas?: boolean;
}

type FiltroItems = 'todos' | 'comprar' | 'cubiertos';

const esPieza = (i: Pick<ItemOC, 'anchoMm' | 'altoMm'>) => !!(i.anchoMm && i.altoMm);
const r2 = (n: number) => Math.round(n * 100) / 100;
const itemManual = (): ItemOC => ({
  clave: `manual:${Date.now()}:${Math.random()}`,
  descripcion: '',
  unidadMedida: 'UN',
  solicitado: 0,
  obra: 0,
  obrasMayores: 0,
  traslado: 0,
  cantidad: '',
  precioUnitario: '',
  precioReferencia: null,
  precioEditado: false,
  cantidadCalculada: null,
  partidaId: '',
});
const cubierto = (i: ItemOC) => !!i.materialId && i.solicitado > 0 && !(parseFloat(i.cantidad) > 0);

// Un número de la fila: columna en escritorio, "Etiqueta valor" en angosto.
const Num: React.FC<{ etiqueta: string; children: React.ReactNode; className?: string }> = ({ etiqueta, children, className = '' }) => (
  <span className={`text-[11px] md:text-xs md:text-right font-mono tabular-nums ${className}`}>
    <span className="md:hidden font-sans text-slate-400">{etiqueta} </span>
    {children}
  </span>
);

const mapaStock = (rows: { materialId: string; cantidad: number }[] | undefined) => {
  const mapa = new Map<string, number>();
  (rows || []).forEach((s) => mapa.set(s.materialId, (mapa.get(s.materialId) || 0) + Number(s.cantidad)));
  return mapa;
};

type Props = { onClose: () => void } & ({ modo: 'crear'; solicitudId?: undefined } | { modo: 'completar'; solicitudId: string });

/**
 * Pantalla de Compras (compras.oc.emitir): arma una OC nueva o completa una
 * solicitud de la obra. Tres bloques: qué se compra, a quién, y los ítems con
 * el stock en columnas (Solicitado · Obra · Obras Mayores · Traslado · A
 * comprar · Precio). El pie trae las dos salidas del flujo: guardar en
 * borrador o guardar y pedir aprobación / enviar. Quien pide material desde
 * la obra usa SolicitudMaterialesModal, no esta pantalla.
 */
export const OrdenCompraModal: React.FC<Props> = ({ modo, solicitudId, onClose }) => {
  const queryClient = useQueryClient();
  const [proyectoId, setProyectoId] = useState('');
  const [faseId, setFaseId] = useState('');
  const [naturaleza, setNaturaleza] = useState<NaturalezaCompra>('PRESUPUESTO');
  const [adicionalId, setAdicionalId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [items, setItems] = useState<ItemOC[]>([]);
  const [filtro, setFiltro] = useState<FiltroItems>('todos');
  const [error, setError] = useState<string | null>(null);
  const esAdicional = naturaleza === 'ADICIONAL';

  const { data: solicitud, isLoading: cargandoSolicitud } = useQuery({
    queryKey: ['ordenCompra', solicitudId],
    queryFn: () => getOrdenCompraById(solicitudId!),
    enabled: modo === 'completar',
  });
  // Clave distinta de la lista de Obras en curso (esa pide incluir: 'obra'): misma ruta, respuesta distinta.
  const { data: proyectosData } = useQuery({ queryKey: ['proyectos', 'en-curso', 'basico'], queryFn: () => getProyectos({ limit: 200 }), enabled: modo === 'crear' });
  const proyectosEnCurso = (proyectosData?.data || []).filter((p) => p.versiones[0]?.estadoAprobacion === 'ACEPTADO_CLIENTE');
  const { data: proveedores = [] } = useQuery({ queryKey: ['proveedores'], queryFn: async () => (await getProveedores()).data });
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const { data: adicionales = [] } = useQuery({ queryKey: ['adicionales', proyectoId], queryFn: () => getAdicionales(proyectoId), enabled: !!proyectoId && esAdicional });
  const { data: proyectoDetalle, isLoading: cargandoDetalle } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
    enabled: !!proyectoId && modo === 'crear',
  });
  const { data: bodegaData } = useQuery({ queryKey: ['bodegaProyecto', proyectoId], queryFn: () => getBodegaProyecto(proyectoId), enabled: !!proyectoId });
  const stockObra = useMemo(() => mapaStock(bodegaData?.stock), [bodegaData]);
  const stockObrasMayores = useMemo(() => mapaStock(bodegaData?.stockObrasMayores), [bodegaData]);

  const activeVersion = useMemo(
    () => proyectoDetalle?.versiones.find((v) => v.hetmoId === proyectoDetalle.versionActivaHetmoId) || proyectoDetalle?.versiones[0],
    [proyectoDetalle]
  );
  const fasesReales = (activeVersion?.fases || []).filter((f) => f.numeroFase > 0).sort((a, b) => a.numeroFase - b.numeroFase);
  const opcionesFase: Fase[] = fasesReales.length > 0 ? fasesReales : (activeVersion?.fases || []).filter((f) => f.numeroFase === 0);

  // Crear: materiales que faltan para la fase, por proveedor, ya netos del stock.
  const { data: requerimiento } = useRequerimientoFase(proyectoId, modo === 'crear' && faseId ? faseId : undefined, true);
  const grupos: GrupoRequerimiento[] = requerimiento?.grupos ?? [];
  const trasladosFase = requerimiento?.trasladosDesdeObrasMayores ?? [];

  // Precio comprometido con el cliente por material (toda la versión), para ítems elegidos a mano.
  const parametros = useParametrosGenerales();
  const tasas = {
    dolar: Number(activeVersion?.tipoCambioDolar) || parametros?.tasasRespaldo.dolar || 0,
    euro: Number(activeVersion?.tipoCambioEuro) || parametros?.tasasRespaldo.euro || 0,
    uf: Number(activeVersion?.tipoCambioUF) || parametros?.tasasRespaldo.uf || 0,
  };
  const { data: analitica } = useAnalitica(proyectoId, proyectoId && modo === 'crear' ? activeVersion?.id : undefined);
  const preciosComprometidos = useMemo(() => new Map((analitica?.materiales ?? []).map((m) => [m.materialId, { precioCLP: m.precioCompraNeto, unidadMedida: m.unidad.codigo }])), [analitica]);

  // Último precio pagado a este proveedor por cada material: solo informativo
  // (title y aviso en ámbar). El precio del ítem es el acordado (el de la
  // solicitud / analítica) y no se cambia solo.
  const materialIds = useMemo(() => [...new Set(items.map((i) => i.materialId).filter((x): x is string => !!x))].sort(), [items]);
  const { data: ultimosPrecios = {} } = useQuery({
    queryKey: ['ultimosPrecios', proveedorId, materialIds],
    queryFn: () => getUltimosPrecios(proveedorId, materialIds),
    enabled: !!proveedorId && materialIds.length > 0,
  });
  // Cambiar de obra o de fase invalida lo elegido después (fase, proveedor, ítems).
  const cambiarFase = (id: string) => {
    setFaseId(id);
    setProveedorId('');
    setItems([]);
  };
  const cambiarProyecto = (id: string) => {
    setProyectoId(id);
    setNaturaleza('PRESUPUESTO');
    setAdicionalId('');
    cambiarFase('');
  };

  // Completar: fija obra/comentarios y arma los ítems contra el stock actual, una sola vez.
  const pobladaRef = useRef<string | null>(null);
  // OC ya guardada en un intento anterior que fallo al pedir aprobacion: al
  // reintentar solo se cambia el estado, no se crea otra.
  const ocGuardadaRef = useRef<{ id: string; numero: string } | null>(null);
  useEffect(() => {
    if (modo !== 'completar' || !solicitud) return;
    setProyectoId(solicitud.proyectoId || '');
    setNaturaleza(solicitud.naturaleza);
    setComentarios(solicitud.comentarios || '');
    setFechaEntrega(solicitud.fechaCalendarizada ? solicitud.fechaCalendarizada.slice(0, 10) : '');
  }, [modo, solicitud]);
  useEffect(() => {
    if (modo !== 'completar' || !solicitud) return;
    if (solicitud.proyectoId && !bodegaData) return;
    if (pobladaRef.current === solicitud.id) return;
    pobladaRef.current = solicitud.id;
    setItems(
      solicitud.items.map((it): ItemOC => {
        const solicitado = Number(it.cantidad);
        const pieza = esPieza(it);
        const obra = it.materialId && !pieza ? stockObra.get(it.materialId) || 0 : 0;
        const om = it.materialId && !pieza ? stockObrasMayores.get(it.materialId) || 0 : 0;
        const traslado = r2(Math.min(om, Math.max(0, solicitado - obra)));
        const neta = r2(Math.max(0, solicitado - obra - om));
        return {
          clave: it.id,
          materialId: it.materialId || undefined,
          descripcion: it.descripcion,
          unidadMedida: it.unidadMedida,
          solicitado,
          obra,
          obrasMayores: om,
          traslado,
          cantidad: neta > 0 ? String(neta) : '',
          precioUnitario: it.precioUnitario != null ? String(it.precioUnitario) : '',
          precioReferencia: it.precioUnitario != null ? Number(it.precioUnitario) : null,
          precioEditado: false,
          cantidadCalculada: it.cantidadCalculada,
          partidaId: it.materialId ? '' : it.partidaId,
          anchoMm: it.anchoMm,
          altoMm: it.altoMm,
          ventanaId: it.ventanaId,
          referenciaVentana: it.referenciaVentana,
        };
      })
    );
  }, [modo, solicitud, bodegaData, stockObra, stockObrasMayores]);

  const itemDesdeCalculo = (it: ItemRequerimiento): ItemOC => ({
    clave: `${it.materialId}:${it.ventanaId ?? ''}`,
    materialId: it.materialId,
    descripcion: it.descripcion,
    unidadMedida: it.unidad,
    solicitado: r2(it.cantidad + it.stockDisponible),
    obra: r2(it.stockDisponible - it.cantidadDesdeObrasMayores),
    obrasMayores: it.cantidadDesdeObrasMayores,
    traslado: it.cantidadDesdeObrasMayores,
    cantidad: String(it.cantidad),
    precioUnitario: it.precioUnitario ? String(it.precioUnitario) : '',
    precioReferencia: it.precioUnitario || null,
    precioEditado: false,
    cantidadCalculada: it.cantidadCalculada,
    partidaId: '',
    anchoMm: it.anchoMm,
    altoMm: it.altoMm,
    ventanaId: it.ventanaId,
    referenciaVentana: it.referenciaVentana,
    sinMedidas: it.sinMedidas,
  });
  const elegirGrupo = (g: GrupoRequerimiento) => {
    if (!g.proveedorId) return;
    setProveedorId(g.proveedorId);
    setItems(g.items.map(itemDesdeCalculo));
  };

  const setItem = (clave: string, cambio: Partial<ItemOC>) => setItems((prev) => prev.map((i) => (i.clave === clave ? { ...i, ...cambio } : i)));
  const quitarItem = (clave: string) => setItems((prev) => prev.filter((i) => i.clave !== clave));
  const seleccionarMaterial = (clave: string, m: Material) => {
    const comprometido = proyectoId && !esAdicional ? preciosComprometidos.get(m.id) : undefined;
    const maestro = precioCompraCLP(m, tasas);
    const precio = comprometido ? Math.round(comprometido.precioCLP) : maestro != null ? Math.round(maestro) : null;
    setItem(clave, {
      materialId: m.id,
      descripcion: m.descripcion,
      unidadMedida: comprometido?.unidadMedida || unidadCompra(m),
      partidaId: '',
      obra: stockObra.get(m.id) || 0,
      obrasMayores: stockObrasMayores.get(m.id) || 0,
      precioUnitario: precio != null ? String(precio) : '',
      precioReferencia: precio,
      precioEditado: false,
    });
  };

  const conStock = !!proyectoId;
  const total = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precioUnitario) || 0), 0);
  const aComprar = items.filter((i) => parseFloat(i.cantidad) > 0);
  const cubiertos = items.filter(cubierto);
  const unidadesTraslado = modo === 'crear' ? trasladosFase.reduce((s, t) => s + t.cantidad, 0) : items.reduce((s, i) => s + i.traslado, 0);
  const visibles = filtro === 'todos' ? items : filtro === 'comprar' ? aComprar : cubiertos;
  const requiereAprobacion = modo === 'completar' ? (solicitud?.requiereAprobacion ?? true) : true;

  const guardar = useMutation({
    mutationFn: async (accion: 'borrador' | 'enviar') => {
      if (!proveedorId) throw new Error('Elige a quién se le compra.');
      if (modo === 'crear' && proyectoId && esAdicional && !adicionalId) throw new Error('Elige el adicional que cubre esta compra.');
      const validos = items.filter((i) => parseFloat(i.cantidad) > 0 && i.descripcion.trim());
      if (validos.length === 0) {
        throw new Error(cubiertos.length ? 'Todo lo solicitado está cubierto con stock: no hay nada que comprar. Trasládalo desde Bodega.' : 'Agrega al menos un ítem con cantidad.');
      }
      const sinPrecio = validos.find((i) => !(parseFloat(i.precioUnitario) >= 0) || i.precioUnitario === '');
      if (sinPrecio) throw new Error(`"${sinPrecio.descripcion}" no tiene precio.`);
      const sinPartida = validos.find((i) => !i.materialId && !i.partidaId);
      if (sinPartida) throw new Error(`"${sinPartida.descripcion}" no tiene material del catálogo: elige su partida para el Control de Presupuesto.`);

      const payload: ItemOrdenCompraPayload[] = validos.map((i) => ({
        materialId: i.materialId,
        descripcion: i.descripcion.trim(),
        unidadMedida: i.unidadMedida || 'UN',
        cantidad: parseFloat(i.cantidad),
        cantidadCalculada: i.cantidadCalculada ?? undefined,
        precioUnitario: parseFloat(i.precioUnitario),
        partidaId: i.materialId ? undefined : i.partidaId,
        ...(esPieza(i) ? { anchoMm: i.anchoMm, altoMm: i.altoMm, ventanaId: i.ventanaId, referenciaVentana: i.referenciaVentana } : {}),
      }));

      let oc = ocGuardadaRef.current;
      if (oc) {
        // Ya existe: solo falta el cambio de estado.
      } else if (modo === 'completar') {
        oc = (
          await completarOrdenCompra(solicitudId, {
            proveedorId,
            comentarios: comentarios.trim() || undefined,
            items: payload,
            trasladosDesdeObrasMayores: items.filter((i) => i.materialId && i.traslado > 0.0001).map((i) => ({ materialId: i.materialId!, cantidad: i.traslado })),
          })
        ).ordenCompra;
      } else {
        oc = (
          await createOrdenCompra({
            proyectoId: proyectoId || null,
            faseId: faseId || null,
            naturaleza: proyectoId ? naturaleza : 'PRESUPUESTO',
            adicionalId: esAdicional ? adicionalId || null : null,
            proveedorId,
            fechaCalendarizada: fechaEntrega || null,
            comentarios: comentarios.trim() || undefined,
            items: payload,
            trasladosDesdeObrasMayores: proyectoId ? trasladosFase.map((t) => ({ materialId: t.materialId, cantidad: t.cantidad })) : undefined,
          })
        ).ordenCompra;
      }
      ocGuardadaRef.current = oc;
      if (accion === 'enviar') await updateOrdenCompraEstado(oc.id, requiereAprobacion ? 'PENDIENTE_APROBACION' : 'ENVIADA');
      return { oc, accion };
    },
    onSuccess: ({ oc, accion }) => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['ordenCompra', oc.id] });
      queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
      queryClient.invalidateQueries({ queryKey: ['bodegaProyecto'] });
      mostrarToast(
        accion === 'borrador' ? `${oc.numero} guardada en borrador.` : requiereAprobacion ? `${oc.numero}: aprobación solicitada a Gerencia.` : `${oc.numero} enviada al proveedor.`,
        { tipo: 'info' }
      );
      onClose();
    },
    onError: (e) => {
      setError(extraerErrorParaToast(e).mensaje);
      // Si la OC alcanzo a guardarse, que la lista ya la muestre.
      if (ocGuardadaRef.current) queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
    },
  });

  if (modo === 'completar' && (cargandoSolicitud || !solicitud)) {
    return (
      <Modal icono={ShoppingCart} titulo="Completar solicitud" ancho="xl" onClose={onClose}>
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando solicitud…
        </p>
      </Modal>
    );
  }

  const gridCols = conStock ? 'md:grid-cols-[1fr_5rem_4rem_4.5rem_4.5rem_6rem_6.5rem_6.5rem_2rem]' : 'md:grid-cols-[1fr_6rem_6.5rem_6.5rem_2rem]';
  return (
    <Modal
      icono={ShoppingCart}
      titulo={modo === 'completar' ? `Completar solicitud ${solicitud?.numero}` : 'Nueva orden de compra'}
      subtitulo={
        modo === 'completar'
          ? `${solicitud?.proyecto?.obra ?? solicitud?.centroCosto?.nombre ?? 'Obras Mayores'}${solicitud?.fase ? ` · Fase ${solicitud.fase.numeroFase ?? ''} ${solicitud.fase.nombre}` : ''}`
          : 'Elige qué se compra, a quién, y revisa los ítems contra el stock.'
      }
      ancho="xl"
      onClose={onClose}
      cerrable={!guardar.isPending}
      pie={
        <Modal.Pie
          inicio={
            <span>
              <span className="font-bold text-slate-900">{aComprar.length} ítems a comprar</span>
              {unidadesTraslado > 0 && ` · ${fmtCantidad(unidadesTraslado)} unidades se trasladan desde Obras Mayores`}
              {cubiertos.length > 0 && ` · ${cubiertos.length} cubiertos con stock`}
              <span className="block sm:inline sm:ml-1 font-bold text-slate-900">Total {clp(total)}</span>
            </span>
          }
        >
          <Button variant="outline" onClick={onClose} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button variant="outline" isLoading={guardar.isPending && guardar.variables === 'borrador'} disabled={guardar.isPending} onClick={() => { setError(null); guardar.mutate('borrador'); }}>
            Guardar borrador
          </Button>
          <Button isLoading={guardar.isPending && guardar.variables === 'enviar'} disabled={guardar.isPending} onClick={() => { setError(null); guardar.mutate('enviar'); }}>
            {requiereAprobacion ? 'Guardar y pedir aprobación' : 'Guardar y enviar'}
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}

      {/* ① Qué se compra */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">① Qué se compra</h3>
        {modo === 'completar' && solicitud ? (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{solicitud.proyecto?.obra ?? solicitud.centroCosto?.nombre ?? 'Obras Mayores'}</span>
              {solicitud.fase && <span className="text-slate-500">Fase {solicitud.fase.numeroFase ?? ''} · {solicitud.fase.nombre}</span>}
              <Badge variant="subtle" size="sm">{ETIQUETA_NATURALEZA[solicitud.naturaleza]}</Badge>
              {solicitud.creadoPor?.nombre && <span className="text-slate-500">pedida por {solicitud.creadoPor.nombre}</span>}
            </div>
            {solicitud.comentarios && (
              <p className="text-slate-600">
                <span className="font-semibold">Comentarios de quien pidió:</span> {solicitud.comentarios}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Select
              label="Obra"
              options={[{ value: '', label: 'Sin obra (Obras Mayores)' }, ...proyectosEnCurso.map((p) => ({ value: p.id, label: `${p.codigoInterno || `#${p.numeroPresupuesto}`} · ${p.obra}` }))]}
              value={proyectoId}
              onChange={(e) => cambiarProyecto(e.target.value)}
              helperText="Sin obra, la compra va al stock de Obras Mayores."
            />
            <Select
              label="Fase"
              options={[{ value: '', label: proyectoId ? (cargandoDetalle ? 'Cargando fases…' : 'Sin fase (compra suelta)') : 'Elige primero una obra' }, ...opcionesFase.map((f) => ({ value: f.id, label: `Fase ${f.numeroFase} · ${f.nombre}` }))]}
              value={faseId}
              onChange={(e) => cambiarFase(e.target.value)}
              disabled={!proyectoId || cargandoDetalle}
            />
            {proyectoId && (
              <div className="md:col-span-2 space-y-1.5">
                <OpcionesTarjeta
                  legend="Qué cubre"
                  valor={naturaleza}
                  onChange={setNaturaleza}
                  columnas={3}
                  opciones={(['PRESUPUESTO', 'REPOSICION', 'ADICIONAL'] as NaturalezaCompra[]).map((n) => ({ value: n, label: ETIQUETA_NATURALEZA[n], ayuda: AYUDA_NATURALEZA[n] }))}
                />
                {esAdicional && (
                  <SelectCompacto aria-label="Adicional que cubre la compra" value={adicionalId} onChange={(e) => setAdicionalId(e.target.value)} className={`w-full ${adicionalId ? '' : 'border-amber-300'}`}>
                    <option value="">Elige el adicional que cubre esta compra…</option>
                    {adicionales.filter((a) => a.estado !== 'RECHAZADO' && a.estado !== 'ANULADO').map((a) => (
                      <option key={a.id} value={a.id}>
                        A{a.numero} · {a.titulo} ({a.estado.toLowerCase().replace('_', ' ')})
                      </option>
                    ))}
                  </SelectCompacto>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ② A quién */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">② A quién</h3>
        {modo === 'crear' && faseId && (
          <div className="space-y-1">
            <span className="text-[11px] text-slate-500">Proveedores con materiales que faltan en esta fase (elige uno y se cargan sus ítems):</span>
            {grupos.length === 0 ? (
              <p className="text-[11px] text-slate-400">Nada que comprar para esta fase (sin materiales calculados, o el stock ya cubre todo). Elige un proveedor y agrega ítems a mano.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {grupos.map((g) => (
                  <BotonAlternar
                    key={g.proveedorId || 'sin'}
                    activo={!!g.proveedorId && proveedorId === g.proveedorId}
                    icono={Package}
                    disabled={!g.proveedorId}
                    onClick={() => elegirGrupo(g)}
                    title={!g.proveedorId ? 'Asígnale un proveedor a estos materiales en el Maestro para poder comprarlos' : undefined}
                  >
                    {g.proveedorNombre}
                    <span className="font-mono font-normal opacity-70">· {g.items.length}</span>
                  </BotonAlternar>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={`grid grid-cols-1 gap-3.5 ${modo === 'crear' ? 'md:grid-cols-[1fr_6rem_11rem]' : 'md:grid-cols-[1fr_6rem]'}`}>
          <Select
            label="Proveedor"
            options={[{ value: '', label: 'Elige un proveedor…' }, ...proveedores.map((p) => ({ value: p.id, label: p.nombre }))]}
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            required
          />
          <Input label="Moneda" value="CLP" readOnly disabled />
          {modo === 'crear' && <Input label="Entrega esperada" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} helperText="Opcional" />}
        </div>
      </section>

      {/* ③ Ítems */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">③ Ítems</h3>
          {items.length > 0 && (
            <Segmentado
              etiqueta="Filtrar ítems"
              valor={filtro}
              onChange={setFiltro}
              tamano="xs"
              opciones={[
                { value: 'todos', label: 'Todos', contador: items.length },
                { value: 'comprar', label: 'A comprar', contador: aComprar.length },
                { value: 'cubiertos', label: 'Cubiertos con stock', contador: cubiertos.length },
              ]}
            />
          )}
        </div>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className={`hidden md:grid ${gridCols} gap-2 items-center px-3 py-2 bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500`}>
            <span>Material</span>
            <span className="text-right">Solicitado</span>
            {conStock && <span className="text-right">Obra</span>}
            {conStock && <span className="text-right">O. May.</span>}
            {conStock && <span className="text-right">Traslado</span>}
            <span className="text-right">A comprar</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">
              {modo === 'crear' && !faseId ? 'Elige una fase para cargar lo que falta, o agrega ítems a mano.' : 'Sin ítems todavía.'}
            </p>
          ) : visibles.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">Nada en este filtro.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibles.map((i) => {
                const cant = parseFloat(i.cantidad) || 0;
                const precio = parseFloat(i.precioUnitario) || 0;
                const esCubierto = cubierto(i);
                const ultimo = i.materialId ? ultimosPrecios[i.materialId] : undefined;
                const avisoPrecio =
                  ultimo && i.precioReferencia != null && Math.round(ultimo.precioUnitario) !== Math.round(i.precioReferencia)
                    ? `Último pagado ${clp(ultimo.precioUnitario)} (${ultimo.numeroOC}) · referencia ${clp(i.precioReferencia)}`
                    : ultimo
                      ? `Último pagado ${clp(ultimo.precioUnitario)} (${ultimo.numeroOC})`
                      : i.precioReferencia != null
                        ? `Referencia ${clp(i.precioReferencia)}`
                        : undefined;
                return (
                  <li key={i.clave} className={`px-3 py-2 md:grid ${gridCols} md:gap-2 md:items-center flex flex-wrap gap-x-3 gap-y-1.5 ${esCubierto ? 'text-slate-400 bg-slate-50/50' : ''}`}>
                    <div className="min-w-0 basis-full md:basis-auto">
                      {i.materialId || i.solicitado > 0 ? (
                        <>
                          <p className={`text-xs font-semibold truncate ${esCubierto ? '' : 'text-slate-900'}`}>
                            {i.materialId && <Package className="inline w-3 h-3 text-sky-500 mr-1 -mt-0.5" />}
                            {i.descripcion}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {i.unidadMedida.toLowerCase()}
                            {esPieza(i) && <span className="text-sky-700 font-semibold"> · Pieza {i.anchoMm} × {i.altoMm} mm{i.referenciaVentana ? ` · ${i.referenciaVentana}` : ''}</span>}
                            {i.sinMedidas && <span className="text-amber-700 font-semibold"> · Sin medidas: va por m²</span>}
                            {esCubierto && <span className="text-emerald-700 font-semibold"> · cubierto con stock</span>}
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          <div className="flex-1 min-w-48">
                            <BuscadorProductoProveedor
                              proveedorId={proveedorId}
                              descripcion={i.descripcion}
                              seleccionado={!!i.materialId}
                              onCambiarTexto={(v) => setItem(i.clave, { descripcion: v })}
                              onSeleccionar={(m) => seleccionarMaterial(i.clave, m)}
                              onQuitarSeleccion={() => setItem(i.clave, { materialId: undefined })}
                            />
                          </div>
                          <SelectCompacto aria-label="Partida" value={i.partidaId} onChange={(e) => setItem(i.clave, { partidaId: e.target.value })} className={`w-36 ${i.partidaId ? '' : 'border-amber-300'}`}>
                            <option value="">Partida…</option>
                            {partidas.filter((p) => p.activa).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))}
                          </SelectCompacto>
                          <InputCompacto aria-label="Unidad" value={i.unidadMedida} onChange={(e) => setItem(i.clave, { unidadMedida: e.target.value })} className="w-16" />
                        </div>
                      )}
                    </div>
                    <Num etiqueta="Solicitado">{i.solicitado > 0 ? fmtCantidad(i.solicitado) : '—'}</Num>
                    {conStock && <Num etiqueta="Obra">{esPieza(i) ? '—' : fmtCantidad(i.obra)}</Num>}
                    {conStock && <Num etiqueta="O. May.">{esPieza(i) ? '—' : fmtCantidad(i.obrasMayores)}</Num>}
                    {conStock && (
                      <Num etiqueta="Traslado" className={i.traslado > 0 ? 'text-violet-700 font-bold' : ''}>
                        {i.traslado > 0 ? `➜ ${fmtCantidad(i.traslado)}` : '—'}
                      </Num>
                    )}
                    <span className="flex justify-end">
                      <InputCompacto
                        aria-label={`A comprar de ${i.descripcion || 'ítem'}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={i.cantidad}
                        onChange={(e) => setItem(i.clave, { cantidad: e.target.value })}
                        className="w-20 text-right font-mono"
                      />
                    </span>
                    <span className="flex flex-col items-end">
                      <InputCompacto
                        aria-label={`Precio unitario de ${i.descripcion || 'ítem'}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={i.precioUnitario}
                        onChange={(e) => setItem(i.clave, { precioUnitario: e.target.value, precioEditado: true })}
                        className={`w-24 text-right font-mono ${cant > 0 && !precio ? 'border-amber-300' : ''}`}
                        title={avisoPrecio}
                      />
                      {ultimo && Math.round(ultimo.precioUnitario) !== Math.round(precio) && (
                        <span className="text-[10px] text-amber-700 whitespace-nowrap" title={avisoPrecio}>
                          últ. pagado {clp(ultimo.precioUnitario)}
                        </span>
                      )}
                    </span>
                    <Num etiqueta="Subtotal" className={esCubierto ? '' : 'font-bold text-slate-900'}>
                      {cant > 0 ? clp(cant * precio) : '—'}
                    </Num>
                    <span className="flex justify-end">
                      <IconButton icono={Trash2} tono="peligro" etiqueta="Quitar ítem" onClick={() => quitarItem(i.clave)} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setItems((prev) => [...prev, itemManual()])}>
          Agregar ítem
        </Button>
      </section>

      <Textarea label="Comentarios o instrucciones para el proveedor" value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} placeholder="Ej: entregar en horario de mañana, coordinar con bodega antes de despachar…" />
    </Modal>
  );
};
