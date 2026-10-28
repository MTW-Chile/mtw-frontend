import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, PackageCheck, ClipboardList, ArrowLeftRight } from 'lucide-react';
import { getBodegaGlobal, getOrdenesCompra, getSolicitudesMaterial } from '../../api/client';
import { StatCard } from '../../components/ui/StatCard';
import { actualizarParams } from '../../lib/navigation';
import type { OrdenCompra } from '../../types';

const DIAS_RECIENTES = 7;

const itemsPendientes = (oc: OrdenCompra) =>
  oc.items.filter((i) => (i.recepciones || []).reduce((s, r) => s + Number(r.cantidadRecibida), 0) < Number(i.cantidad) - 0.0001).length;

const n = (v: number) => v.toLocaleString('es-CL');

/**
 * Indicadores de Bodega (todas las bodegas juntas): lo que hay guardado, lo
 * que falta recibir de proveedores, lo que las obras están pidiendo y el
 * movimiento reciente. Cada tarjeta lleva a la pestaña donde se resuelve.
 * Se calcula con lo que ya traen las vistas del módulo (sin rutas nuevas).
 */
export const BodegaResumenSection: React.FC = () => {
  const { data: global } = useQuery({ queryKey: ['bodegaGlobal'], queryFn: getBodegaGlobal });
  const { data: ordenes } = useQuery({
    queryKey: ['ordenesCompra', 'pendientes-recepcion', 'global'],
    queryFn: () => getOrdenesCompra({ limit: 200 }),
  });
  const { data: solicitudes } = useQuery({ queryKey: ['solicitudesMaterial', 'global'], queryFn: () => getSolicitudesMaterial({}) });

  // Corte de "reciente" fijado al montar: el resumen no cambia solo con el paso de los segundos.
  const [desde] = useState(() => Date.now() - DIAS_RECIENTES * 24 * 60 * 60 * 1000);
  const resumen = useMemo(() => {
    const bodegas = global?.bodegas ?? [];
    const stock = global?.stock ?? [];
    const movimientos = global?.movimientos ?? [];
    const recientes = movimientos.filter((m) => new Date(m.creadoEn).getTime() >= desde);
    const ingresos = recientes.filter((m) => m.tipo === 'INGRESO_OC' || m.tipo === 'TRASLADO_ENTRADA' || m.tipo === 'AJUSTE_POSITIVO').length;
    const pendientesOC = (ordenes?.data ?? []).filter((oc) => oc.estado === 'ENVIADA' || oc.estado === 'RECIBIDA_PARCIAL');
    const reqs = solicitudes?.data ?? [];
    return {
      bodegasActivas: bodegas.filter((b) => b.activa).length,
      // Una fila de stock por material y bodega (la API ya deja fuera lo que está en 0).
      materialesEnStock: stock.length,
      bodegasConStock: new Set(stock.map((s) => s.bodegaId)).size,
      recepcionesPendientes: pendientesOC.length,
      itemsPorRecibir: pendientesOC.reduce((s, oc) => s + itemsPendientes(oc), 0),
      requisicionesPorEntregar: reqs.filter((r) => r.estado === 'GENERADA' || r.estado === 'APROBADA').length,
      requisicionesEnGerencia: reqs.filter((r) => r.estado === 'PENDIENTE_APROBACION_GERENCIA').length,
      movimientosRecientes: recientes.length,
      ingresosRecientes: ingresos,
      salidasRecientes: recientes.length - ingresos,
    };
  }, [global, ordenes, solicitudes, desde]);

  const cargando = !global || !ordenes || !solicitudes;
  const valor = (v: number) => (cargando ? '…' : n(v));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        title="Materiales en stock"
        value={valor(resumen.materialesEnStock)}
        icon={Boxes}
        subtitle={cargando ? undefined : `en ${n(resumen.bodegasConStock)} de ${n(resumen.bodegasActivas)} bodegas activas`}
      />
      <StatCard
        title="Recepciones pendientes"
        value={valor(resumen.recepcionesPendientes)}
        icon={PackageCheck}
        subtitle={cargando ? undefined : `${n(resumen.itemsPorRecibir)} ítem(s) de OC por recibir`}
        iconColor="text-sky-600"
        iconBgColor="bg-sky-50 border-sky-100"
        onClick={() => actualizarParams({ tab: 'recepciones' })}
      />
      <StatCard
        title="Requisiciones por entregar"
        value={valor(resumen.requisicionesPorEntregar)}
        icon={ClipboardList}
        subtitle={cargando ? undefined : resumen.requisicionesEnGerencia > 0 ? `${n(resumen.requisicionesEnGerencia)} esperando a Gerencia` : 'Ninguna esperando aprobación'}
        iconColor="text-amber-600"
        iconBgColor="bg-amber-50 border-amber-100"
        onClick={() => actualizarParams({ tab: 'requisiciones' })}
      />
      <StatCard
        title={`Movimientos · ${DIAS_RECIENTES} días`}
        value={valor(resumen.movimientosRecientes)}
        icon={ArrowLeftRight}
        subtitle={cargando ? undefined : `${n(resumen.ingresosRecientes)} entradas · ${n(resumen.salidasRecientes)} salidas`}
        iconColor="text-violet-600"
        iconBgColor="bg-violet-50 border-violet-100"
      />
    </div>
  );
};
