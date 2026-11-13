import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { eliminarProyecto, getProyectos } from '../../api/client';
import { usePermisos } from '../../lib/permisos';
import { useConfirmar } from '../../components/ui/Confirmar';
import { IconButton } from '../../components/ui/IconButton';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { ProyectoWorkspace } from './ProyectoWorkspace';
import { CarpetaObraBoton } from './pendientes/adjuntos/CarpetaObraBoton';
import { NuevaObraLegacyModal } from './NuevaObraLegacyModal';
import { Button } from '../../components/ui/Button';
import { useUrlParam, actualizarParams } from '../../lib/navigation';
import { useAnchoContenedor } from '../../lib/useAnchoContenedor';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import type { Proyecto } from '../../types';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { BotonFila } from '../../components/ui/Lista';
import { clp, uf } from '../../lib/formato';
import { CodigoObra } from '../../components/ui/CodigoObra';
import { esObraLegacy } from '../../lib/obraLegacy';
import { Buscador } from '../../components/ui/Buscador';
import { Cargando, ErrorCarga, EstadoVacio } from '../../components/ui/Estados';
import { AvancePartes, textoAvancePartes } from './obra/AvancePartes';


// Barra de avance compacta para la columna Fases (antes un texto largo
// "3/4 en producción o completadas" que forzaba el ancho de la tabla).
const AvanceFases: React.FC<{ resumen?: { total: number; enProduccionOCompletadas: number } }> = ({ resumen }) => {
  if (!resumen || resumen.total === 0) return <span className="text-slate-500">Sin fases</span>;
  const pct = Math.round((resumen.enProduccionOCompletadas / resumen.total) * 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
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
// obra legacy vale 0, por eso no se muestra.
const ventaContratada = (p: Proyecto) => {
  const v = p.versiones[0]?.ventaTotalUFCongelada;
  return v != null && Number(v) > 0 ? uf(Number(v)) : '—';
};

// Barra "x de y" para las columnas de avance (ventanas, fases).
const Avance: React.FC<{ valor: number; total: number; color?: string; titulo?: string }> = ({ valor, total, color = 'bg-brand-500', titulo }) => {
  if (total === 0) return <span className="text-slate-500">—</span>;
  const pct = Math.min(100, Math.round((valor / total) * 100));
  return (
    <span className="inline-flex items-center gap-2" title={titulo ?? `${valor} de ${total}`}>
      <span className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
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
// obras legacy.
export const ProyectosPage: React.FC<{ modo?: 'obra' | 'fabricacion' }> = ({ modo = 'obra' }) => {
  const esFabricacion = modo === 'fabricacion';
  // Proyecto abierto y su seccion viven en la URL (?proyecto=<id>&seccion=...)
  // -- ver lib/navigation.ts. Atras del navegador vuelve al listado.
  const [proyectoId] = useUrlParam('proyecto');
  const [seccionUrl] = useUrlParam('seccion');
  const setProyectoId = (id: string | null) => actualizarParams({ proyecto: id, seccion: null });
  const [creandoObraLegacy, setCreandoObraLegacy] = useState(false);
  // Tabla solo si cabe de verdad en el espacio disponible (con el menú abierto en una tablet no cabe): si no, tarjetas.
  const [refPagina, anchoPagina] = useAnchoContenedor();
  // Mínimo medido: si la tabla igual no cabe (columnas anchas, nombres largos), se recuerda el ancho que necesita y por
  // debajo de él se usan tarjetas. Así la tabla nunca hace scroll horizontal.
  const [minTabla, setMinTabla] = useState(0);
  const cajaTabla = useRef<HTMLDivElement>(null);
  const isDesktop = anchoPagina >= Math.max(esFabricacion ? 1000 : 1180, minTabla);
  useLayoutEffect(() => {
    const sc = cajaTabla.current?.querySelector('.table-scroll');
    if (sc && sc.scrollWidth > sc.clientWidth + 1) setMinTabla(Math.ceil(anchoPagina + (sc.scrollWidth - sc.clientWidth) + 2));
  });

  const { data, isLoading, isError, refetch } = useQuery({
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

  // Eliminar una obra legacy (borrado físico, solo superadministrador): una obra cargada mal o de prueba.
  // Las obras cotizadas se eliminan desde Presupuestos, con el mismo permiso.
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const puedeEliminar = usePermisos().tiene('sistema.proyectos_eliminar');
  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarProyecto(id),
    onSuccess: (r) => {
      mostrarToast(`Obra "${r.obra}" eliminada.`, { tipo: 'info' });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['proyectosCount'] });
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });
  const pedirEliminar = async (p: Proyecto) => {
    if (await confirmar({ titulo: `¿Eliminar la obra "${p.obra}"?`, mensaje: 'Se borran su cubicación, sus documentos de fabricación vinculados, despachos, instalaciones y pendientes. No se puede deshacer.', confirmar: 'Eliminar', peligro: true })) eliminar.mutate(p.id);
  };
  const botonEliminar = (p: Proyecto) =>
    puedeEliminar && esObraLegacy(p) ? (
      <IconButton
        icono={Trash2}
        tono="peligro"
        etiqueta={`Eliminar la obra ${p.obra}, anterior al ERP (solo superadministrador)`}
        cargando={eliminar.isPending && eliminar.variables === p.id}
        onClick={(e) => {
          e.stopPropagation();
          pedirEliminar(p);
        }}
      />
    ) : null;

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

  // Toda obra parte en Información General, también la obra legacy en el taller.
  const abrir = (p: Proyecto) => actualizarParams({ proyecto: p.id, seccion: null });


  const filaFases = (p: Proyecto) => {
    const resumen = p.fasesResumen;
    if (!resumen || resumen.total === 0) return 'Sin fases planificadas';
    return `${resumen.enProduccionOCompletadas}/${resumen.total} en producción o completadas`;
  };
  const ro = (p: Proyecto) => p.resumenObra;
  // Pendientes abiertos: en ambas listas, como insignia (0 no se muestra).
  const pendientes = (p: Proyecto) => {
    const n = ro(p)?.pendientesAbiertos ?? 0;
    return n > 0 ? <span className="inline-block text-[11px] px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-mono font-semibold">{n} pend.</span> : <span className="text-slate-300">—</span>;
  };

  return (
    <div ref={refPagina} className={PAGE_CONTAINER_CLASS}>
      {/* Título y acciones viven en el Header del sitio (portal), igual que Presupuestos. */}
      <HeaderSeccion
        titulo={esFabricacion ? 'Fabricación' : 'Obras en curso'}
        acciones={
          esFabricacion ? undefined : (
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreandoObraLegacy(true)}>
              Nueva obra anterior al ERP
            </Button>
          )
        }
      />

      {/* En tarjetas (tablet, celular) el filtro de la tabla no existe: se busca aquí. */}
      {!isDesktop && proyectosEnCurso.length > 0 && (
        <Buscador valor={valores.obra || ''} onChange={(v) => setValor('obra', v)} placeholder="Buscar por obra o código…" etiqueta="Buscar obras" />
      )}

      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="la lista de obras" onReintentar={() => refetch()} />
      ) : proyectosEnCurso.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay obras en curso" descripcion="Una obra aparece aquí cuando el cliente acepta su presupuesto, o cuando se carga una obra anterior al ERP." />
      ) : !isDesktop && filtrados.length === 0 ? (
        <EstadoVacio titulo="Ninguna obra coincide con la búsqueda" />
      ) : isDesktop ? (
        <div ref={cajaTabla} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Tabla>
            <Thead>
              {/* Cada lista muestra lo suyo: Comercial, venta y cobro; Taller, el avance físico. */}
              <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[11px]">
                <Th className="font-bold">Obra</Th>
                <Th className="font-bold">Cliente</Th>
                {esFabricacion ? (
                  <>
                    <Th className="font-bold">Cubicadas</Th>
                    <Th className="font-bold">Fases en producción</Th>
                    <Th className="font-bold" title="Marcos (M) y hojas o vidrios (H) fabricados: lo dice su documento de HETMO, o que ya se despacharon">Fabricado</Th>
                    <Th className="font-bold" title="Marcos (M) y hojas o vidrios (H) en un despacho emitido">Despachado</Th>
                    <Th className="font-bold" title="Marcos (M) y hojas o vidrios (H) certificados como instalados">Instalado</Th>
                    <Th className="font-bold">Pendientes</Th>
                    <Th className="font-bold" title="Carpeta de producción de la obra en OneDrive">Carpeta</Th>
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
                <Th colSpan={esFabricacion ? 8 : 6} />
              </Tr>
            </Thead>
            <Tbody>
              {filtrados.length === 0 && (
                <Tr>
                  <Td colSpan={esFabricacion ? 10 : 8} className="py-10 text-center text-xs text-slate-500">
                    Ninguna obra coincide con los filtros.
                  </Td>
                </Tr>
              )}
              {filtrados.map((p) => (
                <Tr
                  key={p.id}
                  onClick={() => abrir(p)}
                  className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <Td className="min-w-[12rem]">
                    <div className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug" title={p.obra}>
                      {p.obra}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <CodigoObra obra={p} />
                    </div>
                  </Td>
                  <Td className="text-xs text-slate-600 min-w-[8rem] max-w-[16rem]" title={p.clienteNombreRaw}>
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
                        <AvancePartes compacto marcos={ro(p)?.ventanas.fabricadasMarco ?? 0} hojas={ro(p)?.ventanas.fabricadasHoja ?? 0} total={ro(p)?.ventanas.cubicadas ?? 0} tono="fabricacion" />
                      </Td>
                      <Td className="text-[11px] whitespace-nowrap">
                        <AvancePartes compacto marcos={ro(p)?.ventanas.despachadasMarco ?? 0} hojas={ro(p)?.ventanas.despachadasHoja ?? 0} total={ro(p)?.ventanas.cubicadas ?? 0} tono="despacho" />
                      </Td>
                      <Td className="text-[11px] whitespace-nowrap">
                        <AvancePartes compacto marcos={ro(p)?.ventanas.instaladasMarco ?? 0} hojas={ro(p)?.ventanas.instaladasHoja ?? 0} total={ro(p)?.ventanas.cubicadas ?? 0} tono="instalacion" />
                      </Td>
                      <Td>{pendientes(p)}</Td>
                      <Td className="whitespace-nowrap">
                        <CarpetaObraBoton proyecto={p} ambito="produccion" soloIcono />
                      </Td>
                    </>
                  ) : (
                    <>
                      <Td alinear="derecha" className="text-xs font-mono text-slate-700 whitespace-nowrap">{ventaContratada(p)}</Td>
                      <Td alinear="derecha" className="text-xs font-mono text-slate-700 whitespace-nowrap">
                        {p.montoComprometidoOC ? clp(p.montoComprometidoOC) : '—'}
                        {!!p.otrasMonedasOC?.length && (
                          <span className="block text-[11px] text-slate-500 font-normal">+ {p.otrasMonedasOC.join(', ')}</span>
                        )}
                      </Td>
                      <Td alinear="derecha" className="text-xs font-mono text-slate-700 whitespace-nowrap" title="Neto de los estados de pago presentados (pagado entre paréntesis)">
                        {ro(p)?.estadosPago?.vigentes ? (
                          <>
                            {uf(ro(p)!.estadosPago!.netoUF)}
                            <span className="block text-[11px] text-slate-500 font-normal">
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
                  <Td alinear="derecha" className="whitespace-nowrap">
                    {botonEliminar(p)}
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
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{p.obra}</h3>
                  <CodigoObra obra={p} />
                </div>
                <p className="text-xs text-slate-500 truncate">{p.clienteNombreRaw}</p>
                {esFabricacion ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>Cubicadas <b className="font-mono text-slate-700">{ro(p)?.ventanas.cubicadas ?? 0}/{ro(p)?.ventanas.contratadas ?? 0}</b></span>
                    <span>Fabricado <b className="font-mono text-slate-700">{textoAvancePartes(ro(p)?.ventanas.fabricadasMarco ?? 0, ro(p)?.ventanas.fabricadasHoja ?? 0)}</b></span>
                    <span>Despachado <b className="font-mono text-slate-700">{textoAvancePartes(ro(p)?.ventanas.despachadasMarco ?? 0, ro(p)?.ventanas.despachadasHoja ?? 0)}</b></span>
                    <span>Instalado <b className="font-mono text-slate-700">{textoAvancePartes(ro(p)?.ventanas.instaladasMarco ?? 0, ro(p)?.ventanas.instaladasHoja ?? 0)}</b></span>
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
                <p className="text-[11px] text-slate-500">{filaFases(p)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </BotonFila>
            <div className="flex items-center justify-between gap-2">
              <CarpetaObraBoton proyecto={p} ambito={esFabricacion ? 'produccion' : 'comercial'} />
              {botonEliminar(p)}
            </div>
            </div>
          ))}
        </div>
      )}

      {creandoObraLegacy && (
        <NuevaObraLegacyModal
          onClose={() => setCreandoObraLegacy(false)}
          onCreada={(proyecto) => {
            setCreandoObraLegacy(false);
            abrir(proyecto);
          }}
        />
      )}
    </div>
  );
};
