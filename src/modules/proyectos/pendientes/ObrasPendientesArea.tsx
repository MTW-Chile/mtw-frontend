import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, HardHat } from 'lucide-react';
import { getObrasPendientes } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Buscador } from '../../../components/ui/Buscador';
import { Cargando, ErrorCarga, EstadoVacio } from '../../../components/ui/Estados';
import { BotonFila } from '../../../components/ui/Lista';
import type { ObraConPendientes } from '../../../types';
import type { AreaPendiente } from './utils';

/** Las obras en curso con lo que el área tiene por gestionar en cada una (misma consulta para la lista y la obra elegida). */
export function useObrasPendientes(area: AreaPendiente) {
  return useQuery({ queryKey: ['pendientes', 'obras', area], queryFn: () => getObrasPendientes(area) });
}

/**
 * Con esta lista parten Taller › Pendientes y Abastecimiento › Pendientes: las compras y la fabricación se organizan
 * por obra, así que primero se elige la obra y después se ven sus pendientes. Arriba van las que tienen algo que el
 * área debe mover (por recibir o en gestión); la API ya las entrega en ese orden.
 */
export const ObrasPendientesArea: React.FC<{ area: AreaPendiente; onElegir: (obra: ObraConPendientes) => void }> = ({ area, onElegir }) => {
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading, isError, refetch } = useObrasPendientes(area);
  const obras = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data ?? []).filter((o) => !q || `${o.obra} ${o.codigoInterno ?? ''} ${o.cliente ?? ''}`.toLowerCase().includes(q));
  }, [data, busqueda]);
  const conPendientes = (data ?? []).filter((o) => o.abiertos > 0).length;

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="las obras" onReintentar={refetch} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-black text-slate-900">Pendientes por obra</h2>
        <p className="text-xs text-slate-500 max-w-xl">
          {area === 'FABRICA' ? 'Marcos, hojas y ventanas completas por reponer.' : 'Vidrios y materiales por comprar.'} Elige la obra para ver los suyos.{' '}
          {conPendientes > 0 ? `${conPendientes} ${conPendientes === 1 ? 'obra tiene' : 'obras tienen'} pendientes abiertos; van primero.` : 'Ninguna obra tiene pendientes abiertos.'}
        </p>
      </div>
      <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar obra…" etiqueta="Buscar obra" />
      {obras.length === 0 ? (
        <EstadoVacio icono={HardHat} titulo="No hay obras en curso" descripcion="Una obra aparece aquí cuando su presupuesto está aceptado por el cliente." />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {obras.map((o) => (
            <BotonFila key={o.id} onClick={() => onElegir(o)} className={`flex items-center gap-3 min-h-14 ${o.abiertos === 0 ? 'opacity-70' : ''}`}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{o.obra}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">{o.codigoInterno || `PRJ-${o.numeroPresupuesto}`}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{[o.cliente, o.direccion].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 max-w-[55%]">
                {o.porRecibir > 0 && (
                  <Badge size="sm" variant="info">
                    {o.porRecibir} por recibir
                  </Badge>
                )}
                {o.enGestion > 0 && (
                  <Badge size="sm" variant="warning">
                    {o.enGestion} en gestión
                  </Badge>
                )}
                {o.listos > 0 && (
                  <Badge size="sm" variant="violet">
                    {o.listos} {o.listos === 1 ? 'listo' : 'listos'} para despacho
                  </Badge>
                )}
                {o.abiertos === 0 && <span className="text-xs text-slate-500">{o.cerrados > 0 ? `Sin pendientes abiertos · ${o.cerrados} despachado(s)` : 'Sin pendientes'}</span>}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
            </BotonFila>
          ))}
        </div>
      )}
    </div>
  );
};
