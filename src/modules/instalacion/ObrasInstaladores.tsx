import React, { useMemo, useState } from 'react';
import { direccionDeObra } from '../../lib/chile';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, HardHat } from 'lucide-react';
import { getObrasInstalacion } from '../../api/client';
import { Buscador } from '../../components/ui/Buscador';
import { Badge } from '../../components/ui/Badge';
import { BotonFila } from '../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import type { ObraInstalacion } from '../../types';
import { fecha } from '../../lib/formato';
import { ETIQUETA_PASO, VARIANTE_PASO } from '../proyectos/pendientes/utils';

// «3 ingresados», «1 listo para despacho»: el paso en minúscula y en plural cuando son varios.
const PLURAL_PASO: Partial<Record<string, string>> = { INGRESADO: 'ingresados', RECIBIDO: 'recibidos', LISTO_DESPACHO: 'listos para despacho' };
const textoPaso = (paso: ObraPasoPendiente, cantidad: number) => (cantidad !== 1 && PLURAL_PASO[paso]) || (paso === 'EN_CURSO' ? 'en curso' : ETIQUETA_PASO[paso].toLowerCase());
type ObraPasoPendiente = NonNullable<ObraInstalacion['pendientesDetalle']>['pasos'][number]['paso'];

const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/** Los pendientes de una obra en la lista de Instaladores › Pendientes: cuántos hay en cada paso, de qué área y desde cuándo. */
const PendientesDeObra: React.FC<{ o: ObraInstalacion }> = ({ o }) => {
  const d = o.pendientesDetalle;
  if (o.pendientesAbiertos === 0) return <span className="text-xs text-slate-500">{d?.despachados ? `Sin pendientes abiertos · ${d.despachados} ya ${d.despachados === 1 ? 'despachado' : 'despachados'}` : 'Sin pendientes'}</span>;
  if (!d) {
    return (
      <Badge size="sm" variant="warning">
        {o.pendientesAbiertos} pendiente(s) abierto(s)
      </Badge>
    );
  }
  const dias = d.masAntiguo ? diasDesde(d.masAntiguo) : null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-slate-800">
          {o.pendientesAbiertos} {o.pendientesAbiertos === 1 ? 'abierto' : 'abiertos'}:
        </span>
        {d.pasos.map((x) => (
          <Badge key={x.paso} size="sm" variant={x.paso === 'EN_CURSO' ? 'warning' : VARIANTE_PASO[x.paso]}>
            {x.cantidad} {textoPaso(x.paso, x.cantidad)}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {[
          d.fabrica > 0 ? `Fábrica ${d.fabrica}` : null,
          d.compras > 0 ? `Compras ${d.compras}` : null,
          d.masAntiguo ? `el más antiguo es del ${fecha(d.masAntiguo)}${dias ? ` (hace ${dias} ${dias === 1 ? 'día' : 'días'})` : ''}` : null,
          d.despachados > 0 ? `${d.despachados} ya ${d.despachados === 1 ? 'despachado' : 'despachados'}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
};

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
    // Recepción: primero las obras que tienen algo por recibir. Pendientes: primero las que tienen pendientes abiertos.
    if (seccion === 'recepcion') return [...filtradas].sort((a, b) => Number(b.despachosPorRecibir > 0) - Number(a.despachosPorRecibir > 0));
    if (seccion === 'pendientes') return [...filtradas].sort((a, b) => Number(b.pendientesAbiertos > 0) - Number(a.pendientesAbiertos > 0));
    return filtradas;
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
                    {direccionDeObra(o) ? ` · ${direccionDeObra(o)}` : ''}
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
                  {seccion === 'pendientes' && <PendientesDeObra o={o} />}
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
