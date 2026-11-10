import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, HardHat } from 'lucide-react';
import { getObrasInstalacion } from '../../api/client';
import { Buscador } from '../../components/ui/Buscador';
import { Badge } from '../../components/ui/Badge';
import { BotonFila } from '../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import type { ObraInstalacion } from '../../types';

export type SeccionInstaladores = 'recepcion' | 'instalacion' | 'pendientes';

/** Obra elegida en una sección de Instaladores (sale de la misma lista: no se vuelve a pedir la obra). */
export function useObraInstaladores(obraId: string | null) {
  const consulta = useQuery({ queryKey: ['instalacionObras'], queryFn: getObrasInstalacion });
  return { ...consulta, obra: obraId ? (consulta.data?.find((o) => o.id === obraId) ?? null) : null };
}

/**
 * Lista de obras en curso con la que parten las tres secciones de Instaladores (Recepción, Instalación y
 * Pendientes). Es la misma lista; cada sección destaca lo suyo: despachos por recibir, avance de instalación o
 * pendientes abiertos. Filas altas y texto grande: se elige con el dedo, en terreno.
 */
export const ObrasInstaladores: React.FC<{ seccion: SeccionInstaladores; onElegir: (obra: ObraInstalacion) => void }> = ({ seccion, onElegir }) => {
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading, isError, refetch } = useObraInstaladores(null);

  const obras = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = (data ?? []).filter((o) => !q || `${o.obra} ${o.codigoInterno ?? ''} ${o.clienteNombreRaw}`.toLowerCase().includes(q));
    // Recepción: primero las obras que tienen algo por recibir.
    return seccion === 'recepcion' ? [...filtradas].sort((a, b) => Number(b.despachosPorRecibir > 0) - Number(a.despachosPorRecibir > 0)) : filtradas;
  }, [data, busqueda, seccion]);

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="las obras" onReintentar={refetch} />;

  return (
    <>
      <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar obra…" etiqueta="Buscar obra" />
      {obras.length === 0 ? (
        <EstadoVacio icono={HardHat} titulo="No hay obras en curso" descripcion="Una obra aparece aquí cuando su presupuesto está aceptado por el cliente." />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {obras.map((o) => {
            const pct = o.ventanas ? Math.round((o.instaladas / o.ventanas) * 100) : 0;
            return (
              <BotonFila key={o.id} onClick={() => onElegir(o)} className="flex items-center gap-3 min-h-16 pointer-coarse:py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{o.obra}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">{o.codigoInterno || `PRJ-${o.numeroPresupuesto}`}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {o.clienteNombreRaw}
                    {o.clienteDireccionRaw ? ` · ${o.clienteDireccionRaw}` : ''}
                  </p>
                  {seccion === 'recepcion' && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {o.despachosPorRecibir > 0 ? (
                        <Badge size="sm" variant="violet">
                          {o.despachosPorRecibir} por recibir
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500">Nada por recibir</span>
                      )}
                      {o.despachosRecibidos > 0 && (
                        <Badge size="sm" variant="success">
                          {o.despachosRecibidos} recibido(s)
                        </Badge>
                      )}
                    </div>
                  )}
                  {seccion === 'instalacion' && (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 max-w-xs h-2 rounded-full bg-slate-100 overflow-hidden">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        {o.instaladas}/{o.ventanas} instaladas
                      </span>
                    </div>
                  )}
                  {seccion === 'pendientes' &&
                    (o.pendientesAbiertos > 0 ? (
                      <Badge size="sm" variant="warning">
                        {o.pendientesAbiertos} pendiente(s) abierto(s)
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500">Sin pendientes abiertos</span>
                    ))}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
              </BotonFila>
            );
          })}
        </div>
      )}
    </>
  );
};

/** La obra pedida en la URL mientras carga, o si ya no está en curso. */
export const ObraNoDisponible: React.FC<{ cargando: boolean; error: boolean; onReintentar: () => void }> = ({ cargando, error, onReintentar }) =>
  cargando ? <Cargando texto="Leyendo la obra…" /> : error ? <ErrorCarga que="la obra" onReintentar={onReintentar} /> : <EstadoVacio icono={HardHat} titulo="Esta obra no está en curso" descripcion="Vuelve a la lista y elige otra." />;
