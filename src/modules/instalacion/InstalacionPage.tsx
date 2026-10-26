import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, HardHat } from 'lucide-react';
import { getObrasInstalacion } from '../../api/client';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { Buscador } from '../../components/ui/Buscador';
import { Badge } from '../../components/ui/Badge';
import { BotonFila } from '../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { actualizarParams, useUrlParam } from '../../lib/navigation';
import { InstalacionObra } from './InstalacionObra';

/**
 * Instalación (Supervisor de Instalación): las obras en curso con su avance;
 * entrar a una muestra la cubicación del edificio para recibir despachos,
 * certificar instalaciones y reportar pendientes. Móvil primero.
 */
export const InstalacionPage: React.FC = () => {
  const [obraId] = useUrlParam('obra');
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['instalacionObras'], queryFn: getObrasInstalacion });

  const obras = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data ?? []).filter((o) => !q || `${o.obra} ${o.codigoInterno ?? ''} ${o.clienteNombreRaw}`.toLowerCase().includes(q));
  }, [data, busqueda]);

  if (obraId) {
    return (
      <div className={PAGE_CONTAINER_CLASS}>
        <HeaderSeccion titulo="Instalación" />
        <InstalacionObra proyectoId={obraId} />
      </div>
    );
  }

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion titulo="Instalación" count={isLoading ? undefined : data?.length} />
      <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar obra…" etiqueta="Buscar obra" />
      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="las obras" onReintentar={refetch} />
      ) : obras.length === 0 ? (
        <EstadoVacio icono={HardHat} titulo="No hay obras en curso" descripcion="Una obra aparece aquí cuando su presupuesto está aceptado por el cliente." />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100">
          {obras.map((o) => {
            const pct = o.ventanas ? Math.round((o.instaladas / o.ventanas) * 100) : 0;
            return (
              <BotonFila key={o.id} onClick={() => actualizarParams({ obra: o.id })} className="flex items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{o.obra}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">{o.codigoInterno || `PRJ-${o.numeroPresupuesto}`}</span>
                    {o.despachosPorRecibir > 0 && (
                      <Badge size="sm" variant="violet">
                        {o.despachosPorRecibir} despacho(s) por recibir
                      </Badge>
                    )}
                    {o.pendientesAbiertos > 0 && (
                      <Badge size="sm" variant="warning">
                        {o.pendientesAbiertos} pendiente(s)
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {o.clienteNombreRaw}
                    {o.clienteDireccionRaw ? ` · ${o.clienteDireccionRaw}` : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 max-w-xs h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-600">
                      {o.instaladas}/{o.ventanas} instaladas
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </BotonFila>
            );
          })}
        </div>
      )}
    </div>
  );
};
