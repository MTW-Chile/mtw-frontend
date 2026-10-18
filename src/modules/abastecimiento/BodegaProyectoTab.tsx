import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Boxes, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Wrench, ChevronDown, ChevronRight, Tags, Send, Warehouse, History } from 'lucide-react';
import { getBodegaProyecto, getBodegaGlobal, getUnidadesMaterial } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { TrasladoBodegaModal } from './TrasladoBodegaModal';
import type { TipoMovimientoBodega, EstadoUnidadMaterial, Bodega, StockMaterial, BodegaProyectoResponse, BodegaGlobalResponse } from '../../types';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { BREAKPOINT_DESKTOP } from '../../lib/designSystem';
import { usePermisos } from '../../lib/permisos';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { BotonFila } from '../../components/ui/Lista';
import { EncabezadoSeccion } from '../../components/ui/EncabezadoSeccion';

const TIPO_MOVIMIENTO: Record<TipoMovimientoBodega, { label: string; icon: React.ReactNode; color: string }> = {
  INGRESO_OC: { label: 'Ingreso (OC)', icon: <ArrowDownToLine className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  SALIDA_OBRA: { label: 'Salida a obra', icon: <ArrowUpFromLine className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  TRASLADO_ENTRADA: { label: 'Traslado (entrada)', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, color: 'text-sky-600' },
  TRASLADO_SALIDA: { label: 'Traslado (salida)', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, color: 'text-sky-600' },
  AJUSTE_POSITIVO: { label: 'Ajuste (+)', icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  AJUSTE_NEGATIVO: { label: 'Ajuste (-)', icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-rose-600' },
};

const ESTADO_UNIDAD: Record<EstadoUnidadMaterial, { label: string; className: string }> = {
  DISPONIBLE: { label: 'Disponible', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CONSUMIDA: { label: 'Consumida', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  DEFECTUOSA: { label: 'Defectuosa', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  DEVUELTA_PROVEEDOR: { label: 'Devuelta a proveedor', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

// Nombre para mostrar de una bodega -- la obra si esta ligada a un
// Proyecto, o el nombre de su centro de costo (ej. "Obras Mayores") si
// no. Mismo criterio que labelCentroCosto() en mtw-api.
const labelBodega = (bodega?: Bodega | null) => bodega?.proyecto?.obra || bodega?.centroCosto?.nombre || bodega?.nombre || '—';

// Detalle de unidades individuales de un material (Perfileria/Refuerzos/
// Vidrios, ver Material.individualizado) -- se carga solo al expandir la
// fila, no de entrada junto con el resumen de stock.
const UnidadesMaterialDetalle: React.FC<{ bodegaId: string; materialId: string }> = ({ bodegaId, materialId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['unidadesMaterial', bodegaId, materialId],
    queryFn: () => getUnidadesMaterial(bodegaId, materialId),
  });

  if (isLoading) {
    return (
      <div className="px-4 py-3 flex items-center gap-2 text-slate-400 text-[11px]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando unidades…
      </div>
    );
  }

  if (!data || data.unidades.length === 0) {
    return <div className="px-4 py-3 text-[11px] text-slate-400">Sin unidades registradas.</div>;
  }

  return (
    <div className="px-4 py-3 flex flex-wrap gap-1.5">
      {data.unidades.map((u) => {
        const estado = ESTADO_UNIDAD[u.estado];
        const origen = u.ordenCompraNumero ? `Ingreso: OC ${u.ordenCompraNumero}` : 'Ingreso: ajuste manual';
        const medidas = u.anchoMm && u.altoMm ? `${u.anchoMm} × ${u.altoMm} mm` : null;
        const titulo = [estado.label, medidas, u.referenciaVentana, origen, new Date(u.creadoEn).toLocaleDateString('es-CL')]
          .filter(Boolean)
          .join(' · ');
        return (
          <span
            key={u.id}
            title={titulo}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono font-semibold ${estado.className}`}
          >
            {u.codigo}
            {medidas && <span className="font-sans font-normal opacity-80">· {medidas}{u.referenciaVentana ? ` · ${u.referenciaVentana}` : ''}</span>}
          </span>
        );
      })}
    </div>
  );
};

// Sin proyectoId: vista global (todas las bodegas juntas, incluida "Obras
// Mayores") -- pensada para el modulo Bodega de primer nivel. Con
// proyectoId: la de siempre, acotada a la bodega de esa obra (ficha de
// proyecto).
const esGlobal = (d: BodegaProyectoResponse | BodegaGlobalResponse | undefined): d is BodegaGlobalResponse =>
  !!d && 'bodegas' in d;

export const BodegaProyectoTab: React.FC<{ proyectoId?: string }> = ({ proyectoId }) => {
  const { data, isLoading } = useQuery<BodegaProyectoResponse | BodegaGlobalResponse>({
    queryKey: proyectoId ? ['bodegaProyecto', proyectoId] : ['bodegaGlobal'],
    queryFn: () => (proyectoId ? getBodegaProyecto(proyectoId) : getBodegaGlobal()),
  });
  // Mismo queryKey que el resto de la app -- sale del cache, no pega de
  // nuevo al backend.
  const { tiene } = usePermisos();
  const [expandido, setExpandido] = React.useState<Set<string>>(new Set());
  const [trasladando, setTrasladando] = React.useState<{ stock: StockMaterial; bodegasDestino: Bodega[] } | null>(null);

  const toggleExpandido = (materialId: string) => {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) next.delete(materialId);
      else next.add(materialId);
      return next;
    });
  };

  // Normaliza las dos formas de respuesta (por-proyecto trae una sola
  // bodega, global trae varias) a una lista comun -- el resto del render
  // no necesita saber cual vino. Se calcula ANTES de cualquier return
  // condicional porque los hooks de abajo (useMediaQuery/useColumnFilters)
  // tienen que llamarse siempre, en el mismo orden, en cada render.
  const global = esGlobal(data);
  const stock = data ? (global ? data.stock : data.stock.map((s) => ({ ...s, bodega: data.bodega ?? undefined }))) : [];
  const movimientos = data
    ? global
      ? data.movimientos
      : data.movimientos.map((m) => ({ ...m, bodega: data.bodega ?? undefined }))
    : [];
  const bodegasDisponibles: Bodega[] = global ? data.bodegas : [];
  // "Enviar a obra" solo tiene sentido en la vista global (hay a donde
  // trasladar) y exige bodega.trasladar. El stock no se borra: se corrige
  // con un ajuste, que queda en el kardex.
  const puedeTrasladar = !proyectoId && tiene('bodega.trasladar');
  const mostrarAcciones = puedeTrasladar;
  const colSpanDetalle = 4 + (!proyectoId ? 1 : 0) + (mostrarAcciones ? 1 : 0);

  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);
  const columnas: ColumnFilterDef<(typeof stock)[number]>[] = React.useMemo(
    () => [
      { key: 'sku', tipo: 'texto', label: 'SKU', accessor: (s) => s.material.skuInterno },
      { key: 'material', tipo: 'texto', label: 'Material', accessor: (s) => s.material.descripcion },
      ...(!proyectoId ? ([{ key: 'obra', tipo: 'texto', label: 'Obra', accessor: (s) => labelBodega(s.bodega) }] as ColumnFilterDef<(typeof stock)[number]>[]) : []),
      { key: 'partida', tipo: 'texto', label: 'Partida', accessor: (s) => s.material.tipoProducto?.partida?.nombre ?? s.material.familia },
    ],
    [proyectoId]
  );
  const { valores, setValor, datosFiltrados: stockVisible } = useColumnFilters(stock, columnas);

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (proyectoId && (!data || global || !data.bodega)) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs space-y-1">
        <Boxes className="w-6 h-6 mx-auto text-slate-300" />
        <p>Este proyecto todavía no tiene bodega -- se abre sola al aceptar el proyecto o con la primera recepción de una Orden de Compra.</p>
      </div>
    );
  }

  // Reusado en la fila de escritorio y en la tarjeta de mobile.
  const AccionesStock: React.FC<{ s: (typeof stock)[number] }> = ({ s }) => (
    <div className="flex items-center justify-end gap-1 flex-wrap">
      {puedeTrasladar && (
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Send className="w-3.5 h-3.5" />}
          onClick={() => setTrasladando({ stock: s, bodegasDestino: bodegasDisponibles.filter((b) => b.id !== s.bodegaId) })}
        >
          Enviar a obra
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {!proyectoId && (
        <div className="space-y-2.5">
          <EncabezadoSeccion icono={Warehouse} antetitulo="Bodega" titulo="Bodegas disponibles" />
          <div className="flex flex-wrap gap-1.5">
            {bodegasDisponibles.map((b) => {
              const items = stock.filter((s) => s.bodegaId === b.id).length;
              return (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  {labelBodega(b)}
                  <span className={`font-mono font-normal ${items === 0 ? 'text-slate-300' : 'text-slate-400'}`}>
                    · {items === 0 ? 'vacía' : `${items} ítem${items === 1 ? '' : 's'}`}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <EncabezadoSeccion icono={Boxes} antetitulo="Bodega" titulo="Stock actual" />
        {stock.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">Sin stock por ahora.</div>
        ) : stockVisible.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">Ningún ítem coincide con los filtros.</div>
        ) : isDesktop ? (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <Tabla>
              <Thead>
                <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                  <Th className="font-bold">SKU</Th>
                  <Th className="font-bold">Material</Th>
                  {!proyectoId && <Th className="font-bold">Obra</Th>}
                  <Th className="font-bold">Partida</Th>
                  <Th alinear="derecha" className="font-bold">Cantidad</Th>
                  {mostrarAcciones && <Th alinear="derecha" className="font-bold">Acciones</Th>}
                </Tr>
                <Tr className="border-b border-slate-100 bg-white">
                  {columnas.map((c) => (
                    <Th key={c.key}>
                      <ColumnFilterHeader columna={c} valor={valores[c.key] || ''} onChange={(v) => setValor(c.key, v)} />
                    </Th>
                  ))}
                  <Th colSpan={colSpanDetalle - columnas.length} />
                </Tr>
              </Thead>
              <Tbody>
                {stockVisible.map((s) => {
                  const abierto = expandido.has(s.materialId);
                  return (
                    <React.Fragment key={s.id}>
                      <Tr
                        className={`border-b border-slate-50 transition-colors ${s.material.individualizado ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50'}`}
                        onClick={() => s.material.individualizado && toggleExpandido(s.materialId)}
                      >
                        <Td className="font-mono text-slate-500">
                          <div className="flex items-center gap-1.5">
                            {s.material.individualizado &&
                              (abierto ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ))}
                            {s.material.skuInterno}
                          </div>
                        </Td>
                        <Td className="text-slate-800 font-semibold truncate max-w-0" title={s.material.descripcion}>
                          <div className="flex items-center gap-1.5">
                            {s.material.descripcion}
                            {s.material.individualizado && (
                              <span
                                title="Se controla por unidad individual"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-wide shrink-0"
                              >
                                <Tags className="w-2.5 h-2.5" /> Individualizado
                              </span>
                            )}
                          </div>
                        </Td>
                        {!proyectoId && <Td className="text-slate-600 truncate max-w-0">{labelBodega(s.bodega)}</Td>}
                        <Td className="text-slate-500">{s.material.tipoProducto?.partida?.nombre ?? s.material.familia}</Td>
                        <Td alinear="derecha" className="font-bold text-slate-900 whitespace-nowrap">
                          {Number(s.cantidad).toLocaleString('es-CL')} {s.material.unidadMedida}
                        </Td>
                        {mostrarAcciones && (
                          <Td alinear="derecha" onClick={(e) => e.stopPropagation()}>
                            <AccionesStock s={s} />
                          </Td>
                        )}
                      </Tr>
                      {abierto && s.material.individualizado && (
                        <Tr className="bg-slate-50/60">
                          <Td colSpan={colSpanDetalle} className="p-0">
                            <UnidadesMaterialDetalle bodegaId={s.bodegaId} materialId={s.materialId} />
                          </Td>
                        </Tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </Tbody>
            </Tabla>
          </div>
        ) : (
          <div className="space-y-3">
            {stockVisible.map((s) => {
              const abierto = expandido.has(s.materialId);
              return (
                <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <BotonFila sinRelleno onClick={() => s.material.individualizado && toggleExpandido(s.materialId)} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                        {s.material.individualizado &&
                          (abierto ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          ))}
                        {s.material.skuInterno}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{s.material.descripcion}</span>
                        {s.material.individualizado && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-wide">
                            <Tags className="w-2.5 h-2.5" /> Individualizado
                          </span>
                        )}
                      </div>
                      {!proyectoId && <p className="text-[11px] text-slate-500">{labelBodega(s.bodega)}</p>}
                      <p className="text-[11px] text-slate-400">{s.material.tipoProducto?.partida?.nombre ?? s.material.familia}</p>
                    </div>
                    <div className="text-right shrink-0 text-xs font-bold text-slate-900 whitespace-nowrap">
                      {Number(s.cantidad).toLocaleString('es-CL')} {s.material.unidadMedida}
                    </div>
                  </BotonFila>
                  {abierto && s.material.individualizado && (
                    <div className="pt-2 border-t border-slate-100 -mx-4">
                      <UnidadesMaterialDetalle bodegaId={s.bodegaId} materialId={s.materialId} />
                    </div>
                  )}
                  {mostrarAcciones && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1">
                      <AccionesStock s={s} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <EncabezadoSeccion icono={History} antetitulo="Bodega" titulo="Movimientos recientes" />
        {movimientos.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">Sin movimientos todavía.</div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-50">
            {movimientos.map((m) => {
              const tipo = TIPO_MOVIMIENTO[m.tipo];
              return (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={tipo.color}>{tipo.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{m.material.descripcion}</div>
                      <div className="text-[10px] text-slate-400">
                        {!proyectoId && <>{labelBodega(m.bodega)} · </>}
                        {tipo.label} · {new Date(m.creadoEn).toLocaleString('es-CL')}
                        {m.creadoPor && ` · ${m.creadoPor.nombre}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-900 shrink-0">
                    {['SALIDA_OBRA', 'TRASLADO_SALIDA'].includes(m.tipo) ? '-' : '+'}
                    {Number(m.cantidad).toLocaleString('es-CL')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {trasladando && <TrasladoBodegaModal stock={trasladando.stock} bodegasDestino={trasladando.bodegasDestino} onClose={() => setTrasladando(null)} />}
    </div>
  );
};
