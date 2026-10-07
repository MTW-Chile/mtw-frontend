import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FolderKanban, ChevronRight, AlertCircle, Plus } from 'lucide-react';
import { getProyectos } from '../../api/client';
import { ProyectoWorkspace } from './ProyectoWorkspace';
import { NuevaObraManualModal } from './NuevaObraManualModal';
import { Button } from '../../components/ui/Button';
import { useUrlParam, actualizarParams } from '../../lib/navigation';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS, BREAKPOINT_DESKTOP, TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../lib/designSystem';
import type { Proyecto } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';


// Barra de avance compacta para la columna Fases (antes un texto largo
// "3/4 en producción o completadas" que forzaba el ancho de la tabla).
const AvanceFases: React.FC<{ resumen?: { total: number; enProduccionOCompletadas: number } }> = ({ resumen }) => {
  if (!resumen || resumen.total === 0) return <span className="text-slate-400">Sin fases</span>;
  const pct = Math.round((resumen.enProduccionOCompletadas / resumen.total) * 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono font-semibold text-slate-600">
        {resumen.enProduccionOCompletadas}/{resumen.total}
      </span>
    </span>
  );
};

const formatoMonto = (valor: number, simbolo?: string | null) =>
  `${simbolo || '$'}${valor.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;

// El ERP funciona "desde el proyecto": esta pantalla lista los proyectos
// ya ganados (version mas reciente en ACEPTADO_CLIENTE -- ahi recien
// arranca la ejecucion real: comprar, guardar en bodega, controlar el
// gasto contra el presupuesto). Cotizaciones sigue siendo el modulo
// aparte para lo que todavia se esta negociando.
export const ProyectosPage: React.FC = () => {
  // Proyecto abierto y su seccion viven en la URL (?proyecto=<id>&seccion=...)
  // -- ver lib/navigation.ts. Atras del navegador vuelve al listado.
  const [proyectoId] = useUrlParam('proyecto');
  const [seccionUrl] = useUrlParam('seccion');
  const setProyectoId = (id: string | null) => actualizarParams({ proyecto: id, seccion: null });
  const [creandoObraManual, setCreandoObraManual] = useState(false);
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  const { data, isLoading, isError, error } = useQuery({
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
        seccionInicial={seccionUrl ?? undefined}
        onVolver={() => setProyectoId(null)}
      />
    );
  }

  // Una obra manual no tiene presupuesto ni fases planificadas: entra directo a
  // Fabricacion, que es donde se le vinculan sus documentos.
  const abrir = (p: Proyecto) => actualizarParams({ proyecto: p.id, seccion: p.origen === 'MANUAL_OBRA' ? 'fabricacion' : null });

  const filaFases = (p: Proyecto) => {
    const resumen = p.fasesResumen;
    if (!resumen || resumen.total === 0) return 'Sin fases planificadas';
    return `${resumen.enProduccionOCompletadas}/${resumen.total} en producción o completadas`;
  };

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <PageHeader
        title="Obras en curso"
        description="Obras ya aceptadas por el cliente, o creadas a mano. Entra a una para ver presupuesto, fabricación, OC y bodega."
        icon={FolderKanban}
        count={isLoading ? undefined : proyectosEnCurso.length}
        actions={
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreandoObraManual(true)}>
            Nueva obra manual
          </Button>
        }
      />

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="p-12 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-col items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {(error as any)?.response?.data?.error || 'No se pudo cargar la lista de obras. Intenta de nuevo en unos minutos.'}
        </div>
      ) : proyectosEnCurso.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Todavía no hay obras en curso. Una obra pasa a "en curso" cuando su versión llega a estado ACEPTADO_CLIENTE en Cotizaciones, o la creas a mano con "Nueva obra manual".
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Ninguna obra coincide con los filtros.
        </div>
      ) : isDesktop ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className={TABLE_WRAPPER_CLASS}>
            <table className={TABLE_CLASS}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 font-bold">Obra</th>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold text-right">Presupuesto</th>
                  <th className="px-4 py-3 font-bold text-right">Comprometido en OC</th>
                  <th className="px-4 py-3 font-bold">Fases en producción</th>
                  <th className="px-4 py-3 font-bold w-10"></th>
                </tr>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="px-4 py-2">
                    <ColumnFilterHeader columna={columnas[0]} valor={valores.obra || ''} onChange={(v) => setValor('obra', v)} />
                  </th>
                  <th className="px-4 py-2">
                    <ColumnFilterHeader columna={columnas[1]} valor={valores.cliente || ''} onChange={(v) => setValor('cliente', v)} />
                  </th>
                  <th className="px-4 py-2" colSpan={4} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => abrir(p)}
                    className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 min-w-[15rem]">
                      <div className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug" title={p.obra}>
                        {p.obra}
                      </div>
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-semibold">
                        {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 min-w-[10rem] max-w-[16rem]" title={p.clienteNombreRaw}>
                      <div className="line-clamp-2 leading-snug">{p.clienteNombreRaw}</div>
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
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap" title={filaFases(p)}>
                      <AvanceFases resumen={p.fasesResumen} />
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
              onClick={() => abrir(p)}
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

      {creandoObraManual && (
        <NuevaObraManualModal
          onClose={() => setCreandoObraManual(false)}
          onCreada={(proyecto) => {
            setCreandoObraManual(false);
            abrir(proyecto);
          }}
        />
      )}
    </div>
  );
};
