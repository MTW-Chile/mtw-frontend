import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, Home, PackageCheck, Square } from 'lucide-react';
import { getInstalacionObra } from '../../api/client';
import { Seccion } from '../../components/ui/Seccion';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Buscador } from '../../components/ui/Buscador';
import { BotonColapsar } from '../../components/ui/BotonColapsar';
import { FiltroChips } from '../../components/ui/FiltroChips';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import { usePermisos } from '../../lib/permisos';
import { useMigas } from '../../lib/migas';
import { fecha } from '../../lib/formato';
import type { DespachoPorRecibir, EstadoVentanaObra, NodoUnidadInstalacion, VentanaObra } from '../../types';
import { CLASE_BARRA_ESTADO, CLASE_CHIP_ESTADO, ETIQUETA_ESTADO_VENTANA, ORDEN_ESTADO_VENTANA, VARIANTE_ESTADO_VENTANA, nombreVentana } from '../proyectos/obra/estadoVentana';
import { vocabulario } from '../proyectos/cubicacion/vocabulario';
import { RecibirDespachoModal } from './RecibirDespachoModal';
import { VentanaInstalacionModal } from './VentanaInstalacionModal';

type FiltroEstado = 'TODAS' | 'POR_RECIBIR' | 'POR_INSTALAR' | 'INSTALADAS' | 'CON_PENDIENTE';

const pasaFiltro = (v: VentanaObra, f: FiltroEstado, q: string): boolean => {
  if (q && !`${nombreVentana(v)} ${v.sistema} ${v.ubicacion ?? ''} ${v.nombreUnidad ?? ''}`.toLowerCase().includes(q)) return false;
  switch (f) {
    case 'POR_RECIBIR':
      return v.estado === 'DESPACHADA';
    case 'POR_INSTALAR':
      return v.estado === 'RECIBIDA';
    case 'INSTALADAS':
      return v.estado === 'INSTALADA';
    case 'CON_PENDIENTE':
      return v.pendientesAbiertos > 0;
    default:
      return true;
  }
};

// Chip de una ventana: el color dice el estado de un vistazo; tocarla abre su ficha.
const ChipVentana: React.FC<{ v: VentanaObra; onClick: () => void }> = ({ v, onClick }) => (
  // eslint-disable-next-line react/forbid-elements -- chip táctil propio del plano (mínimo 44 px de alto en móvil)
  <button
    type="button"
    onClick={onClick}
    title={`${nombreVentana(v)} · ${v.sistema} · ${ETIQUETA_ESTADO_VENTANA[v.estado]}`}
    className={`relative inline-flex min-h-11 sm:min-h-8 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-mono font-bold leading-tight transition-colors hover:brightness-95 active:scale-[0.98] cursor-pointer ${CLASE_CHIP_ESTADO[v.estado]}`}
  >
    {v.estado === 'INSTALADA' ? '✓ ' : ''}
    {nombreVentana(v)}
    {v.separada && <span className="font-sans font-normal text-[10px] opacity-80">½</span>}
    {v.pendientesAbiertos > 0 && <AlertTriangle className="w-3 h-3 text-amber-600" aria-label="Con pendiente" />}
  </button>
);

const TarjetaUnidad: React.FC<{ nodo: NodoUnidadInstalacion; ventanas: VentanaObra[]; etiqueta: string; onVentana: (id: string) => void }> = ({ nodo, ventanas, etiqueta, onVentana }) => {
  if (ventanas.length === 0) return null;
  const instaladas = ventanas.filter((v) => v.estado === 'INSTALADA').length;
  const completa = instaladas === ventanas.length;
  return (
    <div className={`rounded-xl border p-2.5 space-y-1.5 ${completa ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-900 truncate">
          <span className="text-[10px] font-normal uppercase tracking-wider text-slate-400 mr-1">{etiqueta}</span>
          {nodo.nombre}
        </p>
        <span className={`text-[10px] font-mono tabular-nums ${completa ? 'text-emerald-700' : 'text-slate-500'}`}>
          {instaladas}/{ventanas.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ventanas.map((v) => (
          <ChipVentana key={v.id} v={v} onClick={() => onVentana(v.id)} />
        ))}
      </div>
    </div>
  );
};

/**
 * Instalación de una obra: la cubicación del edificio (torre → piso →
 * departamento) con cada ventana coloreada por su estado. Arriba, los despachos
 * que la obra todavía tiene que recibir. Diseñado para el celular del
 * supervisor: una columna, chips táctiles, filtros como chips/selector.
 */
export const InstalacionObra: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const { tiene } = usePermisos();
  const [filtro, setFiltro] = useState<FiltroEstado>('TODAS');
  const [busqueda, setBusqueda] = useState('');
  const [ventanaAbierta, setVentanaAbierta] = useState<string | null>(null);
  const [recibiendo, setRecibiendo] = useState<DespachoPorRecibir | null>(null);
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['instalacion', proyectoId], queryFn: () => getInstalacionObra(proyectoId) });
  useMigas(1, [{ label: data?.proyecto?.obra ?? 'Obra', codigo: data?.proyecto?.codigoInterno ?? undefined }]);

  const q = busqueda.trim().toLowerCase();
  const voc = vocabulario(data?.modo);
  const Icono = data?.modo === 'CASA' ? Home : Building2;

  const resumenChips = useMemo(() => {
    if (!data) return [];
    const r = data.resumen;
    return [
      { id: 'TODAS' as FiltroEstado, label: 'Todas', total: r.total },
      { id: 'POR_RECIBIR' as FiltroEstado, label: 'Por recibir', total: r.DESPACHADA },
      { id: 'POR_INSTALAR' as FiltroEstado, label: 'Por instalar', total: r.RECIBIDA },
      { id: 'INSTALADAS' as FiltroEstado, label: 'Instaladas', total: r.INSTALADA },
      { id: 'CON_PENDIENTE' as FiltroEstado, label: 'Con pendiente', total: r.conPendiente },
    ];
  }, [data]);

  const alternarPiso = (id: string) =>
    setCerrados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  if (isLoading) return <Cargando texto="Leyendo la cubicación de la obra…" />;
  if (isError || !data) return <ErrorCarga que="la obra" onReintentar={refetch} />;

  const filtrar = (vs: VentanaObra[]) => vs.filter((v) => pasaFiltro(v, filtro, q));
  const pct = data.resumen.total ? Math.round((data.resumen.INSTALADA / data.resumen.total) * 100) : 0;
  const hayEstructura = data.torres.some((t) => t.pisos.length || t.especiales.length) || data.unica.length > 0 || data.areasComunes.length > 0;

  return (
    <div className="space-y-4">
      {/* Avance */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            <b className="text-slate-900 text-base tabular-nums">{data.resumen.INSTALADA}</b> de {data.resumen.total} ventanas instaladas
          </p>
          <span className="text-sm font-black text-emerald-700 tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-label="Avance de instalación">
          {ORDEN_ESTADO_VENTANA.filter((e) => data.resumen[e] > 0 && e !== 'SIN_POSICION')
            .reverse()
            .map((e) => (
              <span key={e} className={`h-full ${CLASE_BARRA_ESTADO[e]}`} style={{ width: `${(data.resumen[e] / data.resumen.total) * 100}%` }} title={`${ETIQUETA_ESTADO_VENTANA[e]}: ${data.resumen[e]}`} />
            ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ORDEN_ESTADO_VENTANA.filter((e) => data.resumen[e] > 0).map((e: EstadoVentanaObra) => (
            <Badge key={e} size="sm" variant={VARIANTE_ESTADO_VENTANA[e]}>
              {ETIQUETA_ESTADO_VENTANA[e]} {data.resumen[e]}
            </Badge>
          ))}
        </div>
      </div>

      {/* Despachos por recibir */}
      {data.despachosPorRecibir.length > 0 && (
        <Seccion icono={PackageCheck} titulo="Por recibir en obra" descripcion="Despachos emitidos por fábrica. Confirma lo que llegó." sinRelleno>
          <ul className="divide-y divide-slate-100">
            {data.despachosPorRecibir.map((d) => (
              <li key={d.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900">
                    <span className="font-mono">{d.codigo}</span>
                    {d.fase ? ` · Fase ${d.fase.numeroFase} ${d.fase.nombre}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {d.itemsPendientes} de {d.totalItems} ítem(s) por recibir{d.fechaDespacho ? ` · despachado ${fecha(d.fechaDespacho)}` : ''}
                    {d.numeroGuia ? ` · guía N° ${d.numeroGuia}` : ''}
                    {d.transportista ? ` · ${d.transportista}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.bsaleUrlPdf && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(d.bsaleUrlPdf!, '_blank', 'noopener')}>
                      Guía
                    </Button>
                  )}
                  {tiene('instalacion.recibir') && (
                    <Button size="sm" variant="primary" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => setRecibiendo(d)}>
                      Recibir
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <FiltroChips etiqueta="Filtrar ventanas" opciones={resumenChips} valor={filtro} onChange={setFiltro} />
        </div>
        <div className="sm:w-64">
          <Buscador compacto valor={busqueda} onChange={setBusqueda} placeholder="Buscar ventana…" etiqueta="Buscar ventana" />
        </div>
      </div>

      {!hayEstructura ? (
        <EstadoVacio icono={Square} titulo="Esta obra todavía no está cubicada" descripcion="Cuando Fabricación cargue la cubicación (torres, pisos y departamentos) aparecerán aquí las ventanas." />
      ) : (
        <div className="space-y-4">
          {data.torres.map((torre) => {
            const ventanasTorre = [...torre.pisos.flatMap((p) => p.unidades.flatMap((u) => u.ventanas)), ...torre.especiales.flatMap((u) => u.ventanas)];
            const visibles = filtrar(ventanasTorre);
            if (visibles.length === 0 && (filtro !== 'TODAS' || q)) return null;
            const instaladas = ventanasTorre.filter((v) => v.estado === 'INSTALADA').length;
            return (
              <Seccion
                key={torre.id}
                icono={Icono}
                titulo={voc.textoTorre(torre.nombre)}
                descripcion={`${instaladas}/${ventanasTorre.length} instaladas · ${torre.pisos.length} piso(s)`}
                sinRelleno
              >
                {torre.especiales.length > 0 && (
                  <div className="px-4 py-3 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {torre.especiales.map((u) => (
                      <TarjetaUnidad key={u.id} nodo={u} ventanas={filtrar(u.ventanas)} etiqueta="" onVentana={setVentanaAbierta} />
                    ))}
                  </div>
                )}
                <div className="divide-y divide-slate-100">
                  {[...torre.pisos].reverse().map((piso) => {
                    const delPiso = piso.unidades.flatMap((u) => u.ventanas);
                    const visiblesPiso = filtrar(delPiso);
                    if (visiblesPiso.length === 0 && (filtro !== 'TODAS' || q)) return null;
                    const inst = delPiso.filter((v) => v.estado === 'INSTALADA').length;
                    const cerrado = cerrados.has(piso.id);
                    return (
                      <div key={piso.id} className="px-3 py-2">
                        <BotonColapsar abierto={!cerrado} onClick={() => alternarPiso(piso.id)} className="w-full">
                          <span className="flex items-center justify-between gap-2 flex-1 text-left">
                            <span className="text-xs font-bold text-slate-800">Piso {piso.numero}</span>
                            <span className={`text-[11px] font-mono tabular-nums ${inst === delPiso.length && delPiso.length > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {inst}/{delPiso.length}
                            </span>
                          </span>
                        </BotonColapsar>
                        {!cerrado && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            {piso.unidades.map((u) => (
                              <TarjetaUnidad key={u.id} nodo={u} ventanas={filtrar(u.ventanas)} etiqueta={voc.unidadCorta} onVentana={setVentanaAbierta} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Seccion>
            );
          })}

          {filtrar(data.unica).length > 0 && (
            <Seccion titulo="Cubicación única" descripcion="Ventanas con nomenclatura sin torre ni piso." >
              <div className="flex flex-wrap gap-1.5">
                {filtrar(data.unica).map((v) => (
                  <ChipVentana key={v.id} v={v} onClick={() => setVentanaAbierta(v.id)} />
                ))}
              </div>
            </Seccion>
          )}
          {filtrar(data.areasComunes).length > 0 && (
            <Seccion titulo="Áreas comunes" descripcion="Cada ítem representa varias piezas (muro cortina, antifuego, film…).">
              <div className="flex flex-wrap gap-1.5">
                {filtrar(data.areasComunes).map((v) => (
                  <ChipVentana key={v.id} v={v} onClick={() => setVentanaAbierta(v.id)} />
                ))}
              </div>
            </Seccion>
          )}
          {data.sinPosicion > 0 && <p className="text-[11px] text-slate-400">{data.sinPosicion} ventana(s) contratadas aún sin posición en la cubicación (no se muestran).</p>}
        </div>
      )}

      {recibiendo && <RecibirDespachoModal proyectoId={proyectoId} despacho={recibiendo} onClose={() => setRecibiendo(null)} />}
      {ventanaAbierta && <VentanaInstalacionModal proyectoId={proyectoId} ventanaId={ventanaAbierta} despachosPorRecibir={data.despachosPorRecibir} onClose={() => setVentanaAbierta(null)} />}
    </div>
  );
};
