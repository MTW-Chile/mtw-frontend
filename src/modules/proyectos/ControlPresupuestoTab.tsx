import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Wallet, ShoppingCart, PackageCheck, Receipt } from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { getControlPresupuesto } from '../../api/client';
import { useAnalitica } from '../cotizaciones/lib/useAnalitica';
import type { Proyecto, ProyectoVersion } from '../../types';

const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

interface FilaPartida {
  codigo: string;
  nombre: string;
  presupuestado: number;
  // Comprometido en OC que TODAVIA no tiene factura. Al conciliar, el monto
  // pasa de aca a facturado (nunca se cuenta dos veces).
  enOC: number;
  facturado: number;
  recibido: number;
}

// "Revisión de presupuesto por partida de gastos". Presupuestado = total por
// partida de la Analítica de Materiales (calculada en mtw-api, la misma de
// Cotizaciones). En OC / Facturado / Recibido = GET /control-presupuesto de
// mtw-api (todo en NETO; lo facturado de una OC se prorratea entre sus items
// segun su peso en el total, mismo criterio que el asiento en Clay). Esta
// pantalla solo cruza las dos fuentes, no calcula.
export const ControlPresupuestoTab: React.FC<{ proyecto: Proyecto; activeVersion?: ProyectoVersion }> = ({
  proyecto,
  activeVersion,
}) => {
  const { data: analitica, isLoading: cargandoAnalitica } = useAnalitica(proyecto.id, activeVersion?.id);
  const { data: control, isLoading: cargandoControl } = useQuery({
    queryKey: ['controlPresupuesto', proyecto.id],
    queryFn: () => getControlPresupuesto(proyecto.id),
  });

  const filas = useMemo(() => {
    const map = new Map<string, FilaPartida>();
    const get = (codigo: string, nombre: string) => {
      if (!map.has(codigo)) map.set(codigo, { codigo, nombre, presupuestado: 0, enOC: 0, facturado: 0, recibido: 0 });
      return map.get(codigo)!;
    };
    // Orden: el de la Analítica (orden configurado de las partidas), luego el resto.
    (analitica?.partidas || []).forEach((p) => {
      get(p.codigo, p.nombre).presupuestado += p.total;
    });
    (control || []).forEach((c) => {
      const fila = get(c.partida.codigo, c.partida.nombre);
      fila.enOC += c.comprometidoOC;
      fila.facturado += c.facturado;
      fila.recibido += c.recibido;
    });
    return Array.from(map.values()).filter((f) => f.presupuestado || f.enOC || f.facturado || f.recibido);
  }, [analitica, control]);

  const totales = filas.reduce(
    (acc, f) => ({
      presupuestado: acc.presupuestado + f.presupuestado,
      enOC: acc.enOC + f.enOC,
      facturado: acc.facturado + f.facturado,
      recibido: acc.recibido + f.recibido,
    }),
    { presupuestado: 0, enOC: 0, facturado: 0, recibido: 0 }
  );
  // Lo usado del presupuesto = lo que sigue en OC + lo ya facturado.
  const usado = totales.enOC + totales.facturado;

  if ((cargandoAnalitica || cargandoControl) && filas.length === 0) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-black text-slate-900">Control de presupuesto por partida</h2>
        <p className="text-xs text-slate-500">
          Presupuestado = Analítica de Materiales de la versión activa (v{activeVersion?.versionNumero || '—'}). En OC = Órdenes de
          Compra no canceladas que aún no tienen factura. Facturado = neto de las facturas conciliadas (al conciliar, el monto pasa de
          En OC a Facturado). Recibido = lo que realmente ya entró a bodega.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Presupuestado"
          value={formatCLP(totales.presupuestado)}
          icon={Wallet}
          trend={
            totales.presupuestado > 0
              ? { label: `${((usado / totales.presupuestado) * 100).toFixed(0)}% usado (OC + facturado)`, positive: usado <= totales.presupuestado }
              : undefined
          }
        />
        <StatCard
          title="En OC"
          value={formatCLP(totales.enOC)}
          icon={ShoppingCart}
          iconColor="text-sky-600"
          iconBgColor="bg-sky-50 border-sky-200"
        />
        <StatCard
          title="Facturado"
          value={formatCLP(totales.facturado)}
          icon={Receipt}
          iconColor="text-violet-600"
          iconBgColor="bg-violet-50 border-violet-200"
        />
        <StatCard
          title="Recibido en bodega"
          value={formatCLP(totales.recibido)}
          icon={PackageCheck}
          iconColor="text-emerald-600"
          iconBgColor="bg-emerald-50 border-emerald-200"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
              <th className="px-4 py-3 font-bold">Partida</th>
              <th className="px-4 py-3 font-bold text-right">Presupuestado</th>
              <th className="px-4 py-3 font-bold text-right">En OC</th>
              <th className="px-4 py-3 font-bold text-right">Facturado</th>
              <th className="px-4 py-3 font-bold text-right">% usado</th>
              <th className="px-4 py-3 font-bold text-right">Recibido</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const usadoFila = f.enOC + f.facturado;
              const pct = f.presupuestado > 0 ? (usadoFila / f.presupuestado) * 100 : usadoFila > 0 ? Infinity : 0;
              return (
                <tr key={f.codigo} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{f.nombre}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCLP(f.presupuestado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCLP(f.enOC)}</td>
                  <td className="px-4 py-3 text-right font-mono text-violet-700">{formatCLP(f.facturado)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${pct > 100 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {Number.isFinite(pct) ? `${pct.toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatCLP(f.recibido)}</td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Sin materiales ni Órdenes de Compra todavía para esta versión.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
