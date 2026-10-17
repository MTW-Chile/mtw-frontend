import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Layers,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  X as XIcon,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Package,
  FileSpreadsheet,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatCard } from '../../components/ui/StatCard';
import { createFase, updateFase, deleteFase, descargarInformeHetmoFase } from '../../api/client';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { useRequerimientosFases } from '../cotizaciones/lib/useAnalitica';
import { NuevaOrdenCompraModal } from '../abastecimiento/NuevaOrdenCompraModal';
import { SelectorFaseDesdeCubicacion } from './cubicacion/SelectorFaseDesdeCubicacion';
import { descargarBlob } from './cubicacion/utils';
import type { Fase, Proyecto, ProyectoVersion, SeleccionFaseCubicacion } from '../../types';

const formatoMoneda = (valor: number) => valor.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const ESTADO_LABEL: Record<Fase['estado'], string> = {
  BORRADOR: 'Borrador',
  PLANIFICADA: 'Planificada',
  EN_PRODUCCION: 'En producción',
  COMPLETADA: 'Completada',
};

const ESTADO_VARIANT: Record<Fase['estado'], BadgeVariant> = {
  BORRADOR: 'subtle',
  PLANIFICADA: 'info',
  EN_PRODUCCION: 'warning',
  COMPLETADA: 'success',
};

interface FilaVentana {
  ventanaId: string;
  lineaHetmo: number;
  modelo: string;
  descripcionCorta: string | null;
  unidadesTotal: number;
  asignadoOtrasFases: number;
}

// Distribucion de las unidades de cada linea de ventana entre "fases"
// reales (numeroFase >= 1) de produccion/entrega. La Fase 0 ("Fase Base")
// la genera el sync sola con el 100% de las unidades y es solo de
// referencia -- acá se planifican las fases de verdad, cuya suma por
// ventana nunca puede superar el total de esa linea (el backend lo valida
// igual, esto es feedback antes de mandar el request).
export const FasesTab: React.FC<{ proyecto: Proyecto; activeVersion?: ProyectoVersion }> = ({ proyecto, activeVersion }) => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<'nueva' | string | null>(null);
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  // Por defecto se crea seleccionando desde la cubicación (mas preciso: sabe
  // exactamente que ventana fisica queda en la fase, no solo "cuantas" de
  // la linea). El modo manual (linea+cantidad) sigue disponible como
  // alternativa, y es el unico modo al editar una fase ya creada.
  const [modoCreacion, setModoCreacion] = useState<'cubicacion' | 'manual'>('cubicacion');
  const [seleccionCubicacion, setSeleccionCubicacion] = useState<SeleccionFaseCubicacion>({});
  const [resumenSeleccion, setResumenSeleccion] = useState('nada seleccionado todavía');
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  // partida: codigo de la partida cuyos items precarga la solicitud.
  const [ocParaFase, setOcParaFase] = useState<{ fase: Fase; partida: string } | null>(null);

  const ventanas = activeVersion?.ventanas || [];
  const todasLasFases = activeVersion?.fases || [];
  const faseBase = todasLasFases.find((f) => f.numeroFase === 0);
  const fasesReales = todasLasFases.filter((f) => f.numeroFase > 0).sort((a, b) => a.numeroFase - b.numeroFase);

  // Cuanto de cada ventana ya esta asignado en OTRAS fases reales (para
  // saber cuanto queda disponible al crear/editar la fase actual).
  const asignadoOtrasFasesPorVentana = useMemo(() => {
    const map = new Map<string, number>();
    fasesReales
      .filter((f) => f.id !== editando)
      .forEach((f) => (f.ventanasFase || []).forEach((vf) => map.set(vf.ventanaId, (map.get(vf.ventanaId) || 0) + Number(vf.unidades))));
    return map;
  }, [fasesReales, editando]);

  const filas: FilaVentana[] = useMemo(
    () =>
      ventanas
        .map((v) => ({
          ventanaId: v.id,
          lineaHetmo: v.lineaHetmo,
          modelo: v.modelo,
          descripcionCorta: v.descripcionCorta,
          unidadesTotal: v.unidades,
          asignadoOtrasFases: asignadoOtrasFasesPorVentana.get(v.id) || 0,
        }))
        .sort((a, b) => a.lineaHetmo - b.lineaHetmo),
    [ventanas, asignadoOtrasFasesPorVentana]
  );

  const filasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return filas;
    const term = busqueda.toLowerCase();
    return filas.filter((f) => f.modelo.toLowerCase().includes(term) || String(f.lineaHetmo).includes(term));
  }, [filas, busqueda]);

  // Resumen global: cuanto del proyecto ya quedo repartido en alguna fase
  // real, contra el total de unidades del presupuesto.
  const resumen = useMemo(() => {
    const totalUnidades = filas.reduce((sum, f) => sum + f.unidadesTotal, 0);
    const planificado = filas.reduce((sum, f) => sum + f.asignadoOtrasFases, 0);
    return { totalUnidades, planificado, sinPlanificar: totalUnidades - planificado };
  }, [filas]);

  // Materiales por fase real (GET /fases/:id/requerimiento de mtw-api, el
  // mismo calculo que Abastecimiento > Nueva OC): cantidad prorrateada de la
  // Analitica, ya neta del stock de la bodega de la obra y de Obras Mayores.
  // Ojo: cada fase ve el mismo stock disponible sin "reservarlo" entre si
  // (el traslado real solo ocurre cuando se genera una OC puntual). Se pide
  // para todas las fases reales de una porque el resumen se muestra siempre.
  type ItemFase = { descripcion: string; proveedorNombre: string; unidad: string; cantidad: number; stockDisponible: number; precioUnitario: number };
  const requerimientos = useRequerimientosFases(
    proyecto.id,
    fasesReales.map((f) => f.id)
  );
  const materialesPorFase = useMemo(() => {
    const map = new Map<string, { montoTotal: number; partidas: { codigo: string; nombre: string; monto: number; items: ItemFase[] }[] }>();
    fasesReales.forEach((fase, i) => {
      const req = requerimientos[i]?.data;
      if (!req) return;
      const porPartida = new Map<string, { codigo: string; nombre: string; monto: number; items: ItemFase[] }>();
      req.grupos.forEach((g) =>
        g.items.forEach((it) => {
          const acc = porPartida.get(it.partida.codigo) || { ...it.partida, monto: 0, items: [] };
          acc.monto += it.cantidad * it.precioUnitario;
          acc.items.push({ ...it, proveedorNombre: g.proveedorNombre });
          porPartida.set(it.partida.codigo, acc);
        })
      );
      const partidas = [...porPartida.values()].sort((a, b) => b.monto - a.monto);
      map.set(fase.id, { montoTotal: partidas.reduce((sum, c) => sum + c.monto, 0), partidas });
    });
    return map;
  }, [fasesReales, requerimientos]);

  // Expandidas se guarda como "faseId:partida" -- cada partida se
  // despliega de forma independiente, no toda la fase junta.
  const toggleExpandida = (key: string) =>
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const resetForm = () => {
    setEditando(null);
    setNombre('');
    setFechaInicio('');
    setFechaEntrega('');
    setCantidades({});
    setModoCreacion('cubicacion');
    setSeleccionCubicacion({});
    setResumenSeleccion('nada seleccionado todavía');
    setBusqueda('');
    setError(null);
  };

  const abrirNueva = () => {
    resetForm();
    setEditando('nueva');
  };

  const abrirEdicion = (fase: Fase) => {
    setEditando(fase.id);
    setNombre(fase.nombre);
    setFechaInicio(fase.fechaInicio ? fase.fechaInicio.slice(0, 10) : '');
    setFechaEntrega(fase.fechaEntrega ? fase.fechaEntrega.slice(0, 10) : '');
    const iniciales: Record<string, string> = {};
    (fase.ventanasFase || []).forEach((vf) => (iniciales[vf.ventanaId] = String(vf.unidades)));
    setCantidades(iniciales);
    setModoCreacion('manual'); // editar siempre reemplaza por linea+cantidad, igual que antes
    setBusqueda('');
    setError(null);
  };

  const ventanasPayload = () =>
    Object.entries(cantidades)
      .filter(([, v]) => Number(v) > 0)
      .map(([ventanaId, v]) => ({ ventanaId, unidades: Number(v) }));

  const esNueva = editando === 'nueva' || editando === null;
  const usaModoCubicacion = esNueva && modoCreacion === 'cubicacion';

  const guardarMutation = useMutation({
    mutationFn: () => {
      if (esNueva) {
        return usaModoCubicacion
          ? createFase(activeVersion!.id, {
              nombre: nombre.trim(),
              fechaInicio: fechaInicio || undefined,
              fechaEntrega: fechaEntrega || undefined,
              seleccionCubicacion,
            })
          : createFase(activeVersion!.id, {
              nombre: nombre.trim(),
              fechaInicio: fechaInicio || undefined,
              fechaEntrega: fechaEntrega || undefined,
              ventanas: ventanasPayload(),
            });
      }
      return updateFase(editando!, {
        nombre: nombre.trim(),
        fechaInicio: fechaInicio || undefined,
        fechaEntrega: fechaEntrega || undefined,
        ventanas: ventanasPayload(),
      });
    },
    onSuccess: (resultado: { success: boolean; fase: Fase; avisos?: { nivel: string; nombre: string }[] }) => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
      if (resultado.avisos && resultado.avisos.length) {
        mostrarToast(`Fase creada. ${resultado.avisos.length} exclusión(es): algo ya pertenecía a otra fase.`, { tipo: 'info' });
      }
      resetForm();
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo guardar la fase.'),
  });

  const eliminarMutation = useMutation({
    mutationFn: (faseId: string) => deleteFase(faseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo eliminar la fase.'),
  });

  // Solo tiene sentido para una fase creada seleccionando desde la
  // cubicacion (tiene ventanas EXACTAS, ver FaseVentanaIndividualizada) --
  // una fase vieja (linea+cantidad) no tiene que listar, el backend
  // rechaza con 400 y mensaje claro, se muestra tal cual.
  const informeMutation = useMutation({
    mutationFn: (fase: Fase) => descargarInformeHetmoFase(fase.id),
    onSuccess: (blob, fase) => descargarBlob(blob, `Informe HETMO ${fase.nombre}.xlsx`),
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  // Atajo para proyectos que no necesitan repartir por etapas: una sola
  // fase con TODO lo que todavia no este asignado a otra fase (no
  // necesariamente el 100% de cada linea -- si ya hay fases planificadas,
  // esto solo completa el resto sin pisarlas).
  const crearFaseUnicaMutation = useMutation({
    mutationFn: () => {
      const ventanasPayload = filas
        .map((f) => ({ ventanaId: f.ventanaId, unidades: f.unidadesTotal - f.asignadoOtrasFases }))
        .filter((v) => v.unidades > 0);
      return createFase(activeVersion!.id, { nombre: 'Fase única', ventanas: ventanasPayload });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo crear la fase única.'),
  });

  if (!activeVersion) {
    return <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">Sin versión activa.</div>;
  }

  const formAbierto = editando !== null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-black text-slate-900">Fases de producción</h2>
          <p className="text-xs text-slate-500">
            Reparte las unidades de cada línea entre etapas de fabricación/entrega. La Fase Base (0) siempre representa el
            100% del proyecto tal como llegó de HETMO — planificar acá no la modifica.
          </p>
        </div>
        {!formAbierto && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={crearFaseUnicaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              disabled={resumen.sinPlanificar <= 0 || crearFaseUnicaMutation.isPending}
              title={
                resumen.sinPlanificar <= 0
                  ? 'Ya no queda ninguna unidad sin asignar a una fase.'
                  : 'Crea una fase con todo lo que todavía no esté asignado a otra fase.'
              }
              onClick={() => crearFaseUnicaMutation.mutate()}
            >
              Crear fase única
            </Button>
            <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={abrirNueva}>
              Nueva fase
            </Button>
          </div>
        )}
      </div>

      {!formAbierto && error && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Unidades del presupuesto" value={resumen.totalUnidades.toLocaleString('es-CL')} icon={Layers} />
        <StatCard
          title="Ya planificadas en fases"
          value={resumen.planificado.toLocaleString('es-CL')}
          icon={Layers}
          iconColor="text-sky-600"
          iconBgColor="bg-sky-50 border-sky-200"
          trend={
            resumen.totalUnidades > 0
              ? { label: `${((resumen.planificado / resumen.totalUnidades) * 100).toFixed(0)}% del total`, positive: true }
              : undefined
          }
        />
        <StatCard
          title="Sin asignar a una fase"
          value={resumen.sinPlanificar.toLocaleString('es-CL')}
          icon={Layers}
          iconColor={resumen.sinPlanificar > 0 ? 'text-amber-600' : 'text-emerald-600'}
          iconBgColor={resumen.sinPlanificar > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}
        />
      </div>

      {formAbierto && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">{editando === 'nueva' ? 'Nueva fase' : 'Editar fase'}</h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-700">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Nombre" placeholder="Ej. Torre Norte" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Input label="Fecha inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              <Input label="Fecha entrega" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
            </div>

            {esNueva && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setModoCreacion('cubicacion')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${modoCreacion === 'cubicacion' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Desde la cubicación
                </button>
                <button
                  type="button"
                  onClick={() => setModoCreacion('manual')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${modoCreacion === 'manual' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Ventanas individuales (sin cubicar)
                </button>
              </div>
            )}
          </div>

          {usaModoCubicacion ? (
            <div className="p-4 space-y-2">
              <SelectorFaseDesdeCubicacion
                proyectoId={proyecto.id}
                onChange={(s, resumen) => {
                  setSeleccionCubicacion(s);
                  setResumenSeleccion(resumen);
                }}
              />
              <p className="text-[11px] text-slate-500">Seleccionado: {resumenSeleccion}. Una ventana que ya esté en otra fase se excluye sola, con aviso.</p>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-slate-100">
                <Input
                  placeholder="Buscar línea por modelo o N°..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                />
              </div>

              <div className="max-h-96 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur">
                    <tr className="border-b border-slate-100 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-2.5 font-bold">Línea</th>
                      <th className="px-4 py-2.5 font-bold text-right">Total</th>
                      <th className="px-4 py-2.5 font-bold text-right">En otras fases</th>
                      <th className="px-4 py-2.5 font-bold text-right">Restante</th>
                      <th className="px-4 py-2.5 font-bold text-right w-28">En esta fase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map((f) => {
                      const asignadaAqui = Number(cantidades[f.ventanaId]) || 0;
                      const restante = f.unidadesTotal - f.asignadoOtrasFases;
                      const excedida = asignadaAqui > restante;
                      return (
                        <tr key={f.ventanaId} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-700">
                            <span className="font-mono text-slate-400 mr-1.5">#{f.lineaHetmo}</span>
                            {f.modelo}
                            {f.descripcionCorta && <span className="text-slate-400"> · {f.descripcionCorta}</span>}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-slate-600">{f.unidadesTotal}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-500">{f.asignadoOtrasFases}</td>
                          <td className={`px-4 py-2 text-right font-mono font-semibold ${restante <= 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                            {restante}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={cantidades[f.ventanaId] || ''}
                              onChange={(e) => setCantidades((prev) => ({ ...prev, [f.ventanaId]: e.target.value }))}
                              className={`w-20 text-right text-xs border rounded-lg px-2 py-1 outline-none ${
                                excedida ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 focus:border-brand-600'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {filasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Sin líneas que calcen con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="p-3.5 flex items-center justify-end gap-2 bg-slate-50/70">
            <Button variant="outline" size="sm" onClick={resetForm}>
              Cancelar
            </Button>
            <Button
              size="sm"
              isLoading={guardarMutation.isPending}
              disabled={
                !nombre.trim() ||
                (usaModoCubicacion &&
                  (seleccionCubicacion.torreIds?.length || 0) +
                    (seleccionCubicacion.pisoIds?.length || 0) +
                    (seleccionCubicacion.unidadIds?.length || 0) +
                    (seleccionCubicacion.ventanaIndividualizadaIds?.length || 0) ===
                    0)
              }
              onClick={() => guardarMutation.mutate()}
            >
              Guardar fase
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {faseBase && fasesReales.length === 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="outline" size="sm">
                Fase 0
              </Badge>
              <span className="text-xs font-semibold text-slate-600">{faseBase.nombre}</span>
              <span className="text-[11px] text-slate-400">Total del proyecto — solo referencia</span>
            </div>
          </div>
        )}

        {fasesReales.length === 0 && !formAbierto ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
            Todavía no hay fases de producción planificadas para esta versión.
          </div>
        ) : (
          fasesReales.map((fase) => {
            const lineasAsignadas = (fase.ventanasFase || []).filter((vf) => vf.unidades > 0).length;
            const unidadesFase = (fase.ventanasFase || []).reduce((sum, vf) => sum + Number(vf.unidades), 0);
            const infoMateriales = materialesPorFase.get(fase.id);
            return (
              <div key={fase.id} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Badge variant="brand" size="sm">
                      Fase {fase.numeroFase}
                    </Badge>
                    <span className="text-xs font-bold text-slate-800 truncate">{fase.nombre}</span>
                    <Badge variant={ESTADO_VARIANT[fase.estado]} size="sm">
                      {ESTADO_LABEL[fase.estado]}
                    </Badge>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {lineasAsignadas} línea{lineasAsignadas === 1 ? '' : 's'} · {unidadesFase} unidades
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                      disabled={!fase._count?.ventanasIndividualizadas}
                      isLoading={informeMutation.isPending && informeMutation.variables?.id === fase.id}
                      onClick={() => informeMutation.mutate(fase)}
                      title={
                        fase._count?.ventanasIndividualizadas
                          ? 'Excel con nomenclatura y medidas de fabricación de las ventanas de esta fase, para crear la fase en HETMO'
                          : 'Esta fase no tiene ventanas exactas asociadas -- créala seleccionando desde la cubicación para generar el informe'
                      }
                    >
                      Informe HETMO
                    </Button>
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => abrirEdicion(fase)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={eliminarMutation.isPending && eliminarMutation.variables === fase.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la fase "${fase.nombre}"?`)) eliminarMutation.mutate(fase.id);
                      }}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>

                {/* Resumen de materiales por partida -- el mismo
                    requerimiento que usa Abastecimiento > Nueva OC. Cada
                    partida se despliega y genera su solicitud de forma
                    independiente. */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {!infoMateriales || infoMateriales.partidas.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      Sin materiales calculados todavía para esta fase (asegúrate de que tenga líneas asignadas arriba).
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Materiales por partida</span>
                        <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                          Total: {formatoMoneda(infoMateriales.montoTotal)}
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                        {infoMateriales.partidas.map((c) => {
                          const key = `${fase.id}:${c.codigo}`;
                          const expandidaCat = expandidas.has(key);
                          return (
                            <div key={c.codigo} className="bg-white">
                              <div className="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandida(key)}
                                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-brand-600 transition-colors cursor-pointer"
                                >
                                  {expandidaCat ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                  {c.nombre}
                                  <span className="font-mono font-normal text-slate-400">
                                    · {c.items.length} item{c.items.length === 1 ? '' : 's'}
                                  </span>
                                </button>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-800 text-[11px]">{formatoMoneda(c.monto)}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
                                    onClick={() => setOcParaFase({ fase, partida: c.codigo })}
                                  >
                                    Solicitud de Materiales
                                  </Button>
                                </div>
                              </div>

                              {expandidaCat && (
                                <div className="overflow-x-auto border-t border-slate-100">
                                  <table className="w-full text-[11px]">
                                    <thead className="bg-slate-50/80">
                                      <tr className="text-left text-slate-400 uppercase tracking-wider">
                                        <th className="px-3 py-1.5 font-bold">Item</th>
                                        <th className="px-3 py-1.5 font-bold">Proveedor</th>
                                        <th className="px-3 py-1.5 font-bold text-right">Cantidad</th>
                                        <th className="px-3 py-1.5 font-bold text-right">Precio unit.</th>
                                        <th className="px-3 py-1.5 font-bold text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {c.items.map((it, i) => (
                                        <tr key={i} className="border-t border-slate-100/80">
                                          <td className="px-3 py-1.5 text-slate-700">
                                            <span className="flex items-center gap-1.5">
                                              <Package className="w-3 h-3 text-sky-500 shrink-0" />
                                              {it.descripcion}
                                            </span>
                                          </td>
                                          <td className="px-3 py-1.5 text-slate-500">{it.proveedorNombre}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                                            {it.cantidad.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {it.unidad}
                                            {it.stockDisponible > 0 && (
                                              <span className="block text-[10px] text-emerald-600 font-normal">
                                                ya tenías {it.stockDisponible.toLocaleString('es-CL', { maximumFractionDigits: 2 })} en stock
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-1.5 text-right font-mono text-slate-700">{formatoMoneda(it.precioUnitario)}</td>
                                          <td className="px-3 py-1.5 text-right font-mono font-semibold text-slate-900">
                                            {formatoMoneda(it.cantidad * it.precioUnitario)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <NuevaOrdenCompraModal
        isOpen={!!ocParaFase}
        onClose={() => setOcParaFase(null)}
        proyectoIdFijo={proyecto.id}
        proyectoLabelFijo={proyecto.obra}
        faseIdInicial={ocParaFase?.fase.id}
        partidaFiltro={ocParaFase?.partida}
      />
    </div>
  );
};
