import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ChevronDown, ChevronRight, Loader2, PackageCheck, Send, Undo2 } from 'lucide-react';
import { generarReservasObra, getReservasObra, updateOrdenCompraEstado } from '../../../api/client';
import type { EstadoOC, ReservaOC } from '../../../types';
import { Badge, type BadgeVariant } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Cargando, ErrorCarga, EstadoVacio } from '../../../components/ui/Estados';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { usePermisos } from '../../../lib/permisos';
import { mostrarToast } from '../../../lib/toast';
import { formatNumber } from '../../../lib/utils';
import { BotonFila } from '../../../components/ui/Lista';

/**
 * Reserva de materiales de una obra: al aceptar el cliente se reservan todos
 * los materiales del presupuesto con los precios cotizados, en una OC de
 * reserva por partida y proveedor. Cada precio va en su divisa de origen.
 * El saldo es lo reservado menos lo ya comprado para la obra.
 *
 * Pendiente: cambiar el proveedor de una reserva y registrar la respuesta del
 * proveedor (recepción de vuelta de la reserva).
 */

const ESTADO_RESERVA: Partial<Record<EstadoOC, { label: string; variant: BadgeVariant }>> = {
  BORRADOR: { label: 'Por enviar', variant: 'warning' },
  ENVIADA: { label: 'Enviada al proveedor', variant: 'brand' },
};

/** Monto en su divisa: pesos sin decimales, el resto con dos. */
function formatoMontoDivisa(valor: number, moneda: string): string {
  if (moneda === 'CLP') return `$ ${formatNumber(valor, 0)}`;
  return `${moneda} ${formatNumber(valor, 2)}`;
}

const TotalesDivisa: React.FC<{ totales: Record<string, number>; className?: string }> = ({ totales, className = '' }) => {
  const entradas = Object.entries(totales).filter(([, v]) => v !== 0);
  if (entradas.length === 0) return <span className={`text-slate-500 ${className}`}>Sin precio</span>;
  return (
    <span className={`tabular-nums ${className}`}>
      {entradas.map(([moneda, valor], i) => (
        <React.Fragment key={moneda}>
          {i > 0 && <span className="text-slate-500"> + </span>}
          {formatoMontoDivisa(valor, moneda)}
        </React.Fragment>
      ))}
    </span>
  );
};

const cantidad = (v: number) => formatNumber(v, Number.isInteger(v) ? 0 : 2);

const DetalleReserva: React.FC<{ reserva: ReservaOC }> = ({ reserva }) => (
  <>
    {/* Celular: una tarjeta por material. */}
    <ul className="md:hidden divide-y divide-slate-100">
      {reserva.items.map((i) => (
        <li key={i.id} className="py-2.5 space-y-1">
          <p className="text-xs font-semibold text-slate-800">{i.descripcion}</p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <span>
              <span className="block text-slate-500">Reservado</span>
              <span className="tabular-nums font-semibold">
                {cantidad(i.cantidad)} {i.unidadMedida}
              </span>
            </span>
            <span>
              <span className="block text-slate-500">Comprado</span>
              <span className="tabular-nums">{cantidad(i.comprado)}</span>
            </span>
            <span>
              <span className="block text-slate-500">Saldo</span>
              <span className={`tabular-nums font-bold ${i.saldo > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>{cantidad(i.saldo)}</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {formatoMontoDivisa(i.precioUnitario, i.moneda)} por {i.unidadMedida.toLowerCase()} · total {formatoMontoDivisa(i.precioUnitario * i.cantidad, i.moneda)}
          </p>
        </li>
      ))}
    </ul>
    <div className="hidden md:block">
      <Tabla ajustada>
        <Thead>
          <Th>Material</Th>
          <Th alinear="derecha">Reservado</Th>
          <Th alinear="derecha">Comprado</Th>
          <Th alinear="derecha">Saldo</Th>
          <Th alinear="derecha">Precio cotizado</Th>
          <Th alinear="derecha">Total</Th>
        </Thead>
        <Tbody>
          {reserva.items.map((i) => (
            <Tr key={i.id} tono={i.saldo <= 0 ? 'atenuada' : undefined}>
              <Td>{i.descripcion}</Td>
              <Td alinear="derecha" numero>
                {cantidad(i.cantidad)} <span className="text-slate-500">{i.unidadMedida}</span>
              </Td>
              <Td alinear="derecha" numero>
                {cantidad(i.comprado)}
              </Td>
              <Td alinear="derecha" numero fuerte>
                {cantidad(i.saldo)}
              </Td>
              <Td alinear="derecha" numero>
                {formatoMontoDivisa(i.precioUnitario, i.moneda)}
              </Td>
              <Td alinear="derecha" numero>
                {formatoMontoDivisa(i.precioUnitario * i.cantidad, i.moneda)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Tabla>
    </div>
  </>
);

export const ReservaMaterialesSection: React.FC<{ proyectoId: string }> = ({ proyectoId }) => {
  const { tiene } = usePermisos();
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reservasObra', proyectoId],
    queryFn: () => getReservasObra(proyectoId),
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['reservasObra', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['reservasResumen', proyectoId] });
  };

  const generar = useMutation({
    mutationFn: () => generarReservasObra(proyectoId),
    onSuccess: (r) => {
      mostrarToast(r.creadas.length ? `Se generaron ${r.creadas.length} reservas (${r.creadas.map((c) => c.numero).join(', ')}).` : 'No quedaba nada por reservar.', { tipo: 'info' });
      refrescar();
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoOC }) => updateOrdenCompraEstado(id, estado),
    onSuccess: refrescar,
  });

  // Agrupadas por partida, en el orden en que llegan (el de la Analítica).
  const porPartida = useMemo(() => {
    const grupos = new Map<string, { nombre: string; reservas: ReservaOC[] }>();
    for (const r of data?.reservas ?? []) {
      const clave = r.partida?.codigo ?? '';
      const g = grupos.get(clave) ?? { nombre: r.partida?.nombre ?? 'Sin partida', reservas: [] };
      g.reservas.push(r);
      grupos.set(clave, g);
    }
    return [...grupos.values()];
  }, [data]);

  if (isLoading) return <Cargando texto="Calculando los materiales de la obra…" />;
  if (isError || !data) return <ErrorCarga que="la reserva de materiales" onReintentar={refetch} />;
  if (!data.aceptada) {
    return (
      <EstadoVacio
        enTarjeta
        icono={PackageCheck}
        titulo="La obra todavía no tiene un presupuesto aceptado por el cliente"
        descripcion="Los materiales se reservan con los precios del presupuesto que aceptó el cliente."
      />
    );
  }

  const puedeEmitir = tiene('compras.oc.emitir');
  const puedeAnular = tiene('compras.oc.anular');
  const ocupado = cambiarEstado.isPending;

  const pedirGenerar = async () => {
    const ok = await confirmar({
      titulo: `¿Generar ${data.porGenerar.length} ${data.porGenerar.length === 1 ? 'reserva' : 'reservas'}?`,
      mensaje: 'Se crea una OC de reserva por partida y proveedor, con las cantidades y los precios cotizados del presupuesto aceptado.',
      confirmar: 'Generar reservas',
    });
    if (ok) generar.mutate();
  };

  const pedirEstado = async (r: ReservaOC, estado: EstadoOC) => {
    if (estado === 'CANCELADA') {
      const ok = await confirmar({
        titulo: `¿Anular la reserva ${r.numero}?`,
        mensaje: 'Sus materiales vuelven a quedar por reservar y se puede generar de nuevo.',
        confirmar: 'Anular reserva',
        peligro: true,
      });
      if (!ok) return;
    }
    cambiarEstado.mutate({ id: r.id, estado });
  };

  const alternar = (id: string) =>
    setAbiertas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-600 max-w-3xl">
        Materiales del presupuesto aceptado (versión {data.version?.versionNumero}), en una reserva por partida y proveedor. Cada precio es el cotizado, en su divisa de
        origen. El saldo baja a medida que se compra para la obra.
      </p>

      {data.porGenerar.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-amber-950">{data.reservas.length ? 'Faltan materiales por reservar' : 'Los materiales de esta obra no se han reservado'}</h3>
              <p className="text-xs text-amber-900">
                {data.porGenerar.length} {data.porGenerar.length === 1 ? 'reserva' : 'reservas'} por generar.
              </p>
            </div>
            {puedeEmitir ? (
              <Button size="sm" onClick={pedirGenerar} disabled={generar.isPending}>
                {generar.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5 mr-1.5" />}
                Generar reservas ({data.porGenerar.length})
              </Button>
            ) : (
              <span className="text-[11px] text-amber-900">Las genera alguien con permiso para emitir OC.</span>
            )}
          </div>
          <ul className="divide-y divide-amber-200 text-xs">
            {data.porGenerar.map((g) => (
              <li key={`${g.partida.codigo}|${g.proveedor?.id ?? ''}`} className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                <span>
                  <span className="font-semibold text-amber-950">{g.partida.nombre}</span>
                  <span className="text-amber-900"> · {g.proveedor?.nombre ?? 'Sin proveedor asignado'} · {g.materiales} materiales</span>
                </span>
                <TotalesDivisa totales={g.totales} className="text-amber-950 font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.reservas.length === 0 && data.porGenerar.length === 0 && (
        <EstadoVacio enTarjeta icono={PackageCheck} titulo="No hay materiales que reservar" descripcion="El presupuesto aceptado no tiene materiales con cantidad." />
      )}

      {porPartida.map((g) => (
        <section key={g.nombre} className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.nombre}</h3>
          {g.reservas.map((r) => {
            const abierta = abiertas.has(r.id);
            const estado = ESTADO_RESERVA[r.estado];
            const completos = r.items.filter((i) => i.saldo <= 0).length;
            return (
              <article key={r.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
                  <BotonFila
                    sinRelleno
                    onClick={() => alternar(r.id)}
                    title={abierta ? 'Ocultar los materiales' : 'Ver los materiales'}
                    className="flex! items-center gap-2 min-w-0 flex-1 w-auto! pointer-coarse:min-h-11"
                  >
                    {abierta ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{r.proveedor?.nombre ?? 'Sin proveedor asignado'}</span>
                        {estado && <Badge variant={estado.variant}>{estado.label}</Badge>}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {r.numero} · {r.items.length} materiales · {completos} comprados por completo
                      </span>
                    </span>
                  </BotonFila>
                  <TotalesDivisa totales={r.totales} className="text-sm font-bold text-slate-900" />
                  <div className="flex items-center gap-2">
                    {puedeEmitir && r.estado === 'BORRADOR' && (
                      <Button size="sm" variant="outline" onClick={() => pedirEstado(r, 'ENVIADA')} disabled={ocupado} title="Marcar que la reserva ya se envió al proveedor">
                        <Send className="w-3.5 h-3.5 mr-1.5" /> Marcar enviada
                      </Button>
                    )}
                    {puedeEmitir && r.estado === 'ENVIADA' && (
                      <Button size="sm" variant="ghost" onClick={() => pedirEstado(r, 'BORRADOR')} disabled={ocupado} title="Se marcó enviada por error">
                        <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Volver a por enviar
                      </Button>
                    )}
                    {puedeAnular && r.estado === 'BORRADOR' && (
                      <Button size="sm" variant="ghost" onClick={() => pedirEstado(r, 'CANCELADA')} disabled={ocupado} title="Anular la reserva">
                        <Ban className="w-3.5 h-3.5 mr-1.5" /> Anular
                      </Button>
                    )}
                  </div>
                </div>
                {abierta && (
                  <div className="border-t border-slate-100 px-3 sm:px-4 pb-3">
                    <DetalleReserva reserva={r} />
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
};
