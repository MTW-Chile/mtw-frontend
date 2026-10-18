import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { getPartidas, getPorClasificar, reclasificarItemOC, updateAdicionalItem } from '../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../lib/designSystem';
import { avisarError } from '../configuracion/catalogo/comun';
import type { Partida } from '../../types';

const clp = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const SelectorPartida: React.FC<{ partidas: Partida[]; onElegir: (id: string) => void; disabled: boolean }> = ({ partidas, onElegir, disabled }) => (
  <select
    defaultValue=""
    disabled={disabled}
    onChange={(e) => e.target.value && onElegir(e.target.value)}
    className="text-xs border border-amber-300 bg-amber-50 text-amber-800 rounded-lg px-2 py-1 focus:outline-none focus:border-brand-600"
  >
    <option value="">Asignar partida…</option>
    {partidas
      .filter((p) => p.activa && !p.porDefecto)
      .map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
  </select>
);

/**
 * Bandeja "Por clasificar" (docs/ARQUITECTURA.md 3.4.5): ítems de OC y de
 * adicionales que quedaron en "Sin asignar". Cuentan en costo y venta, pero
 * no se contabilizan en Clay hasta asignarles su partida. Si un mismo ítem se
 * repite, falta un tipo de producto o una partida en el catálogo.
 */
export const PorClasificarTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['porClasificar'], queryFn: getPorClasificar });
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['porClasificar'] });
    queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
    queryClient.invalidateQueries({ queryKey: ['adicionales'] });
  };
  const oc = useMutation({ mutationFn: (v: { itemId: string; partidaId: string }) => reclasificarItemOC(v.itemId, v.partidaId), onSuccess: refrescar, onError: avisarError });
  const adicional = useMutation({
    mutationFn: (v: { adicionalId: string; itemId: string; partidaId: string }) => updateAdicionalItem(v.adicionalId, v.itemId, { partidaId: v.partidaId }),
    onSuccess: refrescar,
    onError: avisarError,
  });

  if (isLoading || !data) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (data.total === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 space-y-2">
        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
        <p>No hay nada por clasificar: todos los ítems tienen su partida.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Ítems libres que quedaron sin partida. Cuentan en el costo y la venta, pero no se contabilizan en Clay hasta asignársela.
      </p>
      {data.ordenesCompra.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100">Órdenes de compra</h3>
          <div className={TABLE_WRAPPER_CLASS}>
            <table className={`${TABLE_CLASS} text-left text-slate-700`}>
              <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-2.5">OC</th>
                  <th className="py-2.5">Ítem</th>
                  <th className="py-2.5">Obra</th>
                  <th className="py-2.5 text-right">Monto</th>
                  <th className="py-2.5">Partida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.ordenesCompra.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 font-mono text-[11px]">{i.ordenCompra.numero}</td>
                    <td className="py-2">
                      <div className="font-semibold text-slate-800">{i.descripcion}</div>
                      <div className="text-[10px] text-slate-400">{i.ordenCompra.proveedor?.nombre ?? 'Sin proveedor'}</div>
                    </td>
                    <td className="py-2 text-[11px]">{i.ordenCompra.proyecto?.obra ?? 'Obras Mayores'}</td>
                    <td className="py-2 text-right font-mono">{clp(Number(i.cantidad) * Number(i.precioUnitario ?? 0))}</td>
                    <td className="py-2">
                      <SelectorPartida partidas={partidas} disabled={oc.isPending} onElegir={(partidaId) => oc.mutate({ itemId: i.id, partidaId })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {data.adicionales.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100">Adicionales</h3>
          <div className={TABLE_WRAPPER_CLASS}>
            <table className={`${TABLE_CLASS} text-left text-slate-700`}>
              <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-2.5">Adicional</th>
                  <th className="py-2.5">Ítem</th>
                  <th className="py-2.5">Obra</th>
                  <th className="py-2.5 text-right">Costo</th>
                  <th className="py-2.5">Partida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.adicionales.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 font-mono text-[11px]">A{i.adicional.numero}</td>
                    <td className="py-2">
                      <div className="font-semibold text-slate-800">{i.descripcion}</div>
                      <div className="text-[10px] text-slate-400">{i.adicional.titulo}</div>
                    </td>
                    <td className="py-2 text-[11px]">{i.adicional.proyecto.obra}</td>
                    <td className="py-2 text-right font-mono">{clp(Number(i.cantidad) * Number(i.costoUnitario))}</td>
                    <td className="py-2">
                      <SelectorPartida
                        partidas={partidas}
                        disabled={adicional.isPending}
                        onElegir={(partidaId) => adicional.mutate({ adicionalId: i.adicional.id, itemId: i.id, partidaId })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
