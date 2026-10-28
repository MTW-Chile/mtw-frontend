import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Factory, FileStack, FolderOpen, HardHat, LayoutGrid, Ruler, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { getOrdenesCompra, getPendientes, getResumenObra } from '../../api/client';
import { StatCard } from '../../components/ui/StatCard';
import { Seccion } from '../../components/ui/Seccion';
import { useAnalitica } from '../cotizaciones/lib/useAnalitica';
import { formatNumber } from '../../lib/utils';
import { usePermisos } from '../../lib/permisos';
import type { Proyecto, ProyectoVersion } from '../../types';
import { ControlPresupuestoTab } from './ControlPresupuestoTab';
import { DocumentosObraTab } from './documentos/DocumentosObraTab';
import { ClayCentroCostoEditor } from './ClayCentroCostoEditor';

const clp = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/**
 * Primera pestaña de la obra: métricas, Control de presupuesto por partida
 * (detalle plegado) y la carpeta de documentos de OneDrive.
 * Una obra manual (nunca cotizada) no tiene presupuesto ni analítica: sus
 * métricas salen de las ventanas de los documentos de fabricación que se le
 * vincularon y de su avance en obra (cubicadas, despachadas, instaladas).
 */
export const InformacionGeneralTab: React.FC<{ proyecto: Proyecto; activeVersion?: ProyectoVersion }> = ({ proyecto, activeVersion }) => {
  const cotizada = proyecto.origen !== 'MANUAL_OBRA';
  return (
    <div className="space-y-5">
      {/* En pantallas angostas el centro de costo no cabe en el header: va aquí. */}
      <div className="flex xl:hidden justify-end">
        <ClayCentroCostoEditor proyectoId={proyecto.id} valor={proyecto.clayCentroCosto} />
      </div>
      {cotizada ? <MetricasObra proyecto={proyecto} activeVersion={activeVersion} cotizada /> : <MetricasObraManual proyecto={proyecto} />}
      {cotizada && <ControlPresupuestoTab proyecto={proyecto} activeVersion={activeVersion} />}
      <Seccion icono={FolderOpen} titulo="Documentos" descripcion="Carpeta de OneDrive de la obra.">
        <DocumentosObraTab proyecto={proyecto} />
      </Seccion>
    </div>
  );
};

const MetricasObra: React.FC<{ proyecto: Proyecto; activeVersion?: ProyectoVersion; cotizada: boolean }> = ({ proyecto, activeVersion, cotizada }) => {
  const { tiene } = usePermisos();
  const { data: analitica } = useAnalitica(proyecto.id, cotizada ? activeVersion?.id : undefined);
  const { data: pendientes } = useQuery({ queryKey: ['pendientes', proyecto.id], queryFn: () => getPendientes(proyecto.id), enabled: tiene('pendientes.ver') });
  const { data: ocs } = useQuery({
    queryKey: ['ordenesCompra', 'conteo', proyecto.id],
    queryFn: () => getOrdenesCompra({ proyectoId: proyecto.id, limit: 1 }),
    enabled: cotizada && tiene('compras.ver'),
  });

  const abiertos = pendientes?.filter((p) => p.estado !== 'RESUELTO').length;
  const t = analitica?.totales;
  // Ventanas producidas: unidades de las fases completadas (fabricadas en
  // HETMO, ver el estado de cada fase) sobre el total del presupuesto.
  const totalUnidades = (activeVersion?.ventanas ?? []).reduce((sum, v) => sum + (v.unidades || 0), 0);
  const producidas = (activeVersion?.fases ?? [])
    .filter((f) => f.numeroFase > 0 && f.estado === 'COMPLETADA')
    .reduce((sum, f) => sum + (f.ventanasFase ?? []).reduce((s, vf) => s + (vf.unidades || 0), 0), 0);
  const pctProducidas = totalUnidades > 0 ? Math.round((producidas / totalUnidades) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-2 sm:gap-3">
      <StatCard title="Venta neta" value={t ? clp(t.venta) : '—'} subtitle={activeVersion ? `Versión v${activeVersion.versionNumero}` : undefined} icon={TrendingUp} />
      <StatCard
        title="Ventanas"
        value={analitica ? formatNumber(analitica.indicadores.ventanas, 0) : '—'}
        subtitle={t ? `${formatNumber(t.m2Ventanas, 2)} m²` : undefined}
        icon={LayoutGrid}
        iconColor="text-sky-600"
        iconBgColor="bg-sky-50 border-sky-200"
      />
      <StatCard
        title="Ventanas producidas"
        value={totalUnidades ? `${pctProducidas}%` : '—'}
        subtitle={totalUnidades ? `${producidas} de ${totalUnidades} unidades` : undefined}
        icon={Factory}
        iconColor="text-emerald-600"
        iconBgColor="bg-emerald-50 border-emerald-200"
      />
      <StatCard
        title="Órdenes de compra"
        value={ocs ? ocs.total : '—'}
        icon={ShoppingCart}
        iconColor="text-violet-600"
        iconBgColor="bg-violet-50 border-violet-200"
      />
      <StatCard
        title="Pendientes abiertos"
        value={abiertos ?? '—'}
        subtitle={pendientes ? `${pendientes.length} en total` : undefined}
        icon={ClipboardList}
        iconColor={abiertos ? 'text-amber-600' : 'text-emerald-600'}
        iconBgColor={abiertos ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}
      />
    </div>
  );
};

// Métricas de una obra manual: lo que HETMO fabrica para ella (documentos
// vinculados y sus ventanas) y el avance físico de las ventanas cubicadas.
// Los documentos se vinculan en Taller › Fabricación; la cubicación es la
// que habilita despachos e instalación (ver GET /api/proyectos/:id/resumen-obra).
const MetricasObraManual: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const { tiene } = usePermisos();
  const { data: r } = useQuery({ queryKey: ['resumenObra', proyecto.id], queryFn: () => getResumenObra(proyecto.id) });
  const f = r?.fabricacion;
  const v = r?.ventanas;
  const pct = (parte: number, total: number) => (total > 0 ? `${Math.round((parte / total) * 100)}%` : '—');
  const deTotal = (parte: number | undefined, total: number | undefined, que: string) => (total ? `${parte ?? 0} de ${total} ${que}` : `Sin ${que}`);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-2 sm:gap-3">
      <StatCard
        title="Documentos de fabricación"
        value={f ? f.documentos : '—'}
        subtitle={f ? (f.documentos ? `${f.ventanas} ventana(s) en HETMO` : 'Vincúlalos en Taller › Fabricación') : undefined}
        icon={FileStack}
      />
      <StatCard
        title="Ventanas fabricadas"
        value={f ? pct(f.fabricadas, f.ventanas) : '—'}
        subtitle={f ? `${f.fabricadas} de ${f.ventanas}${f.enFabricacion ? ` · ${f.enFabricacion} en fabricación` : ''}` : undefined}
        icon={Factory}
        iconColor="text-emerald-600"
        iconBgColor="bg-emerald-50 border-emerald-200"
      />
      <StatCard
        title="Cubicadas"
        value={v ? v.cubicadas : '—'}
        subtitle={v ? deTotal(v.cubicadas, v.contratadas, 'contratadas') : undefined}
        icon={Ruler}
        iconColor="text-sky-600"
        iconBgColor="bg-sky-50 border-sky-200"
      />
      <StatCard
        title="Despachadas"
        value={v ? v.despachadas : '—'}
        subtitle={v ? deTotal(v.despachadas, v.cubicadas, 'cubicadas') : undefined}
        icon={Truck}
        iconColor="text-violet-600"
        iconBgColor="bg-violet-50 border-violet-200"
      />
      <StatCard
        title="Instaladas"
        value={v ? v.instaladas : '—'}
        subtitle={v ? deTotal(v.instaladas, v.cubicadas, 'cubicadas') : undefined}
        icon={HardHat}
        iconColor="text-emerald-600"
        iconBgColor="bg-emerald-50 border-emerald-200"
      />
      {tiene('pendientes.ver') && (
        <StatCard
          title="Pendientes abiertos"
          value={r ? r.pendientesAbiertos : '—'}
          icon={ClipboardList}
          iconColor={r?.pendientesAbiertos ? 'text-amber-600' : 'text-emerald-600'}
          iconBgColor={r?.pendientesAbiertos ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}
        />
      )}
    </div>
  );
};
