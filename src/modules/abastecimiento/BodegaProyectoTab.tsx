import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Boxes, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Wrench, ChevronDown, ChevronRight, Tags } from 'lucide-react';
import { getBodegaProyecto, getUnidadesMaterial } from '../../api/client';
import type { TipoMovimientoBodega, EstadoUnidadMaterial } from '../../types';

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
        const titulo = [estado.label, origen, new Date(u.creadoEn).toLocaleDateString('es-CL')].join(' · ');
        return (
          <span
            key={u.id}
            title={titulo}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono font-semibold ${estado.className}`}
          >
            {u.codigo}
          </span>
        );
      })}
    </div>
  );
};

export const BodegaProyectoTab: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['bodegaProyecto', proyectoId],
    queryFn: () => getBodegaProyecto(proyectoId),
  });
  const [expandido, setExpandido] = React.useState<Set<string>>(new Set());

  const toggleExpandido = (materialId: string) => {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) next.delete(materialId);
      else next.add(materialId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!data?.bodega) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs space-y-1">
        <Boxes className="w-6 h-6 mx-auto text-slate-300" />
        <p>Este proyecto todavía no tiene bodega -- se crea automáticamente con la primera recepción de una Orden de Compra.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Stock actual</h3>
        {data.stock.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">Sin stock por ahora.</div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 font-bold">SKU</th>
                  <th className="px-4 py-3 font-bold">Material</th>
                  <th className="px-4 py-3 font-bold">Familia</th>
                  <th className="px-4 py-3 font-bold text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {data.stock.map((s) => {
                  const abierto = expandido.has(s.materialId);
                  return (
                    <React.Fragment key={s.id}>
                      <tr
                        className={`border-b border-slate-50 transition-colors ${s.material.individualizado ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50'}`}
                        onClick={() => s.material.individualizado && toggleExpandido(s.materialId)}
                      >
                        <td className="px-4 py-3 font-mono text-slate-500">
                          <div className="flex items-center gap-1.5">
                            {s.material.individualizado &&
                              (abierto ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ))}
                            {s.material.skuInterno}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-800 font-semibold">
                          <div className="flex items-center gap-1.5">
                            {s.material.descripcion}
                            {s.material.individualizado && (
                              <span
                                title="Se controla por unidad individual"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-wide"
                              >
                                <Tags className="w-2.5 h-2.5" /> Individualizado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{s.material.familia}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {Number(s.cantidad).toLocaleString('es-CL')} {s.material.unidadMedida}
                        </td>
                      </tr>
                      {abierto && s.material.individualizado && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={4} className="p-0">
                            <UnidadesMaterialDetalle bodegaId={s.bodegaId} materialId={s.materialId} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Movimientos recientes</h3>
        {data.movimientos.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">Sin movimientos todavía.</div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-50">
            {data.movimientos.map((m) => {
              const tipo = TIPO_MOVIMIENTO[m.tipo];
              return (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={tipo.color}>{tipo.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{m.material.descripcion}</div>
                      <div className="text-[10px] text-slate-400">
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
    </div>
  );
};
