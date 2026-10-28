import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { createOrdenCompra, getAdicionales, getBodegaProyecto, getMateriales, getPartidas, getProyectoById } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Aviso } from '../../../components/ui/Aviso';
import { Select } from '../../../components/ui/Select';
import { Segmentado } from '../../../components/ui/Segmentado';
import { Buscador } from '../../../components/ui/Buscador';
import { BotonFila } from '../../../components/ui/Lista';
import { IconButton } from '../../../components/ui/IconButton';
import { Casilla, InputCompacto, OpcionesTarjeta, SelectCompacto, Textarea } from '../../../components/ui/Campos';
import { useRequerimientoFase } from '../../cotizaciones/lib/useAnalitica';
import { unidadCompra } from '../../../lib/formatoMaterial';
import { cantidad as fmtCantidad, clp } from '../../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { ETIQUETA_NATURALEZA } from '../../../types';
import type { Fase, Material, NaturalezaCompra, ObraPendienteDetalle } from '../../../types';
import {
  categoriaDe,
  conteoCategorias,
  estadoInicialSolicitud,
  faltante,
  filasDesdeRequerimiento,
  filtrarFilas,
  itemsSolicitud,
  resumenSolicitud,
  validarSolicitud,
  type CategoriaSolicitud,
  type EstadoSolicitud,
  type FilaSolicitud,
} from './solicitud';

const AYUDA_NATURALEZA: Record<NaturalezaCompra, string> = {
  PRESUPUESTO: 'Lo cotizado para esta obra.',
  REPOSICION: 'Rehacer o recomprar algo ya cotizado (quiebre, falla, daño).',
  ADICIONAL: 'Fuera del presupuesto: se cobra al cliente.',
};

interface Props {
  proyectoId: string;
  /** Nombre de la obra para el título; si no viene, se toma del proyecto. */
  proyectoLabel?: string;
  /** Fase precargada (desde "Solicitar materiales" de una fase o partida). */
  faseIdInicial?: string;
  /** Solo los materiales de esta partida (código). */
  partidaFiltro?: string;
  /** Desde un pendiente de obra: queda enlazado y precarga su material. */
  obraPendiente?: ObraPendienteDetalle;
  onClose: () => void;
}

const mapaStock = (rows: { materialId: string; cantidad: number }[] | undefined) => {
  const mapa = new Map<string, number>();
  (rows || []).forEach((s) => mapa.set(s.materialId, (mapa.get(s.materialId) || 0) + Number(s.cantidad)));
  return mapa;
};

/**
 * Solicitud de materiales desde la obra (Obra › Abastecimiento, Fases,
 * Pendientes): quien pide elige la fase y marca qué falta; el stock de la
 * obra y de Obras Mayores va en columnas, y "A pedir" se precarga con la
 * diferencia. Sin proveedor, partida ni precio: eso lo pone Compras al
 * completarla (ver OrdenCompraModal). Nace como OC en BORRADOR sin proveedor.
 */
export const SolicitudMaterialesModal: React.FC<Props> = ({ proyectoId, proyectoLabel, faseIdInicial, partidaFiltro, obraPendiente, onClose }) => {
  const queryClient = useQueryClient();
  const [faseId, setFaseId] = useState(faseIdInicial ?? '');
  const [naturaleza, setNaturaleza] = useState<NaturalezaCompra>(obraPendiente?.naturalezaSugerida ?? 'PRESUPUESTO');
  const [adicionalId, setAdicionalId] = useState('');
  const [categoria, setCategoria] = useState<CategoriaSolicitud>('todos');
  const [comentarios, setComentarios] = useState('');
  const [error, setError] = useState<string | null>(null);
  const esAdicional = naturaleza === 'ADICIONAL';

  const { data: proyecto, isLoading: cargandoProyecto } = useQuery({ queryKey: ['proyectoDetail', proyectoId], queryFn: () => getProyectoById(proyectoId) });
  const { data: bodega } = useQuery({ queryKey: ['bodegaProyecto', proyectoId], queryFn: () => getBodegaProyecto(proyectoId) });
  const { data: adicionales = [] } = useQuery({ queryKey: ['adicionales', proyectoId], queryFn: () => getAdicionales(proyectoId), enabled: esAdicional });
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  // Necesidad bruta de la fase (sin descontar stock): el stock se muestra al lado, no se esconde en el número.
  const { data: requerimiento, isLoading: cargandoRequerimiento } = useRequerimientoFase(proyectoId, faseId || undefined, false);

  const activeVersion = useMemo(
    () => proyecto?.versiones.find((v) => v.hetmoId === proyecto.versionActivaHetmoId) || proyecto?.versiones[0],
    [proyecto]
  );
  const fasesReales = (activeVersion?.fases || []).filter((f) => f.numeroFase > 0).sort((a, b) => a.numeroFase - b.numeroFase);
  const opcionesFase: Fase[] = fasesReales.length > 0 ? fasesReales : (activeVersion?.fases || []).filter((f) => f.numeroFase === 0);
  const nombrePartida = partidaFiltro ? partidas.find((p) => p.codigo === partidaFiltro)?.nombre ?? partidaFiltro : null;

  const stockObra = useMemo(() => mapaStock(bodega?.stock), [bodega]);
  const stockObrasMayores = useMemo(() => mapaStock(bodega?.stockObrasMayores), [bodega]);
  const filasFase = useMemo(() => filasDesdeRequerimiento(requerimiento, stockObra, stockObrasMayores, partidaFiltro), [requerimiento, stockObra, stockObrasMayores, partidaFiltro]);

  // Filas agregadas a mano (otro material del catálogo, texto libre, el material del pendiente).
  const [extras, setExtras] = useState<FilaSolicitud[]>(() => {
    const m = obraPendiente?.material;
    if (!m) return [];
    const ancho = Number(obraPendiente?.anchoRectificadoMm ?? obraPendiente?.anchoOriginalMm) || 0;
    const alto = Number(obraPendiente?.altoRectificadoMm ?? obraPendiente?.altoOriginalMm) || 0;
    const pieza = !!m.tipoProducto?.compraPorPieza && ancho > 0 && alto > 0;
    return [
      {
        clave: `pendiente:${m.id}`,
        materialId: m.id,
        descripcion: pieza ? `${m.skuInterno} · ${m.descripcion} · ${Math.round(ancho)} × ${Math.round(alto)} mm` : `${m.skuInterno} · ${m.descripcion}`,
        unidad: 'UN',
        necesario: 1,
        obra: 0,
        obrasMayores: 0,
        pieza: pieza ? { anchoMm: Math.round(ancho), altoMm: Math.round(alto), ventanaId: null, referenciaVentana: obraPendiente?.ventanaRef ?? null } : null,
        sinMedidas: false,
        precioReferencial: null,
        cantidadCalculada: null,
        origen: 'pendiente',
      },
    ];
  });
  const filas = useMemo(() => [...filasFase, ...extras], [filasFase, extras]);

  // Marcado y cantidad por fila. Cuando cambian las filas de la fase (otra
  // fase, llegó el stock) se vuelve a precargar lo de la fase; lo agregado a
  // mano conserva lo que la persona tipeó.
  const [estado, setEstado] = useState<EstadoSolicitud>({});
  useEffect(() => {
    setEstado((prev) => {
      const base = estadoInicialSolicitud(filasFase);
      for (const f of extras) base[f.clave] = prev[f.clave] ?? estadoInicialSolicitud([f])[f.clave];
      return base;
    });
    // extras se agregan con su propio estado en agregarExtra -- acá solo importa el cambio de fase/stock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasFase]);
  const estadoDe = (f: FilaSolicitud) => estado[f.clave] ?? { marcada: false, cantidad: faltante(f) || f.necesario || 1 };
  const setFila = (clave: string, cambio: Partial<{ marcada: boolean; cantidad: number }>) =>
    setEstado((prev) => {
      const actual = prev[clave] ?? { marcada: false, cantidad: 0 };
      return { ...prev, [clave]: { ...actual, ...cambio } };
    });

  const agregarExtra = (fila: FilaSolicitud) => {
    if (filas.some((f) => f.clave === fila.clave)) {
      setFila(fila.clave, { marcada: true });
      return;
    }
    setExtras((prev) => [...prev, fila]);
    setEstado((prev) => ({ ...prev, [fila.clave]: { marcada: true, cantidad: faltante(fila) || 1 } }));
  };
  const quitarExtra = (clave: string) => setExtras((prev) => prev.filter((f) => f.clave !== clave));
  const editarExtra = (clave: string, cambio: Partial<FilaSolicitud>) => setExtras((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));

  // Buscador del catálogo para lo que no está en la fase.
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Material[]>([]);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getMateriales({ q: busqueda.trim(), limit: 8 });
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
  }, [busqueda]);
  const elegirMaterial = (m: Material) => {
    agregarExtra({
      clave: `catalogo:${m.id}`,
      materialId: m.id,
      descripcion: `${m.skuInterno} · ${m.descripcion}`,
      partida: m.tipoProducto?.partida?.nombre,
      unidad: unidadCompra(m),
      necesario: 0,
      obra: Math.max(0, stockObra.get(m.id) ?? 0),
      obrasMayores: Math.max(0, stockObrasMayores.get(m.id) ?? 0),
      pieza: null,
      sinMedidas: false,
      precioReferencial: null,
      cantidadCalculada: null,
      origen: 'catalogo',
    });
    setBusqueda('');
    setResultados([]);
  };
  const agregarTextoLibre = () =>
    agregarExtra({
      clave: `texto:${Date.now()}`,
      descripcion: '',
      unidad: 'UN',
      necesario: 0,
      obra: 0,
      obrasMayores: 0,
      pieza: null,
      sinMedidas: false,
      precioReferencial: null,
      cantidadCalculada: null,
      origen: 'texto',
      partidaId: '',
    });

  const resumen = resumenSolicitud(filas, estado);
  const conteo = conteoCategorias(filasFase);
  const visibles = [...filtrarFilas(filasFase, categoria), ...extras];
  const adicionalesDisponibles = adicionales.filter((a) => a.estado !== 'RECHAZADO' && a.estado !== 'ANULADO');

  const mutation = useMutation({
    mutationFn: () => {
      const problema = validarSolicitud(filas, estado, { adicional: esAdicional, adicionalId });
      if (problema) throw new Error(problema);
      return createOrdenCompra({
        proyectoId,
        faseId: faseId || null,
        naturaleza,
        obraPendienteId: obraPendiente?.id ?? null,
        adicionalId: esAdicional ? adicionalId : null,
        comentarios: comentarios.trim() || undefined,
        items: itemsSolicitud(filas, estado),
      });
    },
    onSuccess: ({ ordenCompra }) => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
      mostrarToast(`Solicitud ${ordenCompra.numero} enviada a Compras.`, { tipo: 'info' });
      onClose();
    },
    onError: (e) => setError(extraerErrorParaToast(e).mensaje),
  });

  const numero = (n: number) => <span className="font-mono tabular-nums">{fmtCantidad(n)}</span>;

  return (
    <Modal
      icono={ClipboardList}
      titulo={`Solicitar materiales · ${proyectoLabel ?? proyecto?.obra ?? ''}`}
      subtitulo={obraPendiente ? `Desde el pendiente ${obraPendiente.numero}. Compras elige proveedor y precio.` : 'Compras elige proveedor y precio, y la envía.'}
      ancho="xl"
      onClose={onClose}
      cerrable={!mutation.isPending}
      pie={
        <Modal.Pie
          inicio={
            <span title={resumen.totalReferencial > 0 ? `Total referencial ${clp(resumen.totalReferencial)}` : undefined}>
              <span className="font-bold text-slate-900">
                {resumen.items} ítems · {fmtCantidad(resumen.unidades)} unidades a pedir
              </span>
              {resumen.totalReferencial > 0 && <span className="hidden sm:inline"> · ref. {clp(resumen.totalReferencial)}</span>}
            </span>
          }
        >
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={resumen.items === 0}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            Enviar a Compras
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <Select
          label="Fase"
          options={[
            { value: '', label: cargandoProyecto ? 'Cargando fases…' : opcionesFase.length ? 'Elige la fase…' : 'Sin fases planificadas' },
            ...opcionesFase.map((f) => ({ value: f.id, label: `Fase ${f.numeroFase} · ${f.nombre}` })),
          ]}
          value={faseId}
          onChange={(e) => {
            setFaseId(e.target.value);
            setCategoria('todos');
          }}
          disabled={cargandoProyecto}
          helperText={nombrePartida ? `Solo ${nombrePartida}` : undefined}
        />
        <div className="space-y-1.5">
          <OpcionesTarjeta
            legend="Qué cubre"
            valor={naturaleza}
            onChange={setNaturaleza}
            columnas={3}
            opciones={(['PRESUPUESTO', 'REPOSICION', 'ADICIONAL'] as NaturalezaCompra[]).map((n) => ({ value: n, label: ETIQUETA_NATURALEZA[n] }))}
          />
          <p className="text-[11px] text-slate-500">{AYUDA_NATURALEZA[naturaleza]}</p>
          {esAdicional && (
            <SelectCompacto aria-label="Adicional que cubre la compra" value={adicionalId} onChange={(e) => setAdicionalId(e.target.value)} className={`w-full ${adicionalId ? '' : 'border-amber-300'}`}>
              <option value="">Elige el adicional que cubre esta compra…</option>
              {adicionalesDisponibles.map((a) => (
                <option key={a.id} value={a.id}>
                  A{a.numero} · {a.titulo} ({a.estado.toLowerCase().replace('_', ' ')})
                </option>
              ))}
            </SelectCompacto>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Materiales de la fase</span>
          {filasFase.length > 0 && (
            <Segmentado
              etiqueta="Filtrar materiales"
              valor={categoria}
              onChange={setCategoria}
              tamano="xs"
              opciones={[
                { value: 'todos', label: 'Todos', contador: conteo.todos },
                { value: 'faltan', label: 'Faltan', contador: conteo.faltan },
                { value: 'con-stock', label: 'Con stock', contador: conteo['con-stock'] },
              ]}
            />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.75rem_1fr_5.5rem_4.5rem_5rem_7rem_2rem] gap-2 items-center px-3 py-2 bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span />
            <span>Material</span>
            <span className="text-right">Necesario</span>
            <span className="text-right">Obra</span>
            <span className="text-right">O. Mayores</span>
            <span className="text-right">A pedir</span>
            <span />
          </div>
          {!faseId && filasFase.length === 0 && extras.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Elige una fase para ver qué necesita, o agrega un material de abajo.</p>
          ) : cargandoRequerimiento ? (
            <p className="p-4 text-xs text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando lo que necesita la fase…
            </p>
          ) : faseId && filasFase.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">
              {nombrePartida ? `Esta fase no tiene materiales de ${nombrePartida}.` : 'Esta fase no tiene materiales calculados (¿tiene ventanas asignadas en la pestaña Fases?).'} Puedes agregar uno abajo.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibles.map((f) => {
                const e = estadoDe(f);
                const cubierto = f.origen === 'fase' && categoriaDe(f) === 'con-stock';
                const esTexto = f.origen === 'texto';
                return (
                  <li key={f.clave} className={`px-3 py-2 md:grid md:grid-cols-[1.75rem_1fr_5.5rem_4.5rem_5rem_7rem_2rem] md:gap-2 md:items-center flex flex-wrap gap-x-3 gap-y-1.5 ${e.marcada ? '' : 'text-slate-400'}`}>
                    <Casilla checked={e.marcada} onChange={(v) => setFila(f.clave, { marcada: v })} aria-label={`Pedir ${f.descripcion || 'ítem'}`} className="pointer-coarse:[&>input]:w-5 pointer-coarse:[&>input]:h-5" />
                    <div className="min-w-0 flex-1 basis-full md:basis-auto order-last md:order-none">
                      {esTexto ? (
                        <div className="flex flex-wrap gap-1.5">
                          <InputCompacto aria-label="Descripción" placeholder="Qué se necesita (flete, servicio, material fuera del catálogo…)" value={f.descripcion} onChange={(ev) => editarExtra(f.clave, { descripcion: ev.target.value })} className="flex-1 min-w-40" />
                          <SelectCompacto aria-label="Partida" value={f.partidaId ?? ''} onChange={(ev) => editarExtra(f.clave, { partidaId: ev.target.value })} className={`w-40 ${f.partidaId ? '' : 'border-amber-300'}`}>
                            <option value="">Partida…</option>
                            {partidas.filter((p) => p.activa).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))}
                          </SelectCompacto>
                          <InputCompacto aria-label="Unidad" value={f.unidad} onChange={(ev) => editarExtra(f.clave, { unidad: ev.target.value })} className="w-16" />
                        </div>
                      ) : (
                        <>
                          <p className={`text-xs font-semibold truncate ${e.marcada ? 'text-slate-900' : ''}`}>
                            {f.materialId && <Package className="inline w-3 h-3 text-sky-500 mr-1 -mt-0.5" />}
                            {f.descripcion}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {f.partida}
                            {f.pieza && <span className="text-sky-700 font-semibold"> · Pieza {f.pieza.anchoMm} × {f.pieza.altoMm} mm{f.pieza.referenciaVentana ? ` · ${f.pieza.referenciaVentana}` : ''}</span>}
                            {f.sinMedidas && <span className="text-amber-700 font-semibold"> · Sin medidas: va por m²</span>}
                            {f.origen === 'pendiente' && <span className="text-slate-500"> · del pendiente</span>}
                          </p>
                        </>
                      )}
                    </div>
                    {/* Números: en escritorio una columna cada uno; en angosto, en línea con su etiqueta. */}
                    <span className="text-[11px] md:text-right md:text-xs"><span className="md:hidden text-slate-400">Necesario </span>{f.pieza ? <span title="Pieza a medida: una por ventana">{numero(f.necesario)}</span> : f.necesario > 0 ? numero(f.necesario) : '—'}</span>
                    <span className="text-[11px] md:text-right md:text-xs"><span className="md:hidden text-slate-400">Obra </span>{f.pieza || f.sinMedidas ? '—' : numero(f.obra)}</span>
                    <span className="text-[11px] md:text-right md:text-xs"><span className="md:hidden text-slate-400">O. May. </span>{f.pieza || f.sinMedidas ? '—' : numero(f.obrasMayores)}</span>
                    <span className="flex items-center justify-end gap-1.5 ml-auto md:ml-0">
                      {cubierto && !e.marcada ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">ya hay</span>
                      ) : (
                        <InputCompacto
                          aria-label={`Cantidad a pedir de ${f.descripcion || 'ítem'}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={e.cantidad === 0 ? '' : e.cantidad}
                          disabled={!e.marcada}
                          onChange={(ev) => setFila(f.clave, { cantidad: Math.max(0, Number(ev.target.value) || 0) })}
                          className="w-20 text-right font-mono pointer-coarse:min-h-11"
                        />
                      )}
                      <span className="text-[10px] text-slate-400 w-8 truncate">{f.unidad.toLowerCase()}</span>
                    </span>
                    <span className="flex justify-end">{f.origen !== 'fase' && <IconButton icono={Trash2} tono="peligro" etiqueta="Quitar" onClick={() => quitarExtra(f.clave)} />}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
          <div className="relative flex-1">
            <Buscador compacto valor={busqueda} onChange={setBusqueda} placeholder="Otro material del catálogo…" etiqueta="Buscar otro material" cargando={buscando} />
            {busqueda.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-lg">
                {buscando ? (
                  <div className="p-2.5 text-[11px] text-slate-400">Buscando…</div>
                ) : resultados.length === 0 ? (
                  <div className="p-2.5 text-[11px] text-slate-400">Nada en el catálogo con ese texto. Agrégalo como texto libre.</div>
                ) : (
                  resultados.map((m) => (
                    <BotonFila key={m.id} onClick={() => elegirMaterial(m)}>
                      <div className="text-[11px] font-semibold text-slate-800 leading-tight">{m.descripcion}</div>
                      <div className="text-[10px] text-slate-400">
                        {m.skuInterno} · {unidadCompra(m)}
                        {(stockObra.get(m.id) || stockObrasMayores.get(m.id)) ? ` · stock obra ${fmtCantidad(stockObra.get(m.id) ?? 0)} · O. Mayores ${fmtCantidad(stockObrasMayores.get(m.id) ?? 0)}` : ''}
                      </div>
                    </BotonFila>
                  ))
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={agregarTextoLibre} className="pointer-coarse:min-h-11">
            Texto libre
          </Button>
        </div>
      </div>

      <Textarea label="Comentarios para Compras" value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={2} placeholder="Ej: urgente para el lunes, coordinar con bodega antes de despachar…" />
    </Modal>
  );
};
