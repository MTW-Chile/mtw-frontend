import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, History, Search, TrendingUp, X, LayoutDashboard } from 'lucide-react';
import { getAnuncio, getInicio } from '../../api/client';
import { usePermisos } from '../../lib/permisos';
import { useRecientes } from '../../lib/recientes';
import { navegar } from '../../lib/navigation';
import { SECCIONES_FRONTEND, entradaVisible } from '../../lib/accessControl';
import { BotonFila } from '../../components/ui/Lista';
import { Badge } from '../../components/ui/Badge';
import { Seccion } from '../../components/ui/Seccion';
import { Cargando, ErrorCarga } from '../../components/ui/Estados';
import { AnuncioBanner } from './AnuncioBanner';
import { Button } from '../../components/ui/Button';
import { useIndicadoresChile } from '../../lib/useIndicadoresChile';
import { formatNumber } from '../../lib/utils';
import { IconButton } from '../../components/ui/IconButton';
import { Input } from '../../components/ui/Input';
import { clp, uf } from '../../lib/formato';
import type { InicioData } from '../../types';

interface InicioPageProps {
  onNavigate: (tabId: string, search?: string) => void;
}

// Una linea por seccion para la grilla de Accesos (SECCIONES_FRONTEND solo trae el nombre).
const DESCRIPCION_SECCION: Record<string, string> = {
  clientes: 'Maestro de clientes.',
  proveedores: 'Proveedores y sus precios.',
  cotizaciones: 'Presupuestos en negociación.',
  proyectos: 'Obras aceptadas: abastecimiento, adicionales y estados de pago.',
  pendientes: 'Lo que falta o falló en todas las obras.',
  fabricacion: 'Cubicación, fases y requisiciones.',
  despachos: 'Ventanas fabricadas que salen a obra, con su guía de despacho.',
  instalacion: 'Recibir despachos y certificar ventanas en obra.',
  compras: 'Órdenes de compra y conciliación de facturas.',
  bodega: 'Stock, recepciones y requisiciones.',
  maestro: 'Materiales del catálogo.',
  contabilidad: 'Pronto.',
  reportes: 'Pronto.',
};

/**
 * Página de inicio: una página de trabajo armada por módulos, según el rol
 * (Configuración › Roles) y los permisos de quien entra. El buscador global
 * y el anuncio van siempre arriba; el resto lo decide GET /api/inicio. Lo que
 * espera a la persona (aprobaciones) vive en la campana del Header y en el
 * Centro de Notificaciones, no aquí.
 */
export const InicioPage: React.FC<InicioPageProps> = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: anuncio } = useQuery({ queryKey: ['anuncio'], queryFn: getAnuncio, staleTime: 60_000 });
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['inicio'], queryFn: getInicio });

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) onNavigate('cotizaciones', searchQuery.trim());
  };

  const modulo = (id: string, d: InicioData) => {
    switch (id) {
      case 'hoy':
        return <Hoy key={id} />;
      case 'obras':
        return <ObrasEnCurso key={id} obras={d.obras} />;
      case 'accesos':
        return <Accesos key={id} onNavigate={onNavigate} />;
      case 'recientes':
        return <Recientes key={id} onNavigate={onNavigate} />;
      default:
        return null;
    }
  };

  return (
    <>
      {anuncio && <AnuncioBanner texto={anuncio.texto} urgencia={anuncio.urgencia} />}
      <div className="w-full min-w-0 p-3 sm:p-5 md:p-6 xl:p-8 space-y-5 sm:space-y-6 max-w-7xl mx-auto animate-fade-in">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Input
            aria-label="Buscar en el ERP"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar obra, cliente, RUT o presupuesto HETMO…"
            leftIcon={<Search className="w-4 h-4" />}
            className="pr-24! py-3! sm:py-3.5! rounded-2xl! bg-white! text-xs sm:text-sm shadow-xs"
          />
          {searchQuery ? (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <IconButton icono={X} etiqueta="Limpiar búsqueda" onClick={() => setSearchQuery('')} />
              <Button size="sm" type="submit">Buscar</Button>
            </div>
          ) : (
            <span className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400">Presiona Enter ↵</span>
          )}
        </form>

        {isLoading ? <Cargando /> : isError || !data ? <ErrorCarga que="la página de inicio" onReintentar={refetch} /> : data.modulos.map((id) => modulo(id, data))}
      </div>
    </>
  );
};

/** Fecha, feriado e indicadores del día (misma fuente que el resto del ERP). */
const Hoy: React.FC = () => {
  const { indicadores, isErrorIndicadores, feriadoInfo } = useIndicadoresChile();
  const hoy = new Intl.DateTimeFormat('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  const filas: [string, number | null | undefined, number][] = [
    ['UF', indicadores?.uf, 2],
    ['Dólar', indicadores?.dolar, 2],
    ['Euro', indicadores?.euro, 2],
    ['UTM', indicadores?.utm, 0],
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-bold text-slate-900 capitalize flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
          {hoy}
        </p>
        {(feriadoInfo?.hoyFeriado || feriadoInfo?.proximoFeriado) && <p className="text-[11px] text-slate-500">{feriadoInfo.hoyFeriado ?? feriadoInfo.proximoFeriado}</p>}
      </div>
      <div className="lg:ml-auto flex flex-wrap items-center gap-2">
        {filas.map(([k, v, dec]) => (
          <div key={k} className="min-w-0 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</span>
            <span className="font-mono font-semibold text-xs text-slate-800 tabular-nums whitespace-nowrap">{v != null ? `$${formatNumber(v, dec)}` : '—'}</span>
          </div>
        ))}
        <span className={`flex items-center gap-1 text-[10px] font-mono ${isErrorIndicadores || indicadores?.desactualizado ? 'text-amber-700 font-semibold' : 'text-slate-400'}`} title={indicadores ? `Fuente: ${indicadores.fuente}` : undefined}>
          <TrendingUp className="w-3 h-3" />
          {isErrorIndicadores ? 'indicadores no disponibles' : indicadores ? (indicadores.desactualizado ? `último valor: ${indicadores.fecha}` : indicadores.fuente) : '…'}
        </span>
      </div>
    </div>
  );
};

const n = (v: number) => v.toLocaleString('es-CL');

const Dato: React.FC<{ etiqueta: string; valor: string; detalle?: string }> = ({ etiqueta, valor, detalle }) => (
  <div className="min-w-0 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5" title={detalle}>
    <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{etiqueta}</dt>
    <dd className="font-mono tabular-nums text-slate-800 font-semibold truncate">{valor}</dd>
  </div>
);

const Barra: React.FC<{ etiqueta: string; valor: number; total: number; color: string }> = ({ etiqueta, valor, total, color }) => {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-20 text-slate-500 shrink-0">{etiqueta}</span>
      <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-14 text-right font-mono tabular-nums text-slate-700">{total > 0 ? `${n(valor)}/${n(total)}` : '—'}</span>
    </div>
  );
};

/** Cada obra en curso con su avance físico y comercial; abre la obra en la sección que corresponde al rol. */
const ObrasEnCurso: React.FC<{ obras: InicioData['obras'] }> = ({ obras }) => {
  const { tieneAlguno } = usePermisos();
  // Comercial ve la obra desde Obras en curso; el taller, desde Fabricación.
  const seccion = tieneAlguno('estados_pago.ver', 'compras.ver', 'adicionales.ver') ? '/proyectos' : '/fabricacion';
  return (
    <Seccion icono={LayoutDashboard} titulo="Obras en curso" descripcion={obras.length ? `${n(obras.length)} obra(s) con presupuesto aceptado.` : 'Una obra aparece aquí cuando su presupuesto está aceptado por el cliente.'} acciones={<Button size="sm" variant="ghost" rightIcon={<ArrowRight className="w-3.5 h-3.5" />} onClick={() => navegar(seccion, {})}>Ver todas</Button>}>
      {obras.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {obras.map((o) => {
            const r = o.resumen;
            const cub = r?.ventanas.cubicadas ?? 0;
            return (
              <BotonFila key={o.id} sinRelleno onClick={() => navegar(seccion, { proyecto: o.id })} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-brand-600/40 hover:shadow-md transition-all text-left space-y-2.5">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 truncate">{o.obra}</span>
                    <span className="block text-xs text-slate-500 truncate">{o.clienteNombreRaw}</span>
                  </span>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-semibold">{o.codigoInterno || `PRJ-${o.numeroPresupuesto}`}</span>
                </span>
                {/* Comercial: venta, OC, cobro. */}
                <dl className="grid grid-cols-3 gap-2 text-[11px]">
                  <Dato etiqueta="Venta" valor={o.ventaTotalUF != null ? uf(o.ventaTotalUF) : '—'} />
                  <Dato etiqueta="En OC" valor={o.montoComprometidoOC ? clp(o.montoComprometidoOC) : '—'} />
                  {/* Solo con permiso de estados de pago (si no, la API manda estadosPago null). */}
                  {r?.estadosPago && <Dato etiqueta="Cobrado" valor={r.estadosPago.vigentes ? uf(r.estadosPago.netoUF) : '—'} detalle={r.estadosPago.vigentes ? `${n(r.estadosPago.vigentes)} EP · pagado ${uf(r.estadosPago.pagadoUF)}` : undefined} />}
                </dl>
                <span className="flex flex-wrap gap-1.5">
                  {o.fases.total > 0 && <Badge size="sm" variant={o.fases.enProduccion > 0 ? 'warning' : 'subtle'}>{o.fases.enProduccion}/{o.fases.total} fases en producción</Badge>}
                  {!!r?.pendientesAbiertos && <Badge size="sm" variant="warning">{n(r.pendientesAbiertos)} pend.</Badge>}
                </span>
                {/* Fabricacion: avance fisico sobre las ventanas cubicadas. */}
                <span className="block space-y-1">
                  <Barra etiqueta="Cubicadas" valor={cub} total={r?.ventanas.contratadas ?? 0} color="bg-slate-400" />
                  <Barra etiqueta="Fabricadas" valor={r?.ventanas.fabricadas ?? 0} total={cub} color="bg-sky-500" />
                  <Barra etiqueta="Despachadas" valor={r?.ventanas.despachadas ?? 0} total={cub} color="bg-violet-500" />
                  <Barra etiqueta="Instaladas" valor={r?.ventanas.instaladas ?? 0} total={cub} color="bg-emerald-500" />
                </span>
              </BotonFila>
            );
          })}
        </div>
      )}
    </Seccion>
  );
};

/** Las secciones que esta persona puede abrir. */
const Accesos: React.FC<{ onNavigate: (tabId: string) => void }> = ({ onNavigate }) => {
  const { tieneAlguno } = usePermisos();
  const secciones = SECCIONES_FRONTEND.filter((s) => s.id !== 'inicio' && s.id !== 'configuracion' && entradaVisible(s, tieneAlguno));
  return (
    <div>
      <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Accesos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {secciones.map((s) => {
          const Icono = s.icon;
          return (
            <BotonFila key={s.id} sinRelleno onClick={() => onNavigate(s.id)} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-600/40 hover:shadow-md transition-all group text-left pointer-coarse:min-h-20">
              <span className="flex items-center gap-2">
                <Icono className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="text-xs font-bold text-slate-900 group-hover:text-brand-700 truncate">{s.label}</span>
                {s.enConstruccion && <Badge size="sm" variant="subtle">Pronto</Badge>}
              </span>
              <span className="block mt-1 text-[11px] text-slate-500 line-clamp-2">{DESCRIPCION_SECCION[s.id] ?? ''}</span>
            </BotonFila>
          );
        })}
      </div>
    </div>
  );
};

/** Las últimas pantallas que abrió este usuario (lib/recientes.ts). */
const Recientes: React.FC<{ onNavigate: (tabId: string) => void }> = ({ onNavigate }) => {
  const { datos } = usePermisos();
  const recientes = useRecientes(datos?.email);
  return (
    <div>
      <div className="mb-3 px-1 flex items-center gap-2">
        <History className="w-3.5 h-3.5 text-slate-400" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Visitado recientemente</h2>
      </div>
      {recientes.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-500">
          Aquí aparecerán las últimas obras, presupuestos y secciones que abras.{' '}
          <Button variant="link" size="sm" onClick={() => onNavigate('cotizaciones')}>
            Ir a Presupuestos
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {recientes.map((r) => {
            const entrada = SECCIONES_FRONTEND.find((x) => x.id === r.seccion);
            const Icono = entrada?.icon ?? History;
            const [titulo, ...resto] = r.ruta.length ? r.ruta : [entrada?.label ?? r.seccion];
            const abrir = () => {
              const url = new URL(r.href, window.location.origin);
              navegar(url.pathname, Object.fromEntries(url.searchParams));
            };
            return (
              <BotonFila sinRelleno key={r.href + r.visitadoEn} onClick={abrir} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-brand-600/40 hover:shadow-md transition-all group text-left">
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Icono className="w-3.5 h-3.5" />
                  <span className="truncate">{entrada?.label ?? r.seccion}</span>
                  <span className="ml-auto font-medium normal-case tracking-normal">{haceCuanto(r.visitadoEn)}</span>
                </span>
                <span className="mt-2 flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-sm text-slate-900 group-hover:text-brand-700 truncate">{titulo}</span>
                  {r.codigo && r.ruta.length > 0 && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 font-mono font-bold text-slate-600">{r.codigo}</span>
                  )}
                </span>
                {resto.length > 0 && <span className="block mt-0.5 text-xs text-slate-500 truncate">{resto.join(' › ')}</span>}
              </BotonFila>
            );
          })}
        </div>
      )}
    </div>
  );
};

function haceCuanto(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
