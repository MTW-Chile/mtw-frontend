import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Layers, Plus, Pencil, Trash2, AlertCircle, X as XIcon, ShoppingCart, Package, FileSpreadsheet, PackageOpen } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatCard } from '../../components/ui/StatCard';
import { createFase, updateFase, deleteFase, descargarInformeHetmoFase, getBodegaProyecto, getOrdenesCompra, getSolicitudesMaterial } from '../../api/client';
import { usePermisos } from '../../lib/permisos';
import { actualizarParams } from '../../lib/navigation';
import { estadoPartida } from './estadoSolicitudPartida';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { useRequerimientosFases } from '../cotizaciones/lib/useAnalitica';
import { SolicitudMaterialesModal } from '../abastecimiento/solicitud/SolicitudMaterialesModal';
import { SelectorFaseDesdeCubicacion } from './cubicacion/SelectorFaseDesdeCubicacion';
import { descargarBlob } from './cubicacion/utils';
import type { Fase, Proyecto, ProyectoVersion, SeleccionFaseCubicacion } from '../../types';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { useConfirmar } from '../../components/ui/Confirmar';
import { BotonColapsar } from '../../components/ui/BotonColapsar';
import { IconButton } from '../../components/ui/IconButton';
import { Aviso } from '../../components/ui/Aviso';

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
  const { tiene } = usePermisos();
  const { confirmar } = useConfirmar();
  // Quien puede emitir OC genera la OC completa; si no, la solicita a Compras.
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<'nueva' | string | null>(null);
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  // Una fase se arma siempre desde la cubicación (así cada ventana tiene nomenclatura y medidas rectificadas);
  // al editarla solo cambia su ficha: nombre y fechas.
  const [seleccionCubicacion, setSeleccionCubicacion] = useState<SeleccionFaseCubicacion>({});
  const [resumenSeleccion, setResumenSeleccion] = useState('nada seleccionado todavía');
  const [error, setError] = useState<string | null>(null);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  // partida: codigo de la partida cuyos items precarga la solicitud.
  const [ocParaFase, setOcParaFase] = useState<{ fase: Fase; partida: string } | null>(null);
  // OC de la obra (misma consulta que Abastecimiento): el botón de cada
  // partida sigue el estado de su solicitud (Solicitado → … → Recibida).
  const { data: ordenesData } = useQuery({ queryKey: ['ordenesCompra', { proyectoId: proyecto.id }], queryFn: () => getOrdenesCompra({ proyectoId: proyecto.id, limit: 100 }) });
  const ordenes = ordenesData?.data ?? [];
  // Requisiciones a bodega de la obra (misma consulta que la pestaña Requisiciones).
  const { data: requisicionesData } = useQuery({ queryKey: ['solicitudesMaterial', { proyectoId: proyecto.id }], queryFn: () => getSolicitudesMaterial({ proyectoId: proyecto.id }) });
  const requisiciones = requisicionesData?.data ?? [];
  // Stock de la obra + Obras Mayores: se muestra junto a cada material y decide si una partida ya está cubierta.
  const { data: bodega } = useQuery({ queryKey: ['bodegaProyecto', proyecto.id], queryFn: () => getBodegaProyecto(proyecto.id) });
  const stockPorMaterial = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const s of [...(bodega?.stock ?? []), ...(bodega?.stockObrasMayores ?? [])]) mapa.set(s.materialId, (mapa.get(s.materialId) ?? 0) + Number(s.cantidad));
    return mapa;
  }, [bodega]);
  // Solo la bodega de la obra: lo que esta en Obras Mayores necesita traslado antes de entregarse.
  const stockObraPorMaterial = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const s of bodega?.stock ?? []) mapa.set(s.materialId, (mapa.get(s.materialId) ?? 0) + Number(s.cantidad));
    return mapa;
  }, [bodega]);

  const ventanas = activeVersion?.ventanas || [];
  const todasLasFases = activeVersion?.fases || [];
  const faseBase = todasLasFases.find((f) => f.numeroFase === 0);
  const fasesReales = todasLasFases.filter((f) => f.numeroFase > 0).sort((a, b) => a.numeroFase - b.numeroFase);

  // Cuanto de cada linea ya esta asignado a fases reales (para el resumen de arriba).
  const asignadoOtrasFasesPorVentana = useMemo(() => {
    const map = new Map<string, number>();
    fasesReales.forEach((f) => (f.ventanasFase || []).forEach((vf) => map.set(vf.ventanaId, (map.get(vf.ventanaId) || 0) + Number(vf.unidades))));
    return map;
  }, [fasesReales]);

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

  const resumen = useMemo(() => {
    const totalUnidades = filas.reduce((sum, f) => sum + f.unidadesTotal, 0);
    const planificado = filas.reduce((sum, f) => sum + f.asignadoOtrasFases, 0);
    return { totalUnidades, planificado, sinPlanificar: totalUnidades - planificado };
  }, [filas]);

  // Materiales por fase real (GET /fases/:id/requerimiento de mtw-api): la
  // necesidad BRUTA de la fase (sin descontar stock), para que una partida no
  // desaparezca de aca cuando su material ya llego a bodega: la fila sigue
  // mostrando en que va (solicitado, recibida, requisicion...). El stock se
  // muestra al lado de cada material. Se pide para todas las fases reales de
  // una porque el resumen se muestra siempre.
  type ItemFase = {
    materialId: string;
    descripcion: string;
    proveedorNombre: string;
    unidad: string;
    cantidad: number;
    stockDisponible: number;
    precioUnitario: number;
    referenciaVentana: string | null;
    sinMedidas: boolean;
  };
  const requerimientos = useRequerimientosFases(
    proyecto.id,
    fasesReales.map((f) => f.id),
    false
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
    setSeleccionCubicacion({});
    setResumenSeleccion('nada seleccionado todavía');
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
    setError(null);
  };

  const esNueva = editando === 'nueva' || editando === null;

  const guardarMutation = useMutation({
    mutationFn: () => {
      if (esNueva) {
        return createFase(activeVersion!.id, {
          nombre: nombre.trim(),
          fechaInicio: fechaInicio || undefined,
          fechaEntrega: fechaEntrega || undefined,
          seleccionCubicacion,
        });
      }
      return updateFase(editando!, { nombre: nombre.trim(), fechaInicio: fechaInicio || undefined, fechaEntrega: fechaEntrega || undefined });
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
              <IconButton icono={XIcon} etiqueta="Cerrar el formulario" onClick={resetForm} />
            </div>

            {error && <Aviso tono="peligro">{error}</Aviso>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Nombre" placeholder="Ej. Torre Norte" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Input label="Fecha inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              <Input label="Fecha entrega" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
            </div>

          </div>

          {esNueva && (
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
                (esNueva &&
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
                      onClick={async () => {
                        if (await confirmar({ titulo: `¿Eliminar la fase "${fase.nombre}"?`, confirmar: 'Eliminar', peligro: true })) eliminarMutation.mutate(fase.id);
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
                          // Pieza a medida (vidrio) no se contrasta contra stock: nunca cuenta como cubierta.
                          const cubiertaPorStock = c.items.every((it) => !it.referenciaVentana && (stockPorMaterial.get(it.materialId) ?? 0) >= it.cantidad - 0.0001);
                          const cubiertaSoloObra = c.items.every((it) => !it.referenciaVentana && (stockObraPorMaterial.get(it.materialId) ?? 0) >= it.cantidad - 0.0001);
                          const requiereTraslado = cubiertaPorStock && !cubiertaSoloObra;
                          const estado = estadoPartida({ ordenes, requisiciones, faseId: fase.id, partidaCodigo: c.codigo, materialIds: c.items.map((it) => it.materialId), cubiertaPorStock, requiereTraslado });
                          // Mismo permiso que exige la API: pedir a Compras (compras.oc.solicitar) y pedir a bodega (obras.fases.editar).
                          const sinPermiso = estado.boton.accion === 'solicitar-materiales' ? !tiene('compras.oc.solicitar') : estado.boton.accion === 'solicitar-requisicion' ? !tiene('obras.fases.editar') : false;
                          const accionar = () => {
                            if (sinPermiso) return;
                            if (estado.boton.accion === 'solicitar-materiales') setOcParaFase({ fase, partida: c.codigo });
                            if (estado.boton.accion === 'solicitar-requisicion') actualizarParams({ seccion: 'requisiciones', nuevaFase: fase.id, partida: c.codigo });
                          };
                          return (
                            <div key={c.codigo} className="bg-white">
                              <div className="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <BotonColapsar abierto={expandidaCat} onClick={() => toggleExpandida(key)} className="text-xs font-bold text-slate-700 hover:text-brand-600">
                                    {c.nombre}
                                    <span className="font-mono font-normal text-slate-400">
                                      · {c.items.length} item{c.items.length === 1 ? '' : 's'}
                                    </span>
                                  </BotonColapsar>
                                  {estado.badge && (
                                    <Badge variant={estado.badge.variante} size="sm" title={estado.referencia ?? undefined}>
                                      {estado.badge.etiqueta}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-slate-800 text-[11px]">{formatoMoneda(c.monto)}</span>
                                  {/* Siempre el mismo ancho: el botón avanza de estado sin mover la fila. */}
                                  <Button
                                    size="sm"
                                    variant={estado.boton.accion === 'solicitar-requisicion' ? 'primary' : estado.boton.accion ? 'outline' : 'subtle'}
                                    disabled={!estado.boton.accion || sinPermiso}
                                    leftIcon={estado.boton.accion === 'solicitar-requisicion' || estado.boton.etiqueta.includes('ntrega') ? <PackageOpen className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                                    title={sinPermiso ? 'No tienes permiso para esta acción' : estado.referencia ? `${estado.referencia}` : estado.boton.accion === 'solicitar-requisicion' ? (requiereTraslado ? 'Parte del material está en Obras Mayores: pide a Bodega el traslado a la bodega de la obra antes de que se entregue la requisición' : 'Pedir a bodega los materiales de esta partida') : undefined}
                                    className="w-48 justify-center"
                                    onClick={accionar}
                                  >
                                    {estado.boton.etiqueta}
                                  </Button>
                                </div>
                              </div>

                              {expandidaCat && (
                                <div className="border-t border-slate-100 overflow-hidden">
                                  <Tabla>
                                    <Thead>
                                      <Tr className="text-left text-slate-400 uppercase tracking-wider">
                                        <Th className="font-bold">Item</Th>
                                        <Th className="font-bold">Proveedor</Th>
                                        <Th alinear="derecha" className="font-bold">Cantidad</Th>
                                        <Th alinear="derecha" className="font-bold">Precio unit.</Th>
                                        <Th alinear="derecha" className="font-bold">Subtotal</Th>
                                      </Tr>
                                    </Thead>
                                    <Tbody>
                                      {c.items.map((it, i) => (
                                        <Tr key={i} className="border-t border-slate-100/80">
                                          <Td className="text-slate-700">
                                            <span className="flex items-center gap-1.5">
                                              <Package className="w-3 h-3 text-sky-500 shrink-0" />
                                              {it.descripcion}
                                            </span>
                                            {it.referenciaVentana && <span className="block pl-[18px] text-[10px] text-slate-400">{it.referenciaVentana}</span>}
                                            {it.sinMedidas && <span className="block pl-[18px] text-[10px] text-amber-700">Sin medidas de HETMO todavía: va por m²</span>}
                                          </Td>
                                          <Td className="text-slate-500">{it.proveedorNombre}</Td>
                                          <Td alinear="derecha" className="font-mono text-slate-700">
                                            {it.cantidad.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {it.unidad}
                                            {(stockPorMaterial.get(it.materialId) ?? 0) > 0 && (
                                              <span className="block text-[10px] text-emerald-600 font-normal">
                                                en bodega {(stockPorMaterial.get(it.materialId) ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                                                {(stockPorMaterial.get(it.materialId) ?? 0) - (stockObraPorMaterial.get(it.materialId) ?? 0) > 0.0001 && (
                                                  <span className="text-amber-700"> ({((stockPorMaterial.get(it.materialId) ?? 0) - (stockObraPorMaterial.get(it.materialId) ?? 0)).toLocaleString('es-CL', { maximumFractionDigits: 2 })} en Obras Mayores)</span>
                                                )}
                                              </span>
                                            )}
                                          </Td>
                                          <Td alinear="derecha" className="font-mono text-slate-700">{formatoMoneda(it.precioUnitario)}</Td>
                                          <Td alinear="derecha" className="font-mono font-semibold text-slate-900">
                                            {formatoMoneda(it.cantidad * it.precioUnitario)}
                                          </Td>
                                        </Tr>
                                      ))}
                                    </Tbody>
                                  </Tabla>
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

      {ocParaFase && (
        <SolicitudMaterialesModal proyectoId={proyecto.id} proyectoLabel={proyecto.obra} faseIdInicial={ocParaFase.fase.id} partidaFiltro={ocParaFase.partida} onClose={() => setOcParaFase(null)} />
      )}
    </div>
  );
};
