import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ClipboardList, Plus, Check, X as XIcon, Truck } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import {
  getSolicitudesMaterial,
  createSolicitudMaterial,
  entregarSolicitudMaterial,
  aprobarGerenciaSolicitud,
  getMateriales,
  getRequerimientoFase,
  getBodegaProyecto,
} from '../../api/client';
import type { EstadoSolicitudMaterial, ItemRequerimiento, Proyecto, ProyectoVersion } from '../../types';
import { usePermisos } from '../../lib/permisos';
import { actualizarParams, useUrlParam } from '../../lib/navigation';
import { requerimientoKey } from '../cotizaciones/lib/useAnalitica';
import { BotonFila } from '../../components/ui/Lista';
import { Aviso } from '../../components/ui/Aviso';
import { Casilla, InputCompacto } from '../../components/ui/Campos';
import { Segmentado } from '../../components/ui/Segmentado';
import { IconButton } from '../../components/ui/IconButton';

const ESTADO_LABEL: Record<EstadoSolicitudMaterial, string> = {
  GENERADA: 'Generada',
  PENDIENTE_APROBACION_GERENCIA: 'Pend. aprobación Gerencia',
  APROBADA: 'Aprobada (esperando compra)',
  RECHAZADA: 'Rechazada',
  ENTREGADA: 'Entregada',
};

const ESTADO_VARIANT: Record<EstadoSolicitudMaterial, BadgeVariant> = {
  GENERADA: 'subtle',
  PENDIENTE_APROBACION_GERENCIA: 'warning',
  APROBADA: 'info',
  RECHAZADA: 'danger',
  ENTREGADA: 'success',
};

interface ItemNuevo {
  materialId: string;
  descripcion: string;
  cantidadSolicitada: string;
}

/** Material que la fase necesita segun la Analitica, con lo que hay en bodega. */
interface Sugerido {
  materialId: string;
  descripcion: string;
  partida: string;
  unidad: string;
  necesario: number;
  /** Obra + Obras Mayores. */
  stock: number;
  /** Solo la bodega de la obra: lo demas necesita traslado antes de entregarse. */
  stockObra: number;
}

const cant = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 });

// Pendientes: en camino (generada, esperando a Gerencia, aprobada). Entregadas: cerradas (entregada o rechazada).
type VistaRequisiciones = 'pendientes' | 'entregadas';
const estaEntregada = (estado: EstadoSolicitudMaterial) => estado === 'ENTREGADA' || estado === 'RECHAZADA';

// "Requisiciones de materiales" -- la Solicitud de Materiales (Fases) del
// BPMN Producción -> Bodega. Vive en la pestaña Requisiciones de la obra
// (Taller > Fabricación) y tambien, sin `proyecto`, en el modulo Bodega:
// ahi lista TODAS las requisiciones de cualquier obra (getSolicitudesMaterial
// ya soporta proyectoId opcional) y no deja crear una nueva -- una requisicion
// siempre nace de una fase real, hay que estar dentro de esa obra.
// Permisos (la API exige los mismos): crear = obras.fases.editar (el taller),
// entregar = bodega.entregar (bodega), aprobar = compras.oc.aprobar (Gerencia).
export const RequisicionesSection: React.FC<{ proyecto?: Proyecto; activeVersion?: ProyectoVersion }> = ({
  proyecto,
  activeVersion,
}) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const puedeCrear = tiene('obras.fases.editar');
  const puedeEntregar = tiene('bodega.entregar');
  const puedeAprobar = tiene('compras.oc.aprobar');
  // ?nuevaFase=<id>: llega desde Fases ("Solicitar requisición") con la fase ya elegida.
  const [nuevaFaseUrl] = useUrlParam('nuevaFase');
  // ?partida=<codigo>: desde Fases, "Solicitar requisición" de una partida -- sus materiales con stock llegan ya marcados.
  const [partidaUrl] = useUrlParam('partida');
  const [creando, setCreandoEstado] = useState(!!nuevaFaseUrl && !!proyecto && puedeCrear);
  const setCreando = (v: boolean) => {
    setCreandoEstado(v);
    if (!v && (nuevaFaseUrl || partidaUrl)) actualizarParams({ nuevaFase: null, partida: null }, { replace: true });
  };
  const [vista, setVista] = useState<VistaRequisiciones>('pendientes');
  const [faseId, setFaseId] = useState(nuevaFaseUrl ?? '');
  const [items, setItems] = useState<ItemNuevo[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const fases = activeVersion?.fases || [];

  const { data, isLoading } = useQuery({
    queryKey: ['solicitudesMaterial', proyecto ? { proyectoId: proyecto.id } : 'global'],
    queryFn: () => getSolicitudesMaterial(proyecto ? { proyectoId: proyecto.id } : {}),
  });

  const { data: materiales } = useQuery({
    queryKey: ['materiales', 'catalogo-completo'],
    queryFn: () => getMateriales({ limit: 500 }),
    enabled: creando,
  });

  // Sugerencias: lo que la fase necesita segun la Analitica (sin descontar
  // stock, para verlo entero) y el stock real de la bodega de la obra mas
  // Obras Mayores. Solo se puede pedir lo que hay: una requisicion es una
  // salida de bodega, lo que falta se compra (Abastecimiento).
  const { data: requerimiento, isLoading: cargandoSugeridos } = useQuery({
    queryKey: requerimientoKey(proyecto?.id ?? '', faseId || undefined, false),
    queryFn: () => getRequerimientoFase(faseId, false),
    enabled: creando && !!proyecto && !!faseId,
  });
  const { data: bodega } = useQuery({
    queryKey: ['bodegaProyecto', proyecto?.id],
    queryFn: () => getBodegaProyecto(proyecto!.id),
    enabled: creando && !!proyecto,
  });
  const sugeridos = useMemo<Sugerido[]>(() => {
    if (!requerimiento) return [];
    const stock = new Map<string, number>();
    const stockObra = new Map<string, number>();
    for (const s of bodega?.stock ?? []) stockObra.set(s.materialId, (stockObra.get(s.materialId) ?? 0) + Number(s.cantidad));
    for (const s of [...(bodega?.stock ?? []), ...(bodega?.stockObrasMayores ?? [])]) stock.set(s.materialId, (stock.get(s.materialId) ?? 0) + Number(s.cantidad));
    // Un vidrio a medida trae un item por ventana con el mismo material: se junta.
    const porMaterial = new Map<string, Sugerido>();
    for (const item of requerimiento.grupos.flatMap((g) => g.items) as ItemRequerimiento[]) {
      const previo = porMaterial.get(item.materialId);
      if (previo) previo.necesario += item.cantidad;
      else porMaterial.set(item.materialId, { materialId: item.materialId, descripcion: item.descripcion, partida: item.partida.codigo, unidad: item.unidad, necesario: item.cantidad, stock: stock.get(item.materialId) ?? 0, stockObra: stockObra.get(item.materialId) ?? 0 });
    }
    return [...porMaterial.values()].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.descripcion.localeCompare(b.descripcion, 'es'));
  }, [requerimiento, bodega]);
  // Precarga una sola vez por fase: todo lo de la partida pedida que tenga stock.
  const precargadaRef = useRef<string | null>(null);
  useEffect(() => {
    if (!creando || !partidaUrl || !faseId || sugeridos.length === 0 || precargadaRef.current === faseId) return;
    precargadaRef.current = faseId;
    setItems(sugeridos.filter((s) => s.partida === partidaUrl && s.stock > 0).map((s) => ({ materialId: s.materialId, descripcion: s.descripcion, cantidadSolicitada: String(Math.min(s.necesario, s.stock)) })));
  }, [creando, partidaUrl, faseId, sugeridos]);
  // Items marcados que piden mas de lo que hay en la bodega de la obra: el resto esta en Obras Mayores.
  const conTraslado = items.filter((i) => {
    const s = sugeridos.find((x) => x.materialId === i.materialId);
    return !!s && (parseFloat(i.cantidadSolicitada) || 0) > s.stockObra + 0.0001;
  });
  const alternarSugerido = (s: Sugerido) =>
    setItems((prev) =>
      prev.some((i) => i.materialId === s.materialId)
        ? prev.filter((i) => i.materialId !== s.materialId)
        : [...prev, { materialId: s.materialId, descripcion: s.descripcion, cantidadSolicitada: String(Math.min(s.necesario, s.stock)) }]
    );

  const sugerencias = useMemo(() => {
    if (!busqueda.trim() || !materiales) return [];
    const term = busqueda.toLowerCase();
    return materiales
      .filter((m) => m.skuInterno.toLowerCase().includes(term) || m.descripcion.toLowerCase().includes(term))
      .slice(0, 8);
  }, [busqueda, materiales]);

  const crearMutation = useMutation({
    mutationFn: () =>
      createSolicitudMaterial(faseId, {
        items: items.filter((i) => i.cantidadSolicitada).map((i) => ({ materialId: i.materialId, cantidadSolicitada: parseFloat(i.cantidadSolicitada) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudesMaterial'] });
      setCreando(false);
      setFaseId('');
      setItems([]);
    },
  });

  const entregarMutation = useMutation({
    mutationFn: (id: string) => entregarSolicitudMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudesMaterial'] });
      queryClient.invalidateQueries({ queryKey: ['bodegaProyecto'] });
    },
  });

  const aprobarMutation = useMutation({
    mutationFn: ({ id, aprobado }: { id: string; aprobado: boolean }) => aprobarGerenciaSolicitud(id, aprobado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['solicitudesMaterial'] }),
  });

  const todas = data?.data || [];
  const solicitudes = todas.filter((s) => (vista === 'entregadas') === estaEntregada(s.estado));
  const pendientesN = todas.filter((s) => !estaEntregada(s.estado)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-600" />
          Requisiciones de materiales
        </h3>
        {!creando && puedeCrear && fases.length > 0 && (
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreando(true)}>
            Nueva requisición
          </Button>
        )}
      </div>

      {creando && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <Select
            label="Fase"
            options={[{ value: '', label: 'Selecciona una fase...' }, ...fases.map((f) => ({ value: f.id, label: f.nombre }))]}
            value={faseId}
            onChange={(e) => {
              setFaseId(e.target.value);
              setItems([]);
            }}
          />

          {faseId && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Materiales de la fase</p>
              {cargandoSugeridos ? (
                <div className="p-4 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : sugeridos.length === 0 ? (
                <p className="text-[11px] text-slate-500">La Analítica no tiene materiales para esta fase (revisa que tenga líneas asignadas).</p>
              ) : (
                <>
                  <p className="text-[11px] text-slate-500">Solo se puede pedir lo que hay en bodega (obra + Obras Mayores). Lo que está en Obras Mayores necesita traslado a la bodega de la obra antes de entregarse; lo que falta se compra desde Abastecimiento.</p>
                  {conTraslado.length > 0 && (
                    <Aviso tono="advertencia" titulo="Hay material en Obras Mayores">
                      {conTraslado.map((i) => i.descripcion).join(', ')}: solicita a Bodega el traslado a la bodega de la obra antes de que se entregue esta requisición.
                    </Aviso>
                  )}
                  <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {sugeridos.map((s) => {
                      const sinStock = s.stock <= 0;
                      return (
                        <li key={s.materialId} className={`px-3 py-2 ${sinStock ? 'opacity-60' : ''}`}>
                          <Casilla
                            className="flex! w-full"
                            checked={items.some((i) => i.materialId === s.materialId)}
                            disabled={sinStock}
                            onChange={() => alternarSugerido(s)}
                            label={s.descripcion}
                            descripcion={`Necesario ${cant(s.necesario)} ${s.unidad} · ${sinStock ? 'sin stock en bodega' : `stock ${cant(s.stock)} ${s.unidad}`}${s.stock - s.stockObra > 0.0001 ? ` (${cant(s.stock - s.stockObra)} en Obras Mayores: pedir traslado)` : ''}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Input
                label="Otro material"
                placeholder="Buscar por SKU o descripción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {sugerencias.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {sugerencias.map((m) => (
                    <BotonFila
                      key={m.id}
                      className="text-xs border-b border-slate-50 last:border-0"
                      onClick={() => {
                        setItems((prev) => [...prev, { materialId: m.id, descripcion: `${m.skuInterno} · ${m.descripcion}`, cantidadSolicitada: '' }]);
                        setBusqueda('');
                      }}
                    >
                      <span className="font-mono font-bold text-slate-700">{m.skuInterno}</span> — {m.descripcion}
                    </BotonFila>
                  ))}
                </div>
              )}
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="flex-1 text-xs text-slate-700 truncate">{item.descripcion}</span>
                <InputCompacto
                  aria-label={`Cantidad de ${item.descripcion}`}
                  type="number"
                  placeholder="Cantidad"
                  value={item.cantidadSolicitada}
                  onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, cantidadSolicitada: e.target.value } : it)))}
                  className="w-24"
                />
                <IconButton icono={XIcon} tono="peligro" etiqueta={`Quitar ${item.descripcion}`} onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCreando(false); setFaseId(''); setItems([]); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              isLoading={crearMutation.isPending}
              disabled={!faseId || items.length === 0 || items.some((i) => !i.cantidadSolicitada)}
              onClick={() => crearMutation.mutate()}
            >
              Generar requisición
            </Button>
          </div>
        </div>
      )}

      <Segmentado
        etiqueta="Ver requisiciones"
        valor={vista}
        onChange={setVista}
        opciones={[
          { value: 'pendientes', label: 'Requisiciones pendientes', contador: pendientesN },
          { value: 'entregadas', label: 'Requisiciones entregadas', contador: todas.length - pendientesN },
        ]}
      />

      {isLoading ? (
        <div className="p-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          {vista === 'pendientes' ? 'Sin requisiciones pendientes.' : 'Todavía no hay requisiciones entregadas.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {solicitudes.map((s) => (
            <div key={s.id} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {!proyecto && s.fase?.version?.proyecto?.obra && (
                    <span className="text-xs font-semibold text-slate-500">{s.fase.version.proyecto.obra} ·</span>
                  )}
                  <span className="text-xs font-bold text-slate-800">{s.fase?.nombre || 'Fase'}</span>
                  <Badge variant={ESTADO_VARIANT[s.estado]} size="sm">
                    {ESTADO_LABEL[s.estado]}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  {puedeEntregar && (s.estado === 'GENERADA' || s.estado === 'APROBADA') && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Truck className="w-3.5 h-3.5" />}
                      isLoading={entregarMutation.isPending && entregarMutation.variables === s.id}
                      onClick={() => entregarMutation.mutate(s.id)}
                    >
                      Intentar entregar
                    </Button>
                  )}
                  {puedeAprobar && s.estado === 'PENDIENTE_APROBACION_GERENCIA' && (
                    <>
                      <Button
                        size="sm"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        isLoading={aprobarMutation.isPending}
                        onClick={() => aprobarMutation.mutate({ id: s.id, aprobado: true })}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        leftIcon={<XIcon className="w-3.5 h-3.5" />}
                        isLoading={aprobarMutation.isPending}
                        onClick={() => aprobarMutation.mutate({ id: s.id, aprobado: false })}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {s.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-[11px] text-slate-600 px-2">
                    <span>{item.material?.descripcion || item.materialId}</span>
                    <span className="font-mono">
                      {Number(item.cantidadEntregada).toLocaleString('es-CL')} / {Number(item.cantidadSolicitada).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
