import React, { useMemo, useState } from 'react';
import { direccionDeObra } from '../../lib/chile';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Truck } from 'lucide-react';
import { getObrasDespachos, getProyectoById } from '../../api/client';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { Buscador } from '../../components/ui/Buscador';
import { Badge } from '../../components/ui/Badge';
import { BotonFila } from '../../components/ui/Lista';
import { Segmentado } from '../../components/ui/Segmentado';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { actualizarParams, useUrlParam } from '../../lib/navigation';
import { useMigas } from '../../lib/migas';
import type { ObraDespachos } from '../../types';
import { DespachosTab } from '../proyectos/despachos/DespachosTab';
import { CodigoObra } from '../../components/ui/CodigoObra';
import { AvancePartes } from '../proyectos/obra/AvancePartes';

type Filtro = 'TODAS' | 'BORRADORES' | 'POR_RECIBIR';
const pasa = (o: ObraDespachos, f: Filtro) => (f === 'BORRADORES' ? o.borradores > 0 : f === 'POR_RECIBIR' ? o.porRecibir > 0 : true);

/**
 * Despachos (seccion propia del menu, entre Taller e Instalacion): las obras
 * en curso con su avance de despacho; entrar a una lista sus despachos y
 * permite armar y emitir uno nuevo (DespachosTab). Cada despacho emitido
 * aparece en Instalacion como recepcion pendiente.
 */
export const DespachosPage: React.FC = () => {
  const [obraId] = useUrlParam('obra');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['despachosObras'], queryFn: getObrasDespachos, enabled: !obraId });

  const obras = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data ?? []).filter((o) => pasa(o, filtro) && (!q || `${o.obra} ${o.codigoInterno ?? ''} ${o.clienteNombreRaw}`.toLowerCase().includes(q)));
  }, [data, busqueda, filtro]);

  if (obraId) {
    return (
      <div className={PAGE_CONTAINER_CLASS}>
        <HeaderSeccion titulo="Despachos" />
        <DespachosObra proyectoId={obraId} />
      </div>
    );
  }

  const total = data ?? [];
  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion titulo="Despachos" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar obra…" etiqueta="Buscar obra" />
        </div>
        <Segmentado
          etiqueta="Filtrar obras"
          tamano="xs"
          valor={filtro}
          onChange={setFiltro}
          opciones={[
            { value: 'TODAS', label: 'Todas', contador: total.length },
            { value: 'BORRADORES', label: 'Con borrador', contador: total.filter((o) => o.borradores > 0).length },
            { value: 'POR_RECIBIR', label: 'Por recibir', contador: total.filter((o) => o.porRecibir > 0).length },
          ]}
        />
      </div>
      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="las obras" onReintentar={refetch} />
      ) : obras.length === 0 ? (
        <EstadoVacio
          icono={Truck}
          titulo={total.length === 0 ? 'No hay obras en curso' : 'Ninguna obra con ese filtro'}
          descripcion={total.length === 0 ? 'Una obra aparece aquí cuando el cliente acepta su presupuesto, o cuando se carga una obra anterior al ERP.' : 'Prueba con Todas o cambia la búsqueda.'}
        />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100">
          {obras.map((o) => {
            const pct = o.ventanas ? Math.round((o.despachadas / o.ventanas) * 100) : 0;
            return (
              <BotonFila key={o.id} onClick={() => actualizarParams({ obra: o.id })} className="flex items-center gap-3 pointer-coarse:min-h-16">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{o.obra}</h3>
                    <CodigoObra obra={o} />
                    {o.pendientesPorDespachar > 0 && (
                      <Badge size="sm" variant="info">
                        {o.pendientesPorDespachar} pendiente(s) listo(s)
                      </Badge>
                    )}
                    {o.borradores > 0 && (
                      <Badge size="sm" variant="warning">
                        {o.borradores} borrador(es)
                      </Badge>
                    )}
                    {o.porRecibir > 0 && (
                      <Badge size="sm" variant="violet">
                        {o.porRecibir} por recibir en obra
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {o.clienteNombreRaw}
                    {direccionDeObra(o) ? ` · ${direccionDeObra(o)}` : ''}
                  </p>
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                    {/* Despachado por parte: marcos y hojas salen en despachos distintos. */}
                    <AvancePartes marcos={o.despachadasMarco} hojas={o.despachadasHoja} total={o.ventanas} tono="despacho" className="flex-1 min-w-[12rem] max-w-xs" />
                    <span className="text-xs text-slate-600">
                      <b className="tabular-nums">{o.despachadas}</b> completas ({pct}%) · {o.despachos} despacho(s)
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

/** Los despachos de una obra: la misma pestaña que antes vivia en Fabricacion. */
const DespachosObra: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const { data: proyecto, isLoading, isError, refetch } = useQuery({ queryKey: ['proyectoDetail', proyectoId], queryFn: () => getProyectoById(proyectoId) });
  useMigas(1, [{ label: proyecto?.obra ?? '', codigo: proyecto?.codigoInterno ?? undefined, alHacerClic: () => actualizarParams({ obra: proyectoId }) }]);
  if (isLoading) return <Cargando />;
  if (isError || !proyecto) return <ErrorCarga que="la obra" onReintentar={refetch} />;
  return <DespachosTab proyecto={proyecto} />;
};
