import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronRight, AlertCircle, Plus } from 'lucide-react';
import { getProyectos } from '../../api/client';
import { ProyectoWorkspace } from './ProyectoWorkspace';
import { CarpetaObraBoton } from './pendientes/adjuntos/CarpetaObraBoton';
import { NuevaObraManualModal } from './NuevaObraManualModal';
import { Button } from '../../components/ui/Button';
import { useUrlParam, actualizarParams } from '../../lib/navigation';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS, BREAKPOINT_DESKTOP } from '../../lib/designSystem';
import type { Proyecto } from '../../types';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { BotonFila } from '../../components/ui/Lista';
import { clp, uf } from '../../lib/formato';


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

// Venta contratada: el precio real en UF fijado al aceptar el presupuesto
// (ventaTotalUFCongelada). importeTotal es el peso crudo de HETMO y en una
// obra manual vale 0, por eso no se muestra.
const ventaContratada = (p: Proyecto) => {
  const v = p.versiones[0]?.ventaTotalUFCongelada;
  return v != null && Number(v) > 0 ? uf(Number(v)) : '—';
};

// Barra "x de y" para las columnas de avance (ventanas, fases).
const Avance: React.FC<{ valor: number; total: number; color?: string; titulo?: string }> = ({ valor, total, color = 'bg-brand-500', titulo }) => {
  if (total === 0) return <span className="text-slate-400">—</span>;
  const pct = Math.min(100, Math.round((valor / total) * 100));
  return (
    <span className="inline-flex items-center gap-2" title={titulo ?? `${valor} de ${total}`}>
      <span className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono font-semibold text-slate-600 tabular-nums">
        {valor}/{total}
      </span>
    </span>
  );
};

// El ERP funciona "desde el proyecto": esta pantalla lista los proyectos
// ya ganados (version mas reciente en ACEPTADO_CLIENTE -- ahi recien
// arranca la ejecucion real: comprar, guardar en bodega, controlar el
// gasto contra el presupuesto). Cotizaciones sigue siendo el modulo
// aparte para lo que todavia se esta negociando.
// modo 'fabricacion' (seccion Fabricacion del menu): la misma lista, pero la
// obra se abre con las pestañas del taller (ver seccionesObra.ts) y sin crear
// obras manuales.
export const ProyectosPage: React.FC<{ modo?: 'obra' | 'fabricacion' }> = ({ modo = 'obra' }) => {
  const esFabricacion = modo === 'fabricacion';
  // Proyecto abierto y su seccion viven en la URL (?proyecto=<id>&seccion=...)
  // -- ver lib/navigation.ts. Atras del navegador vuelve al listado.
  const [proyectoId] = useUrlParam('proyecto');
  const [seccionUrl] = useUrlParam('seccion');
  const setProyectoId = (id: string | null) => actualizarParams({ proyecto: id, seccion: null });
  const [creandoObraManual, setCreandoObraManual] = useState(false);
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['proyectos', 'en-curso'],
    queryFn: () => getProyectos({ limit: 200, incluir: 'obra' }),
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
        modo={modo}
      />
    );
  }

  // Ambas vistas parten en Información General. Una obra manual no tiene
  // presupuesto ni fases planificadas: en el taller entra directo a
  // Fabricacion, que es donde se le vinculan sus documentos.
  const abrir = (p: Proyecto) => actualizarParams({ proyecto: p.id, seccion: esFabricacion && p.origen === 'MANUAL_OBRA' ? 'fabricacion' : null });

  const filaFases = (p: Proyecto) => {
    const resumen = p.fasesResumen;
    if (!resumen || resumen.total === 0) return 'Sin fases planificadas';
    return `${resumen.enProduccionOCompletadas}/${resumen.total} en producción o completadas`;
  };
  const ro = (p: Proyecto) => p.resumenObra;
  // Pendientes abiertos: en ambas listas, como insignia (0 no se muestra).
  const pendientes = (p: Proyecto) => {
    const n = ro(p)?.pendientesAbiertos ?? 0;
    return n > 0 ? <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-mono font-semibold">{n} pend.</span> : <span className="text-slate-300">—</span>;
  };

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      {/* Título y acciones viven en el Header del sitio (portal), igual que Presupuestos. */}
      <HeaderSeccion
        titulo={esFabricacion ? 'Fabricación' : 'Obras en curso'}
        acciones={
          esFabricacion ? undefined : (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreandoObraManual(true)}>
              Nueva obra manual
            </Button>
          )
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
          Todavía no hay obras en curso. Una obra pasa a "en curso" cuando su versión llega a estado ACEPTADO_CLIENTE en Presupuestos, o la creas a mano con "Nueva obra manual".
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Ninguna obra coincide con los filtros.
        </div>
      ) : isDesktop ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Tabla>
            <Thead>
              {/* Cada lista muestra lo suyo: Comercial, venta y cobro; Taller, el avance físico. */}
              <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <Th className="font-bold">Obra</Th>
                <Th className="font-bold">Cliente</Th>
                {esFabricacion ? (
                  <>
                    <Th className="font-bold">Cubicadas</Th>
                    <Th className="font-bold">Fases en producción</Th>
                    <Th className="font-bold">Fabricadas</Th>
                    <Th className="font-bold">Despachadas</Th>
                    <Th className="font-bold">Instaladas</Th>
                    <Th className="font-bold">Pendientes</Th>
                  </>
                ) : (
                  <>
                    <Th alinear="derecha" className="font-bold">Venta contratada</Th>
                    <Th alinear="derecha" className="font-bold">Comprometido en OC</Th>
                    <Th alinear="derecha" className="font-bold">Estados de pago</Th>
                    <Th className="font-bold">Pendientes</Th>
                    <Th className="font-bold">OneDrive</Th>
                  </>
                )}
                <Th className="font-bold w-10"></Th>
              </Tr>
              <Tr className="border-b border-slate-100 bg-white">
                <Th>
                  <ColumnFilterHeader columna={columnas[0]} valor={valores.obra || ''} onChange={(v) => setValor('obra', v)} />
                </Th>
                <Th>
                  <ColumnFilterHeader columna={columnas[1]} valor={valores.cliente || ''} onChange={(v) => setValor('cliente', v)} />
                </Th>
                <Th colSpan={esFabricacion ? 7 : 6} />
              </Tr>
            </Thead>
            <Tbody>
              {filtrados.map((p) => (
                <Tr
                  key={p.id}
                  onClick={() => abrir(p)}
                  className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <Td className="min-w-[15rem]">
                    <div className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug" title={p.obra}>
                      {p.obra}
                    </div>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-semibold">
                      {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                    </span>
                  </Td>
                  <Td className="text-xs text-slate-600 min-w-[10rem] max-w-[16rem]" title={p.clienteNombreRaw}>
                    <div className="line-clamp-2 leading-snug">{p.clienteNombreRaw}</div>
                  </Td>
                  {esFabricacion ? (
                    <>
                      <Td className="text-[11px] whitespace-nowrap">
                        <Avance valor={ro(p)?.ventanas.cubicadas ?? 0} total={ro(p)?.ventanas.contratadas ?? 0} color="bg-slate-400" titulo="Ventanas con posición en la cubicación, de las contratadas" />
                      </Td>
                      <Td className="text-[11px] text-slate-500 whitespace-nowrap" title={filaFases(p)}>
                        <AvanceFases resumen={p.fasesResumen} />
                      </Td>
                      <Td className="text-[11px] whitespace-nowrap">
                        <Avance valor={ro(p)?.ventanas.fabricadas ?? 0} total={ro(p)?.ventanas.cubicadas ?? 0} color="bg-sky-500" titulo="Ventanas cuyo lote de HETMO está fabricado, de las cubicadas" />
                      </Td>
                      <Td className="text-[11px] whitespace-nowrap">
                        <Avance valor={ro(p)?.ventanas.despachadas ?? 0} total={ro(p)?.ventanas.cubicadas ?? 0} color="bg-violet-500" titulo="Ventanas en un despacho emitido, de las cubicadas" />
                      </Td>
                      <Td className="text-[11px] whitespace-nowrap">
                        <Avance valor={ro(p)?.ventanas.instaladas ?? 0} total={ro(p)?.ventanas.cubicadas ?? 0} color="bg-emerald-500" titulo="Ventanas certificadas como instaladas, de las cubicadas" />
                      </Td>
                      <Td>{pendientes(p)}</Td>
                    </>
                  ) : (
                    <>
                      <Td alinear="derecha" className="text-xs font-mono text-slate-700 whitespace-nowrap">{ventaContratada(p)}</Td>
                      <Td alinear="derecha" className="text-xs font-mono text-slate-700 whitespace-nowrap">
                        {p.montoComprometidoOC ? clp(p.montoComprometidoOC) : '—'}
                        {!!p.otrasMonedasOC?.length && (
                          <span className="block text-[10px] text-slate-400 font-normal">+ {p.otrasMonedasOC.join(', ')}</span>
                        )}
                      </Td>
                      <Td alinear="derecha" className="text-xs font-mono text-slate-700 whitespace-nowrap" title="Neto de los estados de pago presentados (pagado entre paréntesis)">
                        {ro(p)?.estadosPago?.vigentes ? (
                          <>
                            {uf(ro(p)!.estadosPago!.netoUF)}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {ro(p)!.estadosPago!.vigentes} EP · pagado {uf(ro(p)!.estadosPago!.pagadoUF)}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>{pendientes(p)}</Td>
                      <Td className="whitespace-nowrap">
                        <CarpetaObraBoton proyecto={p} />
                      </Td>
                    </>
                  )}
                  <Td alinear="derecha">
                    <ChevronRight className="w-4 h-4 text-slate-300 inline-block" />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Tabla>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-50">
          {filtrados.map((p) => (
            <div key={p.id} className="px-5 py-4 space-y-2 hover:bg-slate-50/70 transition-colors">
            <BotonFila sinRelleno onClick={() => abrir(p)} className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{p.obra}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold shrink-0">
                    {p.codigoInterno || `PRJ-${p.numeroPresupuesto}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{p.clienteNombreRaw}</p>
                {esFabricacion ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>Cubicadas <b className="font-mono text-slate-700">{ro(p)?.ventanas.cubicadas ?? 0}/{ro(p)?.ventanas.contratadas ?? 0}</b></span>
                    <span>Fabricadas <b className="font-mono text-slate-700">{ro(p)?.ventanas.fabricadas ?? 0}</b></span>
                    <span>Despachadas <b className="font-mono text-slate-700">{ro(p)?.ventanas.despachadas ?? 0}</b></span>
                    <span>Instaladas <b className="font-mono text-slate-700">{ro(p)?.ventanas.instaladas ?? 0}</b></span>
                    {pendientes(p)}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-mono">
                    <span>Venta {ventaContratada(p)}</span>
                    {!!p.montoComprometidoOC && <span>OC {clp(p.montoComprometidoOC)}</span>}
                    {!!ro(p)?.estadosPago?.vigentes && <span>EP {uf(ro(p)!.estadosPago!.netoUF)}</span>}
                    {pendientes(p)}
                  </div>
                )}
                <p className="text-[11px] text-slate-400">{filaFases(p)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </BotonFila>
            {!esFabricacion && <CarpetaObraBoton proyecto={p} />}
            </div>
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
