import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Warehouse } from 'lucide-react';
import { getBodegaGlobal } from '../../api/client';
import { useUrlParam } from '../../lib/navigation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { BREAKPOINT_DESKTOP, TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../lib/designSystem';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { formatNumber } from '../../lib/utils';
import type { Bodega, TipoMovimientoBodega } from '../../types';

const nombreAsociado = (b: Bodega) => b.proyecto?.obra || b.centroCosto?.nombre || '—';

const TIPO_MOVIMIENTO: Record<TipoMovimientoBodega, string> = {
  INGRESO_OC: 'Ingreso por OC',
  SALIDA_OBRA: 'Salida a obra',
  TRASLADO_ENTRADA: 'Traslado (entrada)',
  TRASLADO_SALIDA: 'Traslado (salida)',
  AJUSTE_POSITIVO: 'Ajuste (+)',
  AJUSTE_NEGATIVO: 'Ajuste (−)',
};

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

// Tabla con el mismo formato que el resto de los listados de la app.
const Tabla: React.FC<{ cabeceras: { label: string; className?: string }[]; children: React.ReactNode }> = ({ cabeceras, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
    <div className={TABLE_WRAPPER_CLASS}>
      <table className={TABLE_CLASS + ' text-left text-slate-700'}>
        <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
          <tr>
            {cabeceras.map((c) => (
              <th key={c.label} className={`px-5 py-3.5 ${c.className ?? ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  </div>
);

const VaciaTabla: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">{texto}</div>
);

/**
 * Bodegas Disponibles: lista de bodegas (obra o centro de costo). Al abrir
 * una, muestra su Stock Actual y sus Movimientos Recientes. La bodega
 * abierta vive en la URL (?bodega=<id>) para que Atrás y F5 funcionen.
 */
export const BodegasDisponiblesSection: React.FC = () => {
  // Mismo queryKey que la vista de stock del módulo: sale del cache, no pega de nuevo.
  const { data, isLoading } = useQuery({ queryKey: ['bodegaGlobal'], queryFn: getBodegaGlobal });
  const [bodegaId, setBodegaId] = useUrlParam('bodega');
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  const bodegas = data?.bodegas ?? [];
  const bodegaActiva = bodegaId ? bodegas.find((b) => b.id === bodegaId) : undefined;

  // Stock y movimientos de cada bodega, calculados una sola vez.
  const stockPorBodega = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const s of data?.stock ?? []) mapa.set(s.bodegaId, (mapa.get(s.bodegaId) ?? 0) + 1);
    return mapa;
  }, [data]);

  if (isLoading) return <Loader block size="lg" />;

  if (!bodegaActiva) {
    return bodegas.length === 0 ? (
      <VaciaTabla texto="Todavía no hay bodegas. Se crean solas con la primera recepción de una Orden de Compra." />
    ) : (
      isDesktop ? (
      <Tabla
        cabeceras={[
          { label: 'Bodega' },
          { label: 'Asociada a' },
          { label: 'Materiales en stock', className: 'text-right' },
          { label: 'Estado', className: 'text-right' },
        ]}
      >
        {bodegas.map((b) => (
          <tr
            key={b.id}
            onClick={() => setBodegaId(b.id)}
            className="bg-white border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <td className="px-5 py-3.5 font-semibold text-slate-900">{b.nombre}</td>
            <td className="px-5 py-3.5 text-slate-600">{nombreAsociado(b)}</td>
            <td className="px-5 py-3.5 text-right font-mono text-slate-900">{stockPorBodega.get(b.id) ?? 0}</td>
            <td className="px-5 py-3.5 text-right">
              <Badge size="sm" variant={b.activa ? 'success' : 'default'}>
                {b.activa ? 'Activa' : 'Inactiva'}
              </Badge>
            </td>
          </tr>
        ))}
      </Tabla>
      ) : (
      <div className="space-y-2">
        {bodegas.map((b) => (
          <button
            key={b.id}
            onClick={() => setBodegaId(b.id)}
            className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="text-sm font-bold text-slate-900 truncate">{b.nombre}</div>
              <div className="text-xs text-slate-500 truncate">{nombreAsociado(b)}</div>
              <div className="text-xs text-slate-500">{stockPorBodega.get(b.id) ?? 0} materiales en stock</div>
            </div>
            <Badge size="sm" variant={b.activa ? 'success' : 'default'} className="shrink-0">
              {b.activa ? 'Activa' : 'Inactiva'}
            </Badge>
          </button>
        ))}
      </div>
      )
    );
  }

  const stock = (data?.stock ?? []).filter((s) => s.bodegaId === bodegaActiva.id);
  const movimientos = (data?.movimientos ?? []).filter((m) => m.bodegaId === bodegaActiva.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setBodegaId(null)}>
          Bodegas
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Warehouse className="w-4 h-4 text-brand-600 shrink-0" />
          <h2 className="text-sm font-extrabold text-slate-900 truncate">{bodegaActiva.nombre}</h2>
          <span className="text-xs text-slate-500 truncate">· {nombreAsociado(bodegaActiva)}</span>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Stock actual</h3>
        {stock.length === 0 ? (
          <VaciaTabla texto="Esta bodega no tiene stock." />
        ) : (
          <Tabla
            cabeceras={[
              { label: 'SKU' },
              { label: 'Material' },
              { label: 'Partida' },
              { label: 'Cantidad', className: 'text-right' },
            ]}
          >
            {stock.map((s) => (
              <tr key={s.id} className="bg-white border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.material.skuInterno}</td>
                <td className="px-4 py-2.5 text-slate-900">{s.material.descripcion}</td>
                <td className="px-4 py-2.5 text-slate-600">{s.material.tipoProducto?.partida?.nombre ?? s.material.familia}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                  {formatNumber(s.cantidad, 2)} {s.material.unidadMedida}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Movimientos recientes</h3>
        {movimientos.length === 0 ? (
          <VaciaTabla texto="Sin movimientos recientes en esta bodega." />
        ) : (
          <Tabla
            cabeceras={[
              { label: 'Fecha' },
              { label: 'Movimiento' },
              { label: 'Material' },
              { label: 'Cantidad', className: 'text-right' },
              { label: 'Referencia' },
              { label: 'Por' },
            ]}
          >
            {movimientos.map((m) => (
              <tr key={m.id} className="bg-white border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fechaCorta(m.creadoEn)}</td>
                <td className="px-4 py-2.5 text-slate-900">{TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</td>
                <td className="px-4 py-2.5 text-slate-900">{m.material.descripcion}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-900">{formatNumber(m.cantidad, 2)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{m.documentoReferencia || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{m.creadoPor?.nombre || '—'}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </section>
    </div>
  );
};
