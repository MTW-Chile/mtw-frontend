import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Wallet, ShoppingCart, PackageCheck, Receipt } from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { getControlPresupuesto } from '../../api/client';
import { useAnalitica } from '../cotizaciones/lib/useAnalitica';
import type { Proyecto, ProyectoVersion } from '../../types';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { EncabezadoSeccion } from '../../components/ui/EncabezadoSeccion';

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
  // Holgura de la partida (parte del presupuesto) y lo usado en reposiciones
  // (quiebre, falla, daño), que la consume.
  holgura: number;
  reposicion: number;
  // Fuera del presupuesto: se cobra al cliente, no cuenta en el % usado.
  adicional: number;
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
      if (!map.has(codigo))
        map.set(codigo, { codigo, nombre, presupuestado: 0, enOC: 0, facturado: 0, recibido: 0, holgura: 0, reposicion: 0, adicional: 0 });
      return map.get(codigo)!;
    };
    // Orden: el de la Analítica (orden configurado de las partidas), luego el resto.
    (analitica?.partidas || []).forEach((p) => {
      const fila = get(p.codigo, p.nombre);
      fila.presupuestado += p.total;
      fila.holgura += p.holgura;
    });
    (control || []).forEach((c) => {
      const fila = get(c.partida.codigo, c.partida.nombre);
      fila.enOC += c.comprometidoOC;
      fila.facturado += c.facturado;
      fila.recibido += c.recibido;
      fila.reposicion += c.usadoPorNaturaleza?.REPOSICION ?? 0;
      fila.adicional += c.usadoPorNaturaleza?.ADICIONAL ?? 0;
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
  // Lo usado del presupuesto = lo que sigue en OC + lo ya facturado, sin los
  // adicionales (fuera del presupuesto, se cobran aparte).
  const totalAdicional = filas.reduce((acc, f) => acc + f.adicional, 0);
  const usado = totales.enOC + totales.facturado - totalAdicional;
  const usadoDe = (f: FilaPartida) => f.enOC + f.facturado - f.adicional;

  if ((cargandoAnalitica || cargandoControl) && filas.length === 0) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <EncabezadoSeccion
        icono={Wallet}
        antetitulo="Obra"
        titulo="Control de presupuesto por partida"
        descripcion={<>Presupuestado = Analítica de Materiales de la versión activa (v{activeVersion?.versionNumero || '—'}). En OC = Órdenes de Compra no canceladas que aún no tienen factura. Facturado = neto de las facturas conciliadas (al conciliar, el monto pasa de En OC a Facturado). Recibido = lo que realmente ya entró a bodega.</>}
      />

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

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <Tabla>
          <Thead>
            <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
              <Th className="font-bold">Partida</Th>
              <Th alinear="derecha" className="font-bold">Presupuestado</Th>
              <Th alinear="derecha" className="font-bold">En OC</Th>
              <Th alinear="derecha" className="font-bold">Facturado</Th>
              <Th alinear="derecha" className="font-bold">% usado</Th>
              <Th alinear="derecha" className="font-bold" title="Reposiciones (quiebre, falla, daño) contra la holgura de la partida">
                Reposición / holgura
              </Th>
              <Th alinear="derecha" className="font-bold" title="Compras fuera del presupuesto: se cobran al cliente">
                Adicionales
              </Th>
              <Th alinear="derecha" className="font-bold">Recibido</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filas.map((f) => {
              const usadoFila = usadoDe(f);
              const pct = f.presupuestado > 0 ? (usadoFila / f.presupuestado) * 100 : usadoFila > 0 ? Infinity : 0;
              return (
                <Tr key={f.codigo} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <Td className="font-semibold text-slate-800">{f.nombre}</Td>
                  <Td alinear="derecha" className="font-mono text-slate-700">{formatCLP(f.presupuestado)}</Td>
                  <Td alinear="derecha" className="font-mono text-slate-700">{formatCLP(f.enOC)}</Td>
                  <Td alinear="derecha" className="font-mono text-violet-700">{formatCLP(f.facturado)}</Td>
                  <Td className={`px-4 py-3 text-right font-mono font-bold ${pct > 100 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {Number.isFinite(pct) ? `${pct.toFixed(0)}%` : '—'}
                  </Td>
                  <Td
                    className={`px-4 py-3 text-right font-mono ${f.reposicion > f.holgura + 0.5 ? 'text-rose-600 font-bold' : 'text-slate-700'}`}
                    title={f.reposicion > f.holgura + 0.5 ? 'Las reposiciones superan la holgura de la partida' : undefined}
                  >
                    {f.reposicion || f.holgura ? `${formatCLP(f.reposicion)} / ${formatCLP(f.holgura)}` : '—'}
                  </Td>
                  <Td alinear="derecha" className="font-mono text-violet-700">{f.adicional ? formatCLP(f.adicional) : '—'}</Td>
                  <Td alinear="derecha" className="font-mono text-emerald-700">{formatCLP(f.recibido)}</Td>
                </Tr>
              );
            })}
            {filas.length === 0 && (
              <Tr>
                <Td colSpan={8} alinear="centro" className="py-8 text-slate-400">
                  Sin materiales ni Órdenes de Compra todavía para esta versión.
                </Td>
              </Tr>
            )}
          </Tbody>
        </Tabla>
      </div>
    </div>
  );
};
