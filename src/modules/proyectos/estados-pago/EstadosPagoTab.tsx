import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Receipt, SlidersHorizontal } from 'lucide-react';
import { getConfiguracionCobro, getEstadosPago } from '../../../api/client';
import { Seccion } from '../../../components/ui/Seccion';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { StatCard } from '../../../components/ui/StatCard';
import { Lista, FilaLista } from '../../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../../components/ui/Estados';
import { usePermisos } from '../../../lib/permisos';
import { useMigas } from '../../../lib/migas';
import { fecha, porcentaje, uf } from '../../../lib/formato';
import type { Proyecto } from '../../../types';
import { HITOS_COBRO } from '../../../types';
import { ETIQUETA_ESTADO_PAGO, ETIQUETA_HITO_CORTA, VARIANTE_ESTADO_PAGO } from '../obra/estadoVentana';
import { NuevoEstadoPagoModal } from './NuevoEstadoPagoModal';
import { EstadoPagoDetalleModal } from './EstadoPagoDetalleModal';
import { ConfiguracionCobroModal } from './ConfiguracionCobroModal';

const CAMPO_HITO = { MARCO: 'pctMarco', HOJA: 'pctHoja', R1: 'pctR1', RF: 'pctRF' } as const;

/**
 * Comercial: estados de pago de la obra. Cada ventana se cobra por hitos
 * (marco, hoja con vidrio, R1, RF) con los porcentajes, anticipo y retención
 * configurados para la obra; además adicionales aceptados e ítems libres.
 */
export const EstadosPagoTab: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const { tiene } = usePermisos();
  const [creando, setCreando] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  useMigas(2, [abierto ? { label: 'Estado de pago' } : null]);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['estadosPago', proyecto.id], queryFn: () => getEstadosPago(proyecto.id) });
  const { data: cobro } = useQuery({ queryKey: ['configuracionCobro', proyecto.id], queryFn: () => getConfiguracionCobro(proyecto.id) });
  const vigentes = (data ?? []).filter((e) => e.estado !== 'ANULADO');
  const suma = (filtro: (e: (typeof vigentes)[number]) => boolean) => vigentes.filter(filtro).reduce((s, e) => s + Number(e.totales.montoNetoUF), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Presentado" value={uf(suma((e) => e.estado === 'PRESENTADO'))} icon={Receipt} subtitle="Esperando al cliente" />
        <StatCard title="Aprobado" value={uf(suma((e) => e.estado === 'APROBADO'))} icon={Receipt} subtitle="Por facturar" iconColor="text-sky-600" iconBgColor="bg-sky-50 border-sky-100" />
        <StatCard title="Facturado" value={uf(suma((e) => e.estado === 'FACTURADO'))} icon={Receipt} subtitle="Por cobrar" iconColor="text-violet-600" iconBgColor="bg-violet-50 border-violet-100" />
        <StatCard title="Pagado" value={uf(suma((e) => e.estado === 'PAGADO'))} icon={Receipt} subtitle="Cobrado" iconColor="text-emerald-600" iconBgColor="bg-emerald-50 border-emerald-100" />
      </div>

      <Seccion
        icono={SlidersHorizontal}
        titulo="Configuración de cobro"
        descripcion={cobro?.personalizada ? 'Hitos, anticipo y retención pactados para esta obra.' : 'La obra usa los valores por defecto de Configuración › Comercial.'}
        acciones={
          tiene('estados_pago.editar') &&
          cobro && (
            <Button size="sm" variant="outline" onClick={() => setConfigurando(true)}>
              Configurar
            </Button>
          )
        }
      >
        {cobro ? (
          <dl className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
            {[
              ...HITOS_COBRO.map((h) => [ETIQUETA_HITO_CORTA[h], porcentaje(cobro[CAMPO_HITO[h]], 0)] as const),
              ['Anticipo', porcentaje(cobro.anticipoPct, 1)] as const,
              ['Retención', porcentaje(cobro.retencionPct, 1)] as const,
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k}</dt>
                <dd className="font-mono tabular-nums text-slate-800 font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Cargando />
        )}
      </Seccion>

      <Seccion
        icono={Receipt}
        titulo="Estados de pago"
        descripcion="Cada estado de pago cobra los hitos disponibles de las ventanas (por fase o sueltas) y los adicionales aceptados. Montos en UF al precio congelado del presupuesto."
        sinRelleno
        acciones={
          tiene('estados_pago.editar') && (
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreando(true)}>
              Nuevo estado de pago
            </Button>
          )
        }
      >
        {isLoading ? (
          <div className="p-5">
            <Cargando />
          </div>
        ) : isError ? (
          <div className="p-5">
            <ErrorCarga que="los estados de pago" onReintentar={refetch} />
          </div>
        ) : (data ?? []).length === 0 ? (
          <EstadoVacio enTarjeta={false} icono={Receipt} titulo="Todavía no hay estados de pago" descripcion="Arma el primero con los marcos u hojas ya instalados." />
        ) : (
          <Lista>
            {(data ?? []).map((e) => (
              <FilaLista
                key={e.id}
                titulo={
                  <>
                    <span className="font-mono">{e.codigo}</span> · {e.titulo}
                  </>
                }
                insignias={<Badge size="sm" variant={VARIANTE_ESTADO_PAGO[e.estado]}>{ETIQUETA_ESTADO_PAGO[e.estado]}</Badge>}
                atenuada={e.estado === 'ANULADO'}
                acciones={
                  <Button size="sm" variant="ghost" rightIcon={<ChevronRight className="w-3.5 h-3.5" />} onClick={() => setAbierto(e.id)}>
                    Ver
                  </Button>
                }
              >
                <p>
                  <span className="font-mono tabular-nums text-slate-700 font-semibold">{uf(e.totales.montoNetoUF)}</span> neto · {e._count.items} ítem(s)
                  {e.fechaPresentacion ? ` · presentado ${fecha(e.fechaPresentacion)}` : ''}
                  {e.fechaFactura ? ` · factura ${fecha(e.fechaFactura)}` : ''}
                </p>
              </FilaLista>
            ))}
          </Lista>
        )}
      </Seccion>

      {configurando && cobro && <ConfiguracionCobroModal proyecto={proyecto} actual={cobro} onClose={() => setConfigurando(false)} />}
      {creando && (
        <NuevoEstadoPagoModal
          proyecto={proyecto}
          onClose={() => setCreando(false)}
          onGuardado={(id) => {
            setCreando(false);
            setAbierto(id);
          }}
        />
      )}
      {abierto && <EstadoPagoDetalleModal proyecto={proyecto} estadoPagoId={abierto} onClose={() => setAbierto(null)} />}
    </div>
  );
};
