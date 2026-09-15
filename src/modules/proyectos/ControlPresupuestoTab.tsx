import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Wallet, ShoppingCart, PackageCheck } from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { getOrdenesCompra } from '../../api/client';
import { useMonedas } from '../../lib/monedas';
import { computeMaterialesConsolidados, montoConAjuste, normalizarFamilia } from '../cotizaciones/lib/materialesConsolidados';
import type { Proyecto, ProyectoVersion } from '../../types';

const ORDEN_FAMILIAS = ['PERFILERIA', 'ACCESORIOS', 'REFUERZOS', 'HERRAJES', 'VIDRIOS'];
const ordenFamilia = (familia: string) => {
  const idx = ORDEN_FAMILIAS.indexOf(familia);
  return idx === -1 ? ORDEN_FAMILIAS.length : idx;
};

const formatCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

interface FilaPartida {
  familia: string;
  presupuestado: number;
  comprometido: number;
  recibido: number;
}

// "Revisión de presupuesto por partida de gastos": reusa EXACTAMENTE la
// misma formula de Presupuestado que la Analítica de Materiales de
// Cotizaciones (computeMaterialesConsolidados/montoConAjuste) -- no se
// reinventa un segundo calculo que podria desviarse del oficial. Lo nuevo
// acá es cruzarlo contra lo realmente comprometido/recibido vía OC.
export const ControlPresupuestoTab: React.FC<{ proyecto: Proyecto; activeVersion?: ProyectoVersion }> = ({
  proyecto,
  activeVersion,
}) => {
  const monedas = useMonedas();
  const tasaDolar = Number(activeVersion?.tipoCambioDolar) || 950;
  const tasaUf = Number(activeVersion?.tipoCambioUF) || 38500;
  const tasaEuro = Number(activeVersion?.tipoCambioEuro) || 1030;

  const { data: ocData, isLoading: isLoadingOC } = useQuery({
    queryKey: ['ordenesCompra', { proyectoId: proyecto.id, estado: '' }],
    queryFn: () => getOrdenesCompra({ proyectoId: proyecto.id, limit: 200 }),
  });

  const materialesConsolidados = useMemo(
    () => computeMaterialesConsolidados(activeVersion, tasaDolar, tasaEuro, tasaUf, monedas),
    [activeVersion, tasaDolar, tasaEuro, tasaUf, monedas]
  );

  const aprobacionesPorFamilia = useMemo(
    () => new Map((activeVersion?.familiaAprobaciones || []).map((f) => [f.familia, f])),
    [activeVersion?.familiaAprobaciones]
  );

  const filas = useMemo(() => {
    const map = new Map<string, FilaPartida>();
    const get = (familia: string) => {
      if (!map.has(familia)) map.set(familia, { familia, presupuestado: 0, comprometido: 0, recibido: 0 });
      return map.get(familia)!;
    };

    materialesConsolidados
      .filter((m) => !m.excluido)
      .forEach((m) => {
        get(m.familia).presupuestado += montoConAjuste(m, aprobacionesPorFamilia);
      });

    (ocData?.data || [])
      .filter((oc) => oc.estado !== 'CANCELADA' && oc.estado !== 'RECHAZADA')
      .forEach((oc) => {
        oc.items.forEach((item) => {
          const familia = item.material ? normalizarFamilia((item.material.familia || 'OTROS').toUpperCase().trim()) : 'SIN CATEGORÍA';
          const montoItem = Number(item.cantidad) * Number(item.precioUnitario);
          const fila = get(familia);
          fila.comprometido += montoItem;

          const cantidadRecibida = (item.recepciones || []).reduce((sum, r) => sum + Number(r.cantidadRecibida), 0);
          fila.recibido += cantidadRecibida * Number(item.precioUnitario);
        });
      });

    return Array.from(map.values()).sort((a, b) => {
      const diff = ordenFamilia(a.familia) - ordenFamilia(b.familia);
      return diff !== 0 ? diff : a.familia.localeCompare(b.familia);
    });
  }, [materialesConsolidados, aprobacionesPorFamilia, ocData]);

  const totales = filas.reduce(
    (acc, f) => ({
      presupuestado: acc.presupuestado + f.presupuestado,
      comprometido: acc.comprometido + f.comprometido,
      recibido: acc.recibido + f.recibido,
    }),
    { presupuestado: 0, comprometido: 0, recibido: 0 }
  );

  if (isLoadingOC && filas.length === 0) {
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
          Presupuestado = Analítica de Materiales de la versión activa (v{activeVersion?.versionNumero || '—'}). Comprometido =
          suma de Órdenes de Compra no canceladas. Recibido = lo que realmente ya entró a bodega.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Presupuestado" value={formatCLP(totales.presupuestado)} icon={Wallet} />
        <StatCard
          title="Comprometido en OC"
          value={formatCLP(totales.comprometido)}
          icon={ShoppingCart}
          iconColor="text-sky-600"
          iconBgColor="bg-sky-50 border-sky-200"
          trend={
            totales.presupuestado > 0
              ? { label: `${((totales.comprometido / totales.presupuestado) * 100).toFixed(0)}% del presupuesto`, positive: totales.comprometido <= totales.presupuestado }
              : undefined
          }
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
              <th className="px-4 py-3 font-bold text-right">Comprometido (OC)</th>
              <th className="px-4 py-3 font-bold text-right">% usado</th>
              <th className="px-4 py-3 font-bold text-right">Recibido</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const pct = f.presupuestado > 0 ? (f.comprometido / f.presupuestado) * 100 : f.comprometido > 0 ? Infinity : 0;
              return (
                <tr key={f.familia} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{f.familia}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCLP(f.presupuestado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{formatCLP(f.comprometido)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${pct > 100 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {Number.isFinite(pct) ? `${pct.toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">{formatCLP(f.recibido)}</td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
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
