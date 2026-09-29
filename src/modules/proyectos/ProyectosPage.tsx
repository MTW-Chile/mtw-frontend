import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FolderKanban, ChevronRight, Layers } from 'lucide-react';
import { getProyectos } from '../../api/client';
import { ProyectoWorkspace } from './ProyectoWorkspace';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS, BREAKPOINT_DESKTOP, TABLE_CLASS } from '../../lib/designSystem';
import type { Proyecto } from '../../types';

interface ProyectosPageProps {
  // Deep-link desde la campanita de notificaciones (Header) -- abre este
  // proyecto directo en la seccion indicada. Se limpia con
  // onProyectoAbierto una vez consumido, para no re-abrirlo si el usuario
  // vuelve a este tab despues de haberlo cerrado a mano.
  proyectoAAbrir?: { id: string; seccion?: string } | null;
  onProyectoAbierto?: () => void;
}

const formatoMonto = (valor: number, simbolo?: string | null) =>
  `${simbolo || '$'}${valor.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;

// El ERP funciona "desde el proyecto": esta pantalla lista los proyectos
// ya ganados (version mas reciente en ACEPTADO_CLIENTE -- ahi recien
// arranca la ejecucion real: comprar, guardar en bodega, controlar el
// gasto contra el presupuesto). Cotizaciones sigue siendo el modulo
// aparte para lo que todavia se esta negociando.
export const ProyectosPage: React.FC<ProyectosPageProps> = ({ proyectoAAbrir, onProyectoAbierto }) => {
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [seccionInicial, setSeccionInicial] = useState<string | undefined>(undefined);
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  useEffect(() => {
    if (!proyectoAAbrir) return;
    setProyectoId(proyectoAAbrir.id);
    setSeccionInicial(proyectoAAbrir.seccion);
    onProyectoAbierto?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoAAbrir]);

  const { data, isLoading } = useQuery({
    queryKey: ['proyectos', 'en-curso'],
    queryFn: () => getProyectos({ limit: 200 }),
  });

  const proyectosEnCurso = useMemo(
    () => (data?.data || []).filter((p) => p.versiones[0]?.estadoAprobacion === 'ACEPTADO_CLIENTE'),
    [data]
  );

  const columnas: ColumnFilterDef<Proyecto>[] = useMemo(
    () => [
      { key: 'obra', tipo: 'texto', label: 'Obra', accessor: (p) => `${p.obra} ${p.codigoInterno || ''}` },
      { key: 'cliente', tipo: 'texto', label: 'Cliente', accessor: (p) => p.clienteNombreRaw || '' },
    ],
    []
  );
  const { valores, setValor, datosFiltrados: filtrados } = useColumnFilters(proyectosEnCurso, columnas);

  if (proyectoId) {
    return (
      <ProyectoWorkspace
        proyectoId={proyectoId}
        seccionInicial={seccionInicial}
        onVolver={() => {
          setProyectoId(null);
          setSeccionInicial(undefined);
        }}
      />
    );
  }

  const filaFases = (p: Proyecto) => {
    const resumen = p.fasesResumen;
    if (!resumen || resumen.total === 0) return 'Sin fases planificadas';
    return `${resumen.enProduccionOCompletadas}/${resumen.total} en producción o completadas`;
  };

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 flex items-center justify-center text-[#E34A26]">
          <FolderKanban className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black text-slate-900">Proyectos en curso</h1>
          <p className="text-xs text-slate-500">Obras ya aceptadas por el cliente -- entra a una para presupuesto, OC y bodega</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : proyectosEnCurso.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Todavía no hay proyectos aceptados por el cliente. Un proyecto pasa a "en curso" cuando su versión llega a estado ACEPTADO_CLIENTE en Cotizaciones.
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Ningún proyecto coincide con los filtros.
        </div>
      ) : isDesktop ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className={TABLE_CLASS}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 font-bold w-1/4">Obra</th>
                  <th className="px-4 py-3 font-bold w-1/5">Cliente</th>
                  <th className="px-4 py-3 font-bold text-right">Presupuesto</th>
                  <th className="px-4 py-3 font-bold text-right">Comprometido en OC</th>
                  <th className="px-4 py-3 font-bold">Fases</th>
                  <th className="px-4 py-3 font-bold w-10"></th>
                </tr>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="px-4 pb-2">
                    <ColumnFilterHeader columna={columnas[0]} valor={valores.obra || ''} onChange={(v) => setValor('obra', v)} />
                  </th>
                  <th className="px-4 pb-2">
                    <ColumnFilterHeader columna={columnas[1]} valor={valores.cliente || ''} onChange={(v) => setValor('cliente', v)} />
                  </th>
                  <th className="px-4 pb-2" colSpan={4} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setProyectoId(p.id)}
                    className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-900 truncate">{p.obra}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">
                          {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 truncate" title={p.clienteNombreRaw}>
                      {p.clienteNombreRaw}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-700 whitespace-nowrap">
                      {p.versiones[0]?.importeTotal != null
                        ? formatoMonto(p.versiones[0].importeTotal, p.versiones[0].monedaSimbolo)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-slate-700 whitespace-nowrap">
                      {p.montoComprometidoOC ? formatoMonto(p.montoComprometidoOC, '$') : '—'}
                      {!!p.otrasMonedasOC?.length && (
                        <span className="block text-[10px] text-slate-400 font-normal">+ {p.otrasMonedasOC.join(', ')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-300 shrink-0" />
                        {filaFases(p)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-50">
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => setProyectoId(p.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{p.obra}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">
                    {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{p.clienteNombreRaw}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-mono">
                  {p.versiones[0]?.importeTotal != null && (
                    <span>Presup. {formatoMonto(p.versiones[0].importeTotal, p.versiones[0].monedaSimbolo)}</span>
                  )}
                  {!!p.montoComprometidoOC && <span>OC {formatoMonto(p.montoComprometidoOC, '$')}</span>}
                </div>
                <p className="text-[11px] text-slate-400">{filaFases(p)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
