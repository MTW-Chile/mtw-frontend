import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Boxes, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Wrench } from 'lucide-react';
import { getBodegaProyecto } from '../../api/client';
import type { TipoMovimientoBodega } from '../../types';

const TIPO_MOVIMIENTO: Record<TipoMovimientoBodega, { label: string; icon: React.ReactNode; color: string }> = {
  INGRESO_OC: { label: 'Ingreso (OC)', icon: <ArrowDownToLine className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  SALIDA_OBRA: { label: 'Salida a obra', icon: <ArrowUpFromLine className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  TRASLADO_ENTRADA: { label: 'Traslado (entrada)', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, color: 'text-sky-600' },
  TRASLADO_SALIDA: { label: 'Traslado (salida)', icon: <ArrowLeftRight className="w-3.5 h-3.5" />, color: 'text-sky-600' },
  AJUSTE: { label: 'Ajuste', icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-slate-500' },
};

export const BodegaProyectoTab: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['bodegaProyecto', proyectoId],
    queryFn: () => getBodegaProyecto(proyectoId),
  });

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
                {data.stock.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">{s.material.skuInterno}</td>
                    <td className="px-4 py-3 text-slate-800 font-semibold">{s.material.descripcion}</td>
                    <td className="px-4 py-3 text-slate-500">{s.material.familia}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {Number(s.cantidad).toLocaleString('es-CL')} {s.material.unidadMedida}
                    </td>
                  </tr>
                ))}
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
