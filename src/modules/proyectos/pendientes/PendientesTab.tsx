import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Loader2, Paperclip, Plus } from 'lucide-react';
import { getPendientes, getPendientesTodos } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { BREAKPOINT_DESKTOP } from '../../../lib/designSystem';
import type { DestinoPendiente, EstadoPendiente, ObraPendiente, PasoPendiente, Proyecto } from '../../../types';
import { formatoFechaHora } from '../fabricacion/utils';
import { CrearPendientesPage } from './CrearPendientesPage';
import { useUrlParam } from '../../../lib/navigation';
import { PendienteDetalleModal } from './PendienteDetalleModal';
import { PendienteLegacyModal } from './PendienteLegacyModal';
import {
  DESTINOS_PENDIENTE,
  ESTADOS_PENDIENTE,
  ETIQUETA_DESTINO,
  ETIQUETA_ESTADO,
  ETIQUETA_MOTIVO,
  ETIQUETA_PASO,
  ETIQUETA_TIPO,
  areaDe,
  codigoPendiente,
  contarPorEstado,
  esGestionableEnLote,
  referenciaPendiente,
  textoEstadoPendiente,
  textoRectificacion,
  varianteEstadoPendiente,
  type AreaPendiente,
} from './utils';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { Casilla, SelectCompacto } from '../../../components/ui/Campos';
import { PendientesLote } from './PendientesLote';
import { Buscador } from '../../../components/ui/Buscador';
import { Segmentado } from '../../../components/ui/Segmentado';
import { BotonFila } from '../../../components/ui/Lista';

interface Props {
  // Sin obra: visor central con los pendientes de todas las obras.
  proyecto?: Proyecto;
  // Visor de un área (Taller o Abastecimiento): solo sus pendientes; abrir uno lo deja «Recibido».
  area?: AreaPendiente;
  // Con `area`: la obra elegida en la lista de obras del visor (ver PendientesPage). Sus pendientes, sin columna de obra.
  obraFija?: { id: string; obra: string };
}

const PASOS_FILTRO: PasoPendiente[] = ['INGRESADO', 'RECIBIDO', 'EN_PROCESO_COMPRA', 'EN_PRODUCCION', 'LISTO_DESPACHO', 'DESPACHADO'];

// Vista agrupada de los visores de área: los pendientes que se resuelven juntos (una OC por proveedor,
// una partida) quedan uno bajo el otro y se marcan de una vez. No hay «por obra»: el visor ya está dentro de una.
type Agrupar = '' | 'proveedor' | 'partida' | 'tipo' | 'paso';
const ETIQUETA_AGRUPAR: Record<Exclude<Agrupar, ''>, string> = { proveedor: 'proveedor', partida: 'partida', tipo: 'qué falta', paso: 'paso' };
const AGRUPAR_DE_AREA: Record<AreaPendiente, Exclude<Agrupar, ''>[]> = { COMPRAS: ['proveedor', 'partida', 'paso'], FABRICA: ['tipo', 'paso'] };
const CLAVE_AGRUPAR = 'mtw-pendientes-agrupar';
function leerAgrupar(area: AreaPendiente | undefined): Agrupar {
  if (!area) return '';
  try {
    const g = localStorage.getItem(`${CLAVE_AGRUPAR}-${area}`) as Agrupar | null;
    return g && AGRUPAR_DE_AREA[area].includes(g as Exclude<Agrupar, ''>) ? g : '';
  } catch {
    return '';
  }
}


// Seccion "Control de pendientes" de una obra: lo que falta o fallo (ventanas,
// hojas, vidrios, materiales), levantado por Fabricacion o por la supervision en
// obra. Cada pendiente va a Compras o a Fabricacion, sigue sus etapas y lo
// resuelve quien lo creo. Sin `proyecto` es el visor central (Pendientes en
// obra del Sidebar): todos los pendientes de todas las obras, con su obra.
export const PendientesTab: React.FC<Props> = ({ proyecto, area, obraFija }) => {
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);
  const [estado, setEstado] = useState<EstadoPendiente | ''>('');
  const [destino, setDestino] = useState<DestinoPendiente | ''>('');
  const [texto, setTexto] = useState('');
  // Alta de pendientes: página propia (varias ventanas de la cubicación de una vez), con la URL como estado.
  const [modoNuevo, setModoNuevo] = useUrlParam('pendientes');
  // El pendiente abierto va en la URL (?pendiente=): es el enlace que llega por correo al área.
  const [abiertoId, setAbiertoId] = useUrlParam('pendiente');
  const [paso, setPaso] = useState<PasoPendiente | ''>('');
  const [obraId, setObraId] = useState('');
  const [agrupar, setAgrupar] = useState<Agrupar>(() => leerAgrupar(area));
  const [seleccionIds, setSeleccionIds] = useState<Set<string>>(new Set());
  const cambiarAgrupar = (g: Agrupar) => {
    setAgrupar(g);
    try {
      localStorage.setItem(`${CLAVE_AGRUPAR}-${area}`, g);
    } catch {
      // Sin storage: la agrupación dura lo que la página.
    }
  };
  // La obra de la lista: la pestaña de una obra (Comercial) o la elegida en el visor de un área.
  const obraDeLista = proyecto?.id ?? obraFija?.id ?? null;
  const central = !obraDeLista;
  const creando = !!proyecto && modoNuevo === 'nuevo';

  const { data, isLoading, isError } = useQuery({
    queryKey: obraDeLista ? ['pendientes', obraDeLista] : ['pendientes', 'todas'],
    queryFn: () => (obraDeLista ? getPendientes(obraDeLista) : getPendientesTodos()),
  });
  // Obras con pendientes, para filtrar el visor central.
  const obras = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const p of data ?? []) if (p.proyecto) mapa.set(p.proyecto.id, p.proyecto.obra);
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [data]);
  const todos = useMemo(() => (data ?? []).filter((p) => !area || areaDe(p.destino) === area), [data, area]);
  const abierto = abiertoId ? ((data ?? []).find((p) => p.id === abiertoId) ?? null) : null;
  const pasosArea = PASOS_FILTRO.filter((x) => !area || (area === 'FABRICA' ? x !== 'EN_PROCESO_COMPRA' : x !== 'EN_PRODUCCION'));
  const conteo = useMemo(() => contarPorEstado(todos), [todos]);

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return todos.filter((p) => {
      if (estado && p.estado !== estado) return false;
      if (destino && areaDe(p.destino) !== destino) return false;
      if (paso && p.paso !== paso) return false;
      if (obraId && p.proyectoId !== obraId) return false;
      if (!t) return true;
      return `${codigoPendiente(p.numero)} ${p.descripcion} ${referenciaPendiente(p)} ${p.proyecto?.obra ?? ''}`.toLowerCase().includes(t);
    });
  }, [todos, estado, destino, paso, texto, obraId]);
  // Grupos de la lista (uno solo, sin título, si no se agrupa), en el orden en que aparecen.
  const grupos = useMemo(() => {
    const nombre = (p: ObraPendiente) =>
      agrupar === 'proveedor' ? (p.agrupacion?.proveedor ?? 'Sin proveedor') : agrupar === 'partida' ? (p.agrupacion?.partida ?? 'Sin partida') : agrupar === 'tipo' ? ETIQUETA_TIPO[p.tipo] : agrupar === 'paso' ? (p.paso ? ETIQUETA_PASO[p.paso] : '—') : '';
    const mapa = new Map<string, ObraPendiente[]>();
    for (const p of visibles) mapa.set(nombre(p), [...(mapa.get(nombre(p)) ?? []), p]);
    const lista = [...mapa].map(([titulo, items]) => ({ titulo, items }));
    return agrupar === 'proveedor' || agrupar === 'partida' ? lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')) : lista;
  }, [visibles, agrupar]);
  // Solo se marcan los que el área todavía puede mover; la selección sigue a lo que se ve.
  const marcable = (p: ObraPendiente) => !!area && esGestionableEnLote(area, p);
  const seleccion = useMemo(() => visibles.filter((p) => seleccionIds.has(p.id) && !!area && esGestionableEnLote(area, p)), [visibles, seleccionIds, area]);
  const marcar = (ps: ObraPendiente[], si: boolean) =>
    setSeleccionIds((actual) => {
      const nueva = new Set(actual);
      for (const p of ps) if (si) nueva.add(p.id);
      else nueva.delete(p.id);
      return nueva;
    });
  // N°, pendiente, motivo, estado y solicitante; más la obra (visor central) y la casilla o el área.
  const columnas = 5 + (central ? 1 : 0) + 1;
  const codigoObra = (p: ObraPendiente) => (p.proyecto ? p.proyecto.codigoInterno || `PRJ-${p.proyecto.numeroPresupuesto}` : '');

  const filas = (p: ObraPendiente) => ({
    codigo: codigoPendiente(p.numero),
    referencia: referenciaPendiente(p),
  });

  if (creando && proyecto) return <CrearPendientesPage proyecto={proyecto} onCerrar={() => setModoNuevo(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">{obraFija ? `Pendientes de ${obraFija.obra}` : 'Pendientes'}</h2>
          <p className="text-xs text-slate-500 max-w-xl">
            {area === 'FABRICA'
              ? 'Marcos, hojas y ventanas completas por reponer en las obras. Al abrir uno queda recibido por ti; déjalo en producción con su fecha estimada o listo para despacho.'
              : area === 'COMPRAS'
                ? 'Vidrios y materiales por comprar para las obras. Al abrir uno queda recibido por ti; sube la orden de compra y márcalo recibido cuando llegue.'
                : central
                  ? 'Todos los pendientes de todas las obras: lo que falta o falló, su área y en qué paso va. Fábrica y Compras gestionan los suyos desde su menú.'
                  : 'Lo que falta o falló en esta obra. Cada pendiente va solo al área que corresponde: marcos, hojas y ventanas a Fábrica; vidrios y materiales a Compras.'}
          </p>
        </div>
        {proyecto && (
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModoNuevo('nuevo')}>
            Nuevos pendientes
          </Button>
        )}
      </div>

      {/* Resumen por estado: cada uno filtra la lista */}
      <Segmentado
        etiqueta="Filtrar por estado"
        valor={estado}
        onChange={(v) => setEstado(v === estado ? '' : v)}
        opciones={[{ value: '' as const, label: 'Todos' }, ...ESTADOS_PENDIENTE.map((e) => ({ value: e, label: ETIQUETA_ESTADO[e], contador: conteo[e] }))]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Buscador
          className="flex-1 min-w-[12rem]"
          valor={texto}
          onChange={setTexto}
          placeholder={central ? 'Buscar por obra, número, descripción o ventana…' : 'Buscar por número, descripción o ventana…'}
          etiqueta="Buscar pendientes"
        />
        {central && (
          <SelectCompacto value={obraId} onChange={(e) => setObraId(e.target.value)} aria-label="Filtrar por obra" className="max-w-[16rem]">
            <option value="">Todas las obras</option>
            {obras.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </SelectCompacto>
        )}
        {!area && (
          <SelectCompacto value={destino} onChange={(e) => setDestino(e.target.value as DestinoPendiente | '')} aria-label="Filtrar por área">
            <option value="">Todas las áreas</option>
            {DESTINOS_PENDIENTE.map((d) => (
              <option key={d} value={d}>
                {ETIQUETA_DESTINO[d]}
              </option>
            ))}
          </SelectCompacto>
        )}
        {area && (
          <SelectCompacto value={agrupar} onChange={(e) => cambiarAgrupar(e.target.value as Agrupar)} aria-label="Agrupar la lista">
            <option value="">Sin agrupar</option>
            {AGRUPAR_DE_AREA[area].map((g) => (
              <option key={g} value={g}>
                Agrupar por {ETIQUETA_AGRUPAR[g]}
              </option>
            ))}
          </SelectCompacto>
        )}
        <SelectCompacto value={paso} onChange={(e) => setPaso(e.target.value as PasoPendiente | '')} aria-label="Filtrar por paso">
          <option value="">Todos los pasos</option>
          {pasosArea.map((x) => (
            <option key={x} value={x}>
              {ETIQUETA_PASO[x]}
            </option>
          ))}
        </SelectCompacto>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          No se pudieron cargar los pendientes. Intenta de nuevo en unos minutos.
        </div>
      ) : todos.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-1">
          <ClipboardList className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">{area ? (obraFija ? 'Esta obra no tiene pendientes para esta área.' : 'No hay pendientes para esta área.') : central ? 'No hay pendientes en ninguna obra.' : 'Esta obra aún no tiene pendientes.'}</p>
          <p>{central || area ? 'Se ingresan desde Instaladores › Pendientes.' : 'Usa «Nuevos pendientes» para registrar lo que falta o falló en una ventana.'}</p>
        </div>
      ) : visibles.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs">Ningún pendiente coincide con los filtros.</div>
      ) : isDesktop ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Tabla>
            <Thead>
              <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[11px]">
                {area && (
                  <Th className="w-8">
                    <Casilla
                      aria-label="Marcar todos los que se pueden gestionar"
                      checked={visibles.some(marcable) && visibles.filter(marcable).every((p) => seleccionIds.has(p.id))}
                      disabled={!visibles.some(marcable)}
                      onChange={(si) => marcar(visibles.filter(marcable), si)}
                    />
                  </Th>
                )}
                <Th className="font-bold">N°</Th>
                {central && <Th className="font-bold">Obra</Th>}
                <Th className="font-bold">Pendiente</Th>
                <Th className="font-bold">Motivo</Th>
                {!area && <Th className="font-bold">Área</Th>}
                <Th className="font-bold">Estado</Th>
                <Th className="font-bold">Solicitante</Th>
              </Tr>
            </Thead>
            <Tbody>
              {grupos.map((g) => {
                const marcables = g.items.filter(marcable);
                return (
                  <React.Fragment key={g.titulo || 'todos'}>
                    {agrupar && (
                      <Tr className="bg-slate-50/80 hover:bg-slate-50/80">
                        <Td colSpan={columnas} className="py-2!">
                          <div className="flex items-center gap-2">
                            {marcables.length > 0 && (
                              <Casilla
                                aria-label={`Marcar los de ${g.titulo}`}
                                checked={marcables.every((p) => seleccionIds.has(p.id))}
                                onChange={(si) => marcar(marcables, si)}
                              />
                            )}
                            <span className="text-xs font-black text-slate-800">{g.titulo}</span>
                            <span className="text-[11px] text-slate-500">
                              {g.items.length} {g.items.length === 1 ? 'pendiente' : 'pendientes'}
                            </span>
                          </div>
                        </Td>
                      </Tr>
                    )}
                    {g.items.map((p) => {
                      const f = filas(p);
                      return (
                  <Tr key={p.id} onClick={() => setAbiertoId(p.id)} className="border-b border-slate-50 hover:bg-slate-50/70 cursor-pointer">
                    {area && (
                      <Td className="w-8" onClick={(e) => e.stopPropagation()}>
                        {marcable(p) && <Casilla aria-label={`Marcar ${f.codigo}`} checked={seleccionIds.has(p.id)} onChange={(si) => marcar([p], si)} />}
                      </Td>
                    )}
                    <Td className="font-mono font-bold text-slate-600 whitespace-nowrap">{f.codigo}</Td>
                    {central && (
                      <Td className="max-w-[14rem]">
                        <div className="font-semibold text-slate-800 truncate" title={p.proyecto?.obra}>
                          {p.proyecto?.obra}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{codigoObra(p)}</div>
                      </Td>
                    )}
                    <Td className="min-w-0 max-w-[26rem]">
                      <div className="font-bold text-slate-900 truncate" title={p.descripcion}>
                        <Badge size="sm" variant="outline" className="mr-1.5 align-middle">
                          {ETIQUETA_TIPO[p.tipo]}
                        </Badge>
                        {p.descripcion}
                        {!!p.cantidad && (p.tipo === 'MATERIAL' || p.cantidad > 1) && <span className="ml-1.5 text-slate-600 font-semibold">× {p.cantidad}</span>}
                        {!!p._count?.adjuntos && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-500 align-middle" title={`${p._count.adjuntos} adjunto(s)`}>
                            <Paperclip className="w-3 h-3" />
                            {p._count.adjuntos}
                          </span>
                        )}
                      </div>
                      {f.referencia && <div className="text-[11px] text-slate-500 truncate">{f.referencia}</div>}
                      {textoRectificacion(p) && <div className="text-[11px] font-bold text-brand-700 truncate">{textoRectificacion(p)}</div>}
                    </Td>
                    <Td className="text-slate-600 whitespace-nowrap">{ETIQUETA_MOTIVO[p.motivo]}</Td>
                    {!area && <Td className="text-slate-600 whitespace-nowrap">{ETIQUETA_DESTINO[p.destino]}</Td>}
                    <Td className="whitespace-nowrap">
                      <Badge size="sm" variant={varianteEstadoPendiente(p.estado, p.paso)}>
                        {textoEstadoPendiente(p)}
                      </Badge>
                    </Td>
                    <Td className="text-[11px] text-slate-500 whitespace-nowrap">
                      {p.reportadoPor?.nombre || '—'}
                      <div>{formatoFechaHora(p.fechaReporte)}</div>
                    </Td>
                  </Tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </Tbody>
          </Tabla>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100">
          {visibles.map((p) => {
            const f = filas(p);
            return (
              <BotonFila key={p.id} onClick={() => setAbiertoId(p.id)} className="px-4! py-3.5! space-y-1.5">
                {central && <p className="text-[11px] font-semibold text-slate-500 truncate">{p.proyecto?.obra} · {codigoObra(p)}</p>}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-slate-600">{f.codigo}</span>
                  <Badge size="sm" variant={varianteEstadoPendiente(p.estado, p.paso)}>
                    {textoEstadoPendiente(p)}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-900 break-words">
                  {p.descripcion}
                  {!!p._count?.adjuntos && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-500 align-middle">
                      <Paperclip className="w-3 h-3" />
                      {p._count.adjuntos}
                    </span>
                  )}
                </p>
                {f.referencia && <p className="text-[11px] text-slate-500">{f.referencia}</p>}
                {textoRectificacion(p) && <p className="text-[11px] font-bold text-brand-700">{textoRectificacion(p)}</p>}
                <p className="text-[11px] text-slate-500">
                  {ETIQUETA_TIPO[p.tipo]} · {ETIQUETA_MOTIVO[p.motivo]} · {ETIQUETA_DESTINO[p.destino]}
                </p>
              </BotonFila>
            );
          })}
        </div>
      )}

      {area && <PendientesLote area={area} seleccion={seleccion} onLimpiar={() => setSeleccionIds(new Set())} onHechos={(ids) => marcar(visibles.filter((p) => ids.includes(p.id)), false)} />}

      {/* Obra legacy: su flujo por pasos. Obra cotizada: el detalle de siempre (su gestión está en construcción). */}
      {abierto &&
        (abierto.paso ? (
          <PendienteLegacyModal proyectoId={abierto.proyectoId} pendienteId={abierto.id} desdeArea={area} onClose={() => setAbiertoId(null)} />
        ) : (
          <PendienteDetalleModal proyectoId={abierto.proyectoId} pendienteId={abierto.id} onClose={() => setAbiertoId(null)} />
        ))}
    </div>
  );
};
