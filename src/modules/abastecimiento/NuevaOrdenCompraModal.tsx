import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ShoppingCart, AlertCircle, Plus, Trash2, Package, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  createOrdenCompra,
  completarOrdenCompra,
  getProyectos,
  getProveedores,
  getProyectoById,
  getBodegaProyecto,
  getOrdenCompraById,
  getMateriales,
  getPartidas,
  type ItemOrdenCompraPayload,
} from '../../api/client';
import { useAnalitica, useRequerimientoFase } from '../cotizaciones/lib/useAnalitica';
import { precioCompraCLP, unidadCompra } from '../../lib/formatoMaterial';
import { ETIQUETA_NATURALEZA } from '../../types';
import type { Fase, GrupoRequerimiento, ItemRequerimiento, Material, NaturalezaCompra, ObraPendienteDetalle } from '../../types';
import { useParametrosGenerales } from '../../lib/parametrosGenerales';

// Campo de descripcion de un item manual: con proveedor elegido, busca en
// vivo en el catalogo filtrado a ESE proveedor (Material.proveedorId) para
// sugerir productos ya comprados en vez de escribir todo a mano. Si no hay
// match (o no hay proveedor todavia) sigue funcionando como texto libre --
// el item queda igual como partida externa, solo que sin sugerencias.
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
      <div className="h-[38px] flex items-center justify-between gap-1.5 px-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] font-bold text-sky-700">
        <span className="flex items-center gap-1.5 truncate">
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{descripcion}</span>
        </span>
        <button type="button" onClick={onQuitarSeleccion} title="Quitar del catálogo" className="text-sky-400 hover:text-sky-700 shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder={proveedorId ? 'Buscar producto de este proveedor o escribir uno nuevo...' : 'Descripción'}
        value={descripcion}
        onChange={(e) => onCambiarTexto(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
      />
      {abierto && proveedorId && descripcion.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-lg">
          {buscando ? (
            <div className="p-2.5 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
            </div>
          ) : resultados.length === 0 ? (
            <div className="p-2.5 text-[11px] text-slate-400">Sin productos de este proveedor que coincidan -- se guarda como item nuevo.</div>
          ) : (
            resultados.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSeleccionar(m);
                  setAbierto(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-slate-800 leading-tight">{m.descripcion}</div>
                <div className="text-[10px] text-slate-400">
                  {m.skuInterno} · {unidadCompra(m)}
                  {m.precioOrigen != null &&
                    ` · ${m.precioOrigen.toLocaleString('es-CL')} ${m.formato?.moneda ?? ''}/${m.formato?.unidadPrecio.simbolo ?? m.unidadMedida}`}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

interface NuevaOrdenCompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Cuando se abre desde la ficha de un proyecto ya sabemos el proyecto --
  // se fija y no se puede cambiar, en vez de mostrar el selector completo.
  // Con esto puesto (y sin solicitudId) el modo es "solicitar": no se
  // elige proveedor ni precio, solo se pide -- ver comentario de `modo`.
  proyectoIdFijo?: string;
  proyectoLabelFijo?: string;
  // Cuando se abre desde el boton "Generar OC" de una fase puntual (ver
  // FasesTab) -- precarga esa fase (y sus materiales calculados por
  // proveedor) al abrir, en vez de que el usuario tenga que volver a
  // elegirla del selector.
  faseIdInicial?: string;
  // Cuando se abre desde el boton de UNA partida puntual dentro de una fase
  // (ver FasesTab) -- codigo de la partida: filtra los materiales calculados
  // a solo esa partida y, si todos caen en un unico proveedor, lo deja ya
  // elegido con sus items cargados, lista para enviar sin tocar nada mas.
  partidaFiltro?: string;
  // Cuando se abre para COMPLETAR una solicitud existente (Compras, ver
  // OrdenesCompraList) en vez de crear una OC nueva -- modo "completar".
  solicitudId?: string;
  // Cuando se abre desde un pendiente de obra: la compra queda enlazada a el,
  // su naturaleza parte de la que sugiere el motivo y se precarga su material.
  obraPendiente?: ObraPendienteDetalle;
}

const AYUDA_NATURALEZA: Record<NaturalezaCompra, string> = {
  PRESUPUESTO: 'Lo cotizado para esta obra.',
  REPOSICION: 'Rehacer o recomprar algo ya cotizado (quiebre, falla, daño): consume la holgura de su partida.',
  ADICIONAL: 'Fuera del presupuesto: se cobra al cliente. Se sugiere el precio del maestro, no el comprometido.',
};

interface ItemForm {
  // Presente cuando el item es un material del catalogo -- mtw-api toma la
  // partida del tipo de producto del material, asi que no se pide.
  materialId?: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: string;
  // Valor teorico antes de redondear a la unidad de compra (solo
  // Perfileria/Refuerzos, que se compran por barra entera) -- puramente
  // informativo, se guarda tal cual en OrdenCompraItem.cantidadCalculada.
  cantidadCalculada?: number | null;
  // Modo "crear": cuanto de la necesidad bruta ya se cubrio con stock
  // disponible -- `cantidad` ya viene neta de esto, es solo para mostrar
  // el porque (ver GET /fases/:id/requerimiento).
  stockDisponible?: number;
  // Modo "completar": la cantidad tal como se pidio en la solicitud
  // original, y lo que hay disponible en cada bodega AHORA (puede haber
  // cambiado desde que se solicito) -- `cantidad` viene sugerida ya neta
  // de esto, pero Compras puede ajustarla.
  cantidadSolicitada?: number;
  disponibleObra?: number;
  disponibleObrasMayores?: number;
  precioUnitario: string;
  // Solo items externos (sin material del catalogo): id de la partida.
  partidaId: string;
  // Pieza a medida (vidrios): medidas y ventana de destino. No se contrasta
  // contra stock: una pieza a medida es de su ventana.
  anchoMm?: number | null;
  altoMm?: number | null;
  ventanaId?: string | null;
  referenciaVentana?: string | null;
  // Pieza a medida cuya version aun no trae medidas: va por m².
  sinMedidas?: boolean;
}

const esPieza = (i: Pick<ItemForm, 'anchoMm' | 'altoMm'>) => !!(i.anchoMm && i.altoMm);

const itemVacio = (): ItemForm => ({ descripcion: '', unidadMedida: 'UN', cantidad: '', precioUnitario: '', partidaId: '' });

const itemFormDesdeCalculo = (item: ItemRequerimiento): ItemForm => ({
  materialId: item.materialId,
  descripcion: item.descripcion,
  unidadMedida: item.unidad,
  cantidad: String(item.cantidad),
  cantidadCalculada: item.cantidadCalculada,
  stockDisponible: item.stockDisponible,
  precioUnitario: item.precioUnitario ? String(item.precioUnitario) : '',
  partidaId: '',
  anchoMm: item.anchoMm,
  altoMm: item.altoMm,
  ventanaId: item.ventanaId,
  referenciaVentana: item.referenciaVentana,
  sinMedidas: item.sinMedidas,
});

const fmtCantidad = (n: number | undefined) => (n ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 2 });
const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export const NuevaOrdenCompraModal: React.FC<NuevaOrdenCompraModalProps> = ({
  isOpen,
  onClose,
  proyectoIdFijo,
  proyectoLabelFijo,
  faseIdInicial,
  partidaFiltro,
  solicitudId,
  obraPendiente,
}) => {
  // "solicitar": desde un Proyecto, se pide sin elegir proveedor/precio --
  // Compras la completa despues. "completar": Compras abre una solicitud
  // existente, ve el contraste contra stock y arma el pedido final.
  // "crear": Compras arma una OC nueva y completa de una (con proveedor),
  // igual que antes -- ver PATCH /api/ordenes-compra/:id/completar y POST
  // /api/ordenes-compra en mtw-api.
  const modo: 'solicitar' | 'completar' | 'crear' = solicitudId ? 'completar' : proyectoIdFijo ? 'solicitar' : 'crear';
  const queryClient = useQueryClient();

  const [proyectoId, setProyectoId] = useState(proyectoIdFijo || '');
  const [faseId, setFaseId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [items, setItems] = useState<ItemForm[]>([itemVacio()]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  // Que cubre la compra (se guarda en la OC). Un Adicional es trabajo fuera de
  // lo que el cliente ya aprobo -- al elegir un producto a mano no corresponde
  // sugerirle el precio comprometido de esa obra, se sugiere el del maestro,
  // igual que Obras Mayores. Se vuelve a elegir al cambiar de obra.
  const [naturaleza, setNaturaleza] = useState<NaturalezaCompra>(obraPendiente?.naturalezaSugerida ?? 'PRESUPUESTO');
  const esAdicional = naturaleza === 'ADICIONAL';

  // Solo modo "completar": la solicitud que se esta completando.
  const { data: solicitud, isLoading: cargandoSolicitud } = useQuery({
    queryKey: ['ordenCompra', solicitudId],
    queryFn: () => getOrdenCompraById(solicitudId!),
    enabled: isOpen && modo === 'completar' && !!solicitudId,
  });

  // Mismo queryKey que ProyectosPage/App.tsx (['proyectos', 'en-curso']) --
  // comparte cache, y solo se muestran obras ya aceptadas por el cliente
  // (Cotizaciones deja de ser relevante despues de eso, ver ProyectosPage).
  // Una cotizacion todavia en curso no tiene fases ni bodega, no tiene
  // sentido comprarle nada todavia. Solo aplica al modo "crear" -- en
  // "solicitar"/"completar" el proyecto ya viene fijo.
  const { data: proyectosData } = useQuery({
    queryKey: ['proyectos', 'en-curso'],
    queryFn: () => getProyectos({ limit: 200 }),
    enabled: isOpen && modo === 'crear',
  });
  const proyectosEnCurso = (proyectosData?.data || []).filter((p) => p.versiones[0]?.estadoAprobacion === 'ACEPTADO_CLIENTE');
  const { data: proveedoresData } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => getProveedores(),
    enabled: isOpen,
  });
  // Detalle completo del proyecto (ventanas + materiales + fases) para poder
  // calcular que se necesita comprar por fase -- mismo queryKey que usa
  // ProyectoWorkspace, asi que si se abre esta modal desde ahí, sale del
  // cache de react-query sin pegarle de nuevo al backend. En "completar" no
  // hace falta: los items ya vienen de la solicitud, no se recalculan
  // desde la composicion de la fase.
  const { data: proyectoDetalle, isLoading: cargandoDetalle } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
    enabled: isOpen && !!proyectoId && modo !== 'completar',
  });

  // La ejecucion real de la obra sigue la version activa, igual que en
  // ProyectoWorkspace/Cotizaciones -- no siempre la de versionNumero mas alto.
  const activeVersion = useMemo(() => {
    if (!proyectoDetalle) return undefined;
    return (
      proyectoDetalle.versiones.find((v) => v.hetmoId === proyectoDetalle.versionActivaHetmoId) ||
      proyectoDetalle.versiones[0]
    );
  }, [proyectoDetalle]);

  // Si ya hay fases reales planificadas (Paso "Fases"), se compra por esas
  // -- Fase 0 (el 100% del proyecto tal como llego de HETMO) solo se ofrece
  // cuando todavia no se planifico ninguna fase real.
  const fasesReales = (activeVersion?.fases || []).filter((f) => f.numeroFase > 0).sort((a, b) => a.numeroFase - b.numeroFase);
  const opcionesFase: Fase[] = fasesReales.length > 0 ? fasesReales : (activeVersion?.fases || []).filter((f) => f.numeroFase === 0);

  // Stock ya disponible -- bodega propia (gratis) y Obras Mayores (hay que
  // trasladarlo para reservarlo de verdad, ver trasladosDesdeObrasMayores
  // mas abajo) -- para no sugerir comprar de nuevo algo que ya esta ahi.
  // En "solicitar" no se pide (una solicitud es la necesidad bruta, sin
  // contrastar contra stock todavia -- eso lo hace Compras al completarla).
  const { data: bodegaData } = useQuery({
    queryKey: ['bodegaProyecto', proyectoId],
    queryFn: () => getBodegaProyecto(proyectoId),
    enabled: isOpen && !!proyectoId && modo !== 'solicitar',
  });
  const mapaStock = (rows: { materialId: string; cantidad: number }[] | undefined) => {
    const mapa = new Map<string, number>();
    (rows || []).forEach((s) => mapa.set(s.materialId, (mapa.get(s.materialId) || 0) + Number(s.cantidad)));
    return mapa;
  };
  const stockProyectoPorMaterial = useMemo(() => mapaStock(bodegaData?.stock), [bodegaData]);
  const stockObrasMayoresPorMaterial = useMemo(() => mapaStock(bodegaData?.stockObrasMayores), [bodegaData]);

  // Materiales necesarios para fabricar la fase elegida, agrupados por
  // proveedor (GET /fases/:id/requerimiento de mtw-api): cantidades de la
  // Analitica prorrateadas a la fase, en unidad de compra (ej. barras
  // enteras), con el precio de compra (con el descuento de su partida; la
  // holgura no va al precio). En
  // "crear" ya vienen netos del stock de la obra y de Obras Mayores; en
  // "solicitar" es la necesidad bruta (Compras contrasta al completarla).
  const parametros = useParametrosGenerales();
  const tasaDolar = Number(activeVersion?.tipoCambioDolar) || parametros?.tasasRespaldo.dolar || 0;
  const tasaUf = Number(activeVersion?.tipoCambioUF) || parametros?.tasasRespaldo.uf || 0;
  const tasaEuro = Number(activeVersion?.tipoCambioEuro) || parametros?.tasasRespaldo.euro || 0;
  const { data: requerimiento } = useRequerimientoFase(
    proyectoId,
    isOpen && modo !== 'completar' && faseId ? faseId : undefined,
    modo !== 'solicitar'
  );
  const { gruposPorProveedor, trasladosDesdeObrasMayores } = useMemo(() => {
    const grupos: GrupoRequerimiento[] = requerimiento?.grupos ?? [];
    const traslados = requerimiento?.trasladosDesdeObrasMayores ?? [];
    if (!partidaFiltro) return { gruposPorProveedor: grupos, trasladosDesdeObrasMayores: traslados };
    return {
      gruposPorProveedor: grupos
        .map((g) => ({ ...g, items: g.items.filter((it) => it.partida.codigo === partidaFiltro) }))
        .filter((g) => g.items.length > 0),
      trasladosDesdeObrasMayores: traslados.filter((t) => t.partida.codigo === partidaFiltro),
    };
  }, [requerimiento, partidaFiltro]);

  // Partidas para clasificar los items externos (sin material del catalogo).
  const { data: partidas } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas, enabled: isOpen });
  const opcionesPartida = [
    { value: '', label: 'Partida...' },
    ...(partidas || []).filter((p) => p.activa).map((p) => ({ value: p.id, label: p.nombre })),
  ];

  // Precio comprometido por material: el de la Analitica de TODA la version
  // del proyecto (no solo lo que necesita la fase elegida) -- un material del
  // presupuesto aprobado que no sea parte de esta fase igual tiene un precio
  // ya comprometido con el cliente. Se usa al elegir un producto a mano (ver
  // seleccionarMaterialEnItem) cuando la obra no es Adicional; sin proyecto,
  // o marcado Adicional, se usa el precio del maestro en su lugar.
  const { data: analitica } = useAnalitica(proyectoId, isOpen && proyectoId && modo !== 'completar' ? activeVersion?.id : undefined);
  const preciosComprometidosPorMaterial = useMemo(
    // Precio de compra con el descuento de la partida; la holgura es presupuesto, no precio.
    () => new Map((analitica?.materiales ?? []).map((m) => [m.materialId, { precioCLP: m.precioCompraNeto, unidadMedida: m.unidad.codigo }])),
    [analitica]
  );

  // Cambiar de proyecto o de fase invalida cualquier proveedor/items que ya
  // se hubieran elegido -- evita mezclar items de una fase con el proveedor
  // armado para otra. Adicional se vuelve a preguntar por cada obra (ver
  // selector mas abajo) en vez de arrastrarse de una obra a otra.
  useEffect(() => {
    setFaseId('');
    setNaturaleza(obraPendiente?.naturalezaSugerida ?? 'PRESUPUESTO');
  }, [proyectoId]);

  // Precarga de fase al abrir desde "Generar OC" (ver faseIdInicial) --
  // corre despues del reset de arriba en el mismo commit si proyectoId
  // tambien cambio, asi que el valor final es siempre el de la fase
  // pedida, no ''.
  useEffect(() => {
    if (isOpen && faseIdInicial) {
      setFaseId(faseIdInicial);
    }
  }, [isOpen, faseIdInicial]);

  useEffect(() => {
    // En "completar" los items vienen de la solicitud, no de este calculo
    // -- ver el efecto que puebla `items` desde `solicitud` mas abajo.
    if (modo === 'completar') return;
    setProveedorId('');
    setItems([itemVacio()]);
  }, [faseId, modo]);

  // Desde un pendiente de obra: se precarga su material (y, si es una pieza a
  // medida, sus medidas -- las rectificadas si las hay -- y su ventana).
  useEffect(() => {
    if (!isOpen || !obraPendiente || modo === 'completar') return;
    setNaturaleza(obraPendiente.naturalezaSugerida);
    const m = obraPendiente.material;
    if (!m) return;
    const ancho = Number(obraPendiente.anchoRectificadoMm ?? obraPendiente.anchoOriginalMm) || 0;
    const alto = Number(obraPendiente.altoRectificadoMm ?? obraPendiente.altoOriginalMm) || 0;
    const pieza = m.tipoProducto?.compraPorPieza && ancho > 0 && alto > 0;
    setItems([
      {
        ...itemVacio(),
        materialId: m.id,
        descripcion: pieza ? `${m.skuInterno} · ${m.descripcion} · ${Math.round(ancho)} × ${Math.round(alto)} mm` : `${m.skuInterno} · ${m.descripcion}`,
        cantidad: '1',
        ...(pieza ? { anchoMm: Math.round(ancho), altoMm: Math.round(alto), referenciaVentana: obraPendiente.ventanaRef } : {}),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, obraPendiente?.id, faseId]);

  // Modo "completar": fija el proyecto de la solicitud en cuanto carga
  // (dispara el fetch de su bodega) y precarga los comentarios.
  useEffect(() => {
    if (modo === 'completar' && solicitud) {
      setProyectoId(solicitud.proyectoId || '');
      setComentarios(solicitud.comentarios || '');
    }
  }, [modo, solicitud]);

  // Modo "completar": arma los items desde la solicitud, contrastados
  // contra el stock ACTUAL (puede haber cambiado desde que se solicito) --
  // una sola vez por solicitud, para no pisar lo que Compras ya edito.
  const solicitudPobladaRef = useRef<string | null>(null);
  useEffect(() => {
    if (modo !== 'completar' || !solicitud || !isOpen) return;
    if (!bodegaData) return; // esperando el stock
    if (solicitudPobladaRef.current === solicitud.id) return;
    solicitudPobladaRef.current = solicitud.id;
    setItems(
      solicitud.items.length
        ? solicitud.items.map((it): ItemForm => {
            const cantidadSolicitada = Number(it.cantidad);
            const pieza = esPieza(it);
            const disponibleObra = it.materialId && !pieza ? stockProyectoPorMaterial.get(it.materialId) || 0 : 0;
            const disponibleObrasMayores = it.materialId && !pieza ? stockObrasMayoresPorMaterial.get(it.materialId) || 0 : 0;
            const neta = Math.max(0, cantidadSolicitada - disponibleObra - disponibleObrasMayores);
            return {
              materialId: it.materialId || undefined,
              descripcion: it.descripcion,
              unidadMedida: it.unidadMedida,
              cantidad: String(neta || cantidadSolicitada),
              cantidadCalculada: it.cantidadCalculada,
              cantidadSolicitada,
              disponibleObra,
              disponibleObrasMayores,
              precioUnitario: it.precioUnitario != null ? String(it.precioUnitario) : '',
              partidaId: it.materialId ? '' : it.partidaId,
              anchoMm: it.anchoMm,
              altoMm: it.altoMm,
              ventanaId: it.ventanaId,
              referenciaVentana: it.referenciaVentana,
            };
          })
        : [itemVacio()]
    );
  }, [modo, solicitud, isOpen, bodegaData, stockProyectoPorMaterial, stockObrasMayoresPorMaterial]);

  const elegirGrupoProveedor = (grupo: GrupoRequerimiento) => {
    if (!grupo.proveedorId) return; // sin proveedor asignado: no se puede generar OC para este grupo
    setProveedorId(grupo.proveedorId);
    setItems(grupo.items.length ? grupo.items.map(itemFormDesdeCalculo) : [itemVacio()]);
  };

  // Con partidaFiltro (boton de una partida puntual en FasesTab): si esa
  // partida cae entera en un unico proveedor, se elige solo -- el caso comun
  // (Vidrios de un solo vidriero, Perfileria de un solo distribuidor). Si
  // hay mas de un proveedor para la misma partida, no se puede armar una
  // sola OC igual (una OC es de un proveedor) -- queda el selector de chips
  // de abajo, ya filtrado a solo esos proveedores, para elegir a mano.
  useEffect(() => {
    if (isOpen && partidaFiltro && gruposPorProveedor.length === 1) {
      elegirGrupoProveedor(gruposPorProveedor[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, partidaFiltro, gruposPorProveedor]);

  const mutation = useMutation({
    mutationFn: async () => {
      // En "solicitar" todavia no hay proveedor/precio -- eso lo decide
      // Compras al completarla. En los otros dos modos, la OC ya queda
      // lista para pedir aprobacion, asi que ambos son obligatorios.
      if (modo !== 'solicitar' && !proveedorId) {
        throw new Error('Proveedor es obligatorio.');
      }
      const itemsValidos = items.filter((i) => i.descripcion.trim() && i.cantidad && (modo === 'solicitar' || i.precioUnitario));
      if (itemsValidos.length === 0) {
        throw new Error(modo === 'solicitar' ? 'Agrega al menos un item con descripción y cantidad.' : 'Agrega al menos un item con descripción, cantidad y precio.');
      }
      if (itemsValidos.some((i) => !i.materialId && !i.partidaId)) {
        throw new Error('Elige una partida para cada item sin material del catálogo -- sirve para el Control de Presupuesto.');
      }

      const itemsPayload: ItemOrdenCompraPayload[] = itemsValidos.map((i) => ({
        materialId: i.materialId,
        descripcion: i.descripcion.trim(),
        unidadMedida: i.unidadMedida || 'UN',
        cantidad: parseFloat(i.cantidad),
        cantidadCalculada: i.cantidadCalculada ?? undefined,
        precioUnitario: i.precioUnitario ? parseFloat(i.precioUnitario) : undefined,
        partidaId: i.materialId ? undefined : i.partidaId,
        ...(esPieza(i) ? { anchoMm: i.anchoMm, altoMm: i.altoMm, ventanaId: i.ventanaId, referenciaVentana: i.referenciaVentana } : {}),
      }));

      if (modo === 'completar') {
        // El material que ya esta en Obras Mayores se reserva de verdad
        // (traslado real) recien ahora, al completar -- independiente de
        // la cantidad final que Compras decida comprar (ver comentario de
        // disponibleObrasMayores en ItemForm).
        return completarOrdenCompra(solicitudId!, {
          proveedorId,
          comentarios: comentarios.trim() || undefined,
          items: itemsPayload,
          trasladosDesdeObrasMayores: items
            .filter((i) => i.materialId && (i.disponibleObrasMayores || 0) > 0.0001)
            .map((i) => ({
              materialId: i.materialId!,
              cantidad: Math.min(i.disponibleObrasMayores || 0, (i.cantidadSolicitada ?? 0) - (i.disponibleObra || 0)),
            }))
            .filter((t) => t.cantidad > 0.0001),
        });
      }

      return createOrdenCompra({
        // Sin proyectoId, la OC va al centro de costo GENERAL ("Obras
        // Mayores", ver resolverCentroCosto en mtw-api).
        proyectoId: proyectoId || null,
        faseId: faseId || null,
        naturaleza: proyectoId ? naturaleza : 'PRESUPUESTO',
        obraPendienteId: obraPendiente?.id ?? null,
        // En "solicitar" nunca se manda -- aunque haya un chip de
        // proveedor elegido arriba (solo sirve para agrupar los items),
        // mandarlo la convertiria en una OC completa, no una solicitud.
        proveedorId: modo === 'solicitar' ? undefined : proveedorId,
        comentarios: comentarios.trim() || undefined,
        items: itemsPayload,
        // Todo lo que esta fase/categoria ya tiene disponible en Obras
        // Mayores se traslada a la bodega del proyecto al generar la OC
        // (queda reservado ahi) -- solo tiene sentido en modo "crear": una
        // solicitud sin proveedor todavia no reserva nada (eso pasa al
        // completarla, ver arriba).
        trasladosDesdeObrasMayores:
          modo === 'crear' && proyectoId
            ? trasladosDesdeObrasMayores.map((t) => ({ materialId: t.materialId, cantidad: t.cantidad }))
            : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      if (modo === 'completar') {
        queryClient.invalidateQueries({ queryKey: ['ordenCompra', solicitudId] });
        // Completar puede dejarla lista para pedir aprobacion gerencial de
        // una en un paso posterior -- no cambia acá, pero mantiene el
        // listado de pendientes consistente si algo mas lo invalida.
        queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
      }
      handleClose();
    },
    onError: (err: any) => {
      setGeneralError(
        err?.response?.data?.error ||
          err?.message ||
          (modo === 'solicitar' ? 'No se pudo guardar la solicitud.' : 'No se pudo guardar la Orden de Compra.')
      );
    },
  });

  const handleClose = () => {
    setProyectoId(proyectoIdFijo || '');
    setFaseId('');
    setProveedorId('');
    setComentarios('');
    setItems([itemVacio()]);
    setNaturaleza(obraPendiente?.naturalezaSugerida ?? 'PRESUPUESTO');
    setGeneralError(null);
    solicitudPobladaRef.current = null;
    onClose();
  };

  const setItemField = (index: number, campo: keyof ItemForm, valor: string) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [campo]: valor } : it)));
  };

  const agregarItem = () => setItems((prev) => [...prev, itemVacio()]);
  const quitarItem = (index: number) => setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  // Elegir un producto sugerido del buscador: lo liga al catalogo (igual
  // que un item que ya venia calculado por fase) y precarga unidad/precio.
  // Con una obra elegida y SIN marcar Adicional, el precio sugerido es el
  // ya comprometido con el cliente en el presupuesto aprobado (si ese
  // material esta en el); en cualquier otro caso (Obras Mayores, o
  // Adicional) se sugiere el precio del maestro. La persona puede seguir
  // editando el precio igual en ambos casos.
  const seleccionarMaterialEnItem = (index: number, material: Material) => {
    const comprometido = proyectoId && !esAdicional ? preciosComprometidosPorMaterial.get(material.id) : undefined;
    const precioReferencial = comprometido ? Math.round(comprometido.precioCLP) : (() => {
      const maestro = precioCompraCLP(material, { dolar: tasaDolar, euro: tasaEuro, uf: tasaUf });
      return maestro != null ? Math.round(maestro) : null;
    })();
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              materialId: material.id,
              descripcion: material.descripcion,
              // Ambos precios vienen por unidad de compra (ej. BARRA para
              // Perfileria, no el metro de catalogo): la unidad va con el precio.
              unidadMedida: comprometido?.unidadMedida || unidadCompra(material),
              partidaId: '',
              precioUnitario: precioReferencial != null ? String(precioReferencial) : it.precioUnitario,
            }
          : it
      )
    );
  };
  // Vuelve el item a texto libre (item externo) -- la descripcion queda
  // como estaba, solo se desliga del material para poder elegir partida.
  const quitarMaterialDeItem = (index: number) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, materialId: undefined } : it)));
  };

  const total = items.reduce((sum, i) => sum + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precioUnitario) || 0), 0);

  if (!isOpen) return null;

  if (modo === 'completar' && (cargandoSolicitud || !solicitud)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl px-6 py-5 flex items-center gap-2.5 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando solicitud...
        </div>
      </div>
    );
  }

  const proyectoOptions = [
    { value: '', label: 'Sin proyecto (Obras Mayores)' },
    ...proyectosEnCurso.map((p) => ({
      value: p.id,
      label: `${p.codigoInterno || `#${p.numeroPresupuesto}`} - ${p.obra}`,
    })),
  ];
  const faseOptions = [
    { value: '', label: proyectoId ? 'Selecciona una fase...' : 'Elige primero un proyecto' },
    ...opcionesFase.map((f) => ({ value: f.id, label: f.numeroFase === 0 ? `Fase 0 - ${f.nombre}` : `Fase ${f.numeroFase} - ${f.nombre}` })),
  ];
  const proveedorOptions = [
    { value: '', label: 'Selecciona un proveedor...' },
    ...(proveedoresData?.data.map((p) => ({ value: p.id, label: p.nombre })) || []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                {modo === 'solicitar' ? 'Solicitud de Materiales' : modo === 'completar' ? 'Completar solicitud' : 'Nueva Orden de Compra'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {modo === 'solicitar'
                  ? 'Se manda a Compras -- ellos eligen proveedor y precio, y la envían'
                  : modo === 'completar'
                    ? `${solicitud?.numero} -- elige proveedor y ajusta cantidades/precios antes de enviarla`
                    : 'Se crea en BORRADOR -- el número se genera automáticamente'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setGeneralError(null);
            mutation.mutate();
          }}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {modo === 'completar' ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <p className="font-bold text-slate-900">
                {solicitud?.proyecto?.obra || solicitud?.centroCosto?.nombre || 'Obras Mayores'}
              </p>
              {solicitud?.fase && (
                <p className="text-slate-500">
                  Fase {solicitud.fase.numeroFase ?? ''} - {solicitud.fase.nombre}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {proyectoIdFijo ? (
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Proyecto (obra)</span>
                  <div className="w-full py-2.5 px-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 font-semibold">
                    {proyectoLabelFijo || 'Proyecto actual'}
                  </div>
                </div>
              ) : (
                <Select
                  label="Proyecto (obra)"
                  options={proyectoOptions}
                  value={proyectoId}
                  onChange={(e) => setProyectoId(e.target.value)}
                  helperText="Sin proyecto, la compra va al stock de Obras Mayores"
                />
              )}
              <Select
                label="Fase"
                options={faseOptions}
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
                disabled={!proyectoId || cargandoDetalle}
                helperText={cargandoDetalle ? 'Cargando fases del proyecto...' : undefined}
              />
            </div>
          )}

          {modo !== 'completar' && proyectoId && (
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Qué cubre esta compra
                {obraPendiente && <span className="ml-1.5 normal-case font-normal text-slate-500">(pendiente {obraPendiente.numero})</span>}
              </span>
              <div role="radiogroup" className="grid grid-cols-3 gap-1.5">
                {(['PRESUPUESTO', 'REPOSICION', 'ADICIONAL'] as NaturalezaCompra[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={naturaleza === n}
                    onClick={() => setNaturaleza(n)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      naturaleza === n ? 'bg-brand-600/10 text-brand-700 border-brand-600/40' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {ETIQUETA_NATURALEZA[n]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">{AYUDA_NATURALEZA[naturaleza]}</p>
            </div>
          )}

          {modo !== 'completar' && faseId && (
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {partidaFiltro
                  ? `Proveedores de ${partidas?.find((p) => p.codigo === partidaFiltro)?.nombre ?? partidaFiltro} en esta fase`
                  : 'Proveedores con materiales en esta fase'}
              </span>
              {gruposPorProveedor.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  {partidaFiltro
                    ? `Esta fase no tiene materiales calculados de esta partida. ${modo === 'solicitar' ? 'Agrega un item manual abajo para una compra externa.' : 'Elige un proveedor manualmente abajo para una compra externa.'}`
                    : `Esta fase no tiene materiales calculados (¿tiene líneas de ventana asignadas en la pestaña Fases?). ${modo === 'solicitar' ? 'Agrega un item manual abajo para una compra externa (flete, mano de obra, etc.).' : 'Elige un proveedor manualmente abajo para una compra externa (flete, mano de obra, etc.).'}`}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {gruposPorProveedor.map((g) => {
                    const activo = !!g.proveedorId && proveedorId === g.proveedorId;
                    const sinProveedor = !g.proveedorId;
                    return (
                      <button
                        key={g.proveedorId || 'sin-proveedor'}
                        type="button"
                        disabled={sinProveedor}
                        onClick={() => elegirGrupoProveedor(g)}
                        title={sinProveedor ? 'Asígnale un proveedor a estos materiales en el Maestro para poder generar una OC' : undefined}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                          activo
                            ? 'bg-brand-600/10 text-brand-600 border-brand-600/30'
                            : sinProveedor
                              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        {g.proveedorNombre}
                        <span className="font-mono font-normal opacity-70">
                          · {g.items.length} {g.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {modo !== 'solicitar' && (
            <Select
              label="Proveedor"
              options={proveedorOptions}
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              helperText={
                modo === 'completar'
                  ? 'A quién se le va a comprar -- elige uno para poder guardar'
                  : 'Se llena solo al elegir un proveedor arriba -- se puede cambiar a mano para una compra externa'
              }
              required
            />
          )}

          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
            {modo === 'solicitar'
              ? 'Se manda como solicitud a Compras -- ellos eligen el proveedor, ajustan precios/cantidades contra el stock disponible, y la envían.'
              : modo === 'completar'
                ? 'Al guardar, el material que ya esté disponible en Obras Mayores se traslada de verdad a la bodega de la obra (queda reservado). Después podés pedirle aprobación a Gerencia desde el listado.'
                : 'Esta queda en Borrador -- pedile la aprobación a Gerencia y envíala al proveedor desde el listado cuando esté lista.'}
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Comentarios o instrucciones especiales
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Ej: entregar en horario de mañana, coordinar con bodega antes de despachar..."
              rows={3}
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 transition-all resize-none"
            />
          </div>

          <div className="space-y-2.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">Items</span>

            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="px-3 py-2 font-bold">Descripción</th>
                    <th className="px-3 py-2 font-bold w-36">Partida</th>
                    <th className="px-3 py-2 font-bold w-20">Unidad</th>
                    <th className="px-3 py-2 font-bold text-right w-24">Cantidad</th>
                    {modo !== 'solicitar' && <th className="px-3 py-2 font-bold text-right w-28">Precio unit.</th>}
                    <th className="px-3 py-2 font-bold text-right w-28">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const subtotal = (parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0);
                    return (
                      <tr key={index} className="border-b border-slate-50 align-top">
                        <td className="px-3 py-2 min-w-[200px]">
                          <BuscadorProductoProveedor
                            proveedorId={proveedorId}
                            descripcion={item.descripcion}
                            seleccionado={!!item.materialId}
                            onCambiarTexto={(valor) => setItemField(index, 'descripcion', valor)}
                            onSeleccionar={(material) => seleccionarMaterialEnItem(index, material)}
                            onQuitarSeleccion={() => quitarMaterialDeItem(index)}
                          />
                          {esPieza(item) && (
                            <p className="text-[10px] font-semibold text-sky-700 mt-1">
                              Pieza {item.anchoMm} × {item.altoMm} mm{item.referenciaVentana ? ` · ${item.referenciaVentana}` : ''}
                            </p>
                          )}
                          {item.sinMedidas && (
                            <p className="text-[10px] text-amber-700 mt-1">
                              Sin medidas de HETMO todavía: va por m². Pide que se completen las medidas de los vidrios.
                            </p>
                          )}
                          {modo === 'completar' && item.materialId && !esPieza(item) && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              Solicitado {fmtCantidad(item.cantidadSolicitada)} · Obra: {fmtCantidad(item.disponibleObra)} · Obras Mayores:{' '}
                              {fmtCantidad(item.disponibleObrasMayores)}
                            </p>
                          )}
                          {modo !== 'completar' && !!item.stockDisponible && (
                            <p className="text-[10px] text-slate-400 mt-1">Ya tenías {fmtCantidad(item.stockDisponible)} en stock</p>
                          )}
                          {modo === 'solicitar' && item.precioUnitario && (
                            <p className="text-[10px] text-slate-400 mt-1">Precio referencial: {formatCLP(Number(item.precioUnitario))}</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {item.materialId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-[10px] font-bold text-sky-700 whitespace-nowrap">
                              <Package className="w-3 h-3 shrink-0" /> Del catálogo
                            </span>
                          ) : (
                            <Select
                              options={opcionesPartida}
                              value={item.partidaId}
                              onChange={(e) => setItemField(index, 'partidaId', e.target.value)}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.unidadMedida}
                            onChange={(e) => setItemField(index, 'unidadMedida', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => setItemField(index, 'cantidad', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-mono text-right"
                          />
                        </td>
                        {modo !== 'solicitar' && (
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.precioUnitario}
                              onChange={(e) => setItemField(index, 'precioUnitario', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-mono text-right"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{formatCLP(subtotal)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => quitarItem(index)}
                            disabled={items.length === 1}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/70 font-bold">
                    <td className="px-3 py-2 text-slate-600" colSpan={modo === 'solicitar' ? 4 : 5}>
                      {modo === 'solicitar' ? 'Total referencial' : 'Total estimado'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900">{formatCLP(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={agregarItem}>
              Agregar item
            </Button>
          </div>
        </form>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" isLoading={mutation.isPending} onClick={() => { setGeneralError(null); mutation.mutate(); }}>
            {modo === 'solicitar' ? 'Solicitar Materiales' : modo === 'completar' ? 'Guardar y completar' : 'Crear Orden de Compra'}
          </Button>
        </div>
      </div>
    </div>
  );
};
