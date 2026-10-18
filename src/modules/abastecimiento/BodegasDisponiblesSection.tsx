import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Warehouse, Boxes, History } from 'lucide-react';
import { getBodegaGlobal } from '../../api/client';
import { useUrlParam } from '../../lib/navigation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { BREAKPOINT_DESKTOP } from '../../lib/designSystem';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { formatNumber } from '../../lib/utils';
import type { Bodega, TipoMovimientoBodega } from '../../types';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { EstadoVacio } from '../../components/ui/Estados';
import { BotonFila } from '../../components/ui/Lista';
import { EncabezadoSeccion } from '../../components/ui/EncabezadoSeccion';

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

// Tabla de la sección dentro de su tarjeta.
const TablaBodega: React.FC<{ cabeceras: { label: string; className?: string }[]; children: React.ReactNode }> = ({ cabeceras, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
    <Tabla>
      <Thead>
        <Tr>
          {cabeceras.map((c) => (
            <Th key={c.label} alinear={c.className?.includes('text-right') ? 'derecha' : undefined}>
              {c.label}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>{children}</Tbody>
    </Tabla>
  </div>
);

const VaciaTabla: React.FC<{ texto: string }> = ({ texto }) => <EstadoVacio titulo={texto} />;

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
    return (
      <div className="space-y-4">
        <EncabezadoSeccion icono={Warehouse} antetitulo="Bodega" titulo="Bodegas disponibles" descripcion="Bodegas de obra y de centro de costo. Abre una para ver su stock y movimientos." />
        {bodegas.length === 0 ? (
      <VaciaTabla texto="Todavía no hay bodegas. Se crean solas con la primera recepción de una Orden de Compra." />
    ) : (
      isDesktop ? (
      <TablaBodega
        cabeceras={[
          { label: 'Bodega' },
          { label: 'Asociada a' },
          { label: 'Materiales en stock', className: 'text-right' },
          { label: 'Estado', className: 'text-right' },
        ]}
      >
        {bodegas.map((b) => (
          <Tr
            key={b.id}
            onClick={() => setBodegaId(b.id)}
            className="bg-white border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <Td className="px-5 py-3.5 font-semibold text-slate-900">{b.nombre}</Td>
            <Td className="px-5 py-3.5 text-slate-600">{nombreAsociado(b)}</Td>
            <Td alinear="derecha" className="px-5 py-3.5 font-mono text-slate-900">{stockPorBodega.get(b.id) ?? 0}</Td>
            <Td alinear="derecha" className="px-5 py-3.5">
              <Badge size="sm" variant={b.activa ? 'success' : 'default'}>
                {b.activa ? 'Activa' : 'Inactiva'}
              </Badge>
            </Td>
          </Tr>
        ))}
      </TablaBodega>
      ) : (
      <div className="space-y-2">
        {bodegas.map((b) => (
          <BotonFila key={b.id} onClick={() => setBodegaId(b.id)} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4! flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="text-sm font-bold text-slate-900 truncate">{b.nombre}</div>
              <div className="text-xs text-slate-500 truncate">{nombreAsociado(b)}</div>
              <div className="text-xs text-slate-500">{stockPorBodega.get(b.id) ?? 0} materiales en stock</div>
            </div>
            <Badge size="sm" variant={b.activa ? 'success' : 'default'} className="shrink-0">
              {b.activa ? 'Activa' : 'Inactiva'}
            </Badge>
          </BotonFila>
        ))}
      </div>
      )
        )}
      </div>
    );
  }

  const stock = (data?.stock ?? []).filter((s) => s.bodegaId === bodegaActiva.id);
  const movimientos = (data?.movimientos ?? []).filter((m) => m.bodegaId === bodegaActiva.id);

  return (
    <div className="space-y-5">
      <EncabezadoSeccion
        icono={Warehouse}
        antetitulo="Bodega"
        titulo={bodegaActiva.nombre}
        descripcion={nombreAsociado(bodegaActiva)}
        acciones={
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setBodegaId(null)}>
            Bodegas
          </Button>
        }
      />

      <section className="space-y-2">
        <EncabezadoSeccion icono={Boxes} titulo="Stock actual" />
        {stock.length === 0 ? (
          <VaciaTabla texto="Esta bodega no tiene stock." />
        ) : (
          <TablaBodega
            cabeceras={[
              { label: 'SKU' },
              { label: 'Material' },
              { label: 'Partida' },
              { label: 'Cantidad', className: 'text-right' },
            ]}
          >
            {stock.map((s) => (
              <Tr key={s.id}>
                <Td className="font-mono text-xs text-slate-500">{s.material.skuInterno}</Td>
                <Td className="text-slate-900">{s.material.descripcion}</Td>
                <Td className="text-slate-600">{s.material.tipoProducto?.partida?.nombre ?? s.material.familia}</Td>
                <Td alinear="derecha" className="font-mono font-semibold text-slate-900">
                  {formatNumber(s.cantidad, 2)} {s.material.unidadMedida}
                </Td>
              </Tr>
            ))}
          </TablaBodega>
        )}
      </section>

      <section className="space-y-2">
        <EncabezadoSeccion icono={History} titulo="Movimientos recientes" />
        {movimientos.length === 0 ? (
          <VaciaTabla texto="Sin movimientos recientes en esta bodega." />
        ) : (
          <TablaBodega
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
              <Tr key={m.id}>
                <Td className="text-xs text-slate-500 whitespace-nowrap">{fechaCorta(m.creadoEn)}</Td>
                <Td className="text-slate-900">{TIPO_MOVIMIENTO[m.tipo] ?? m.tipo}</Td>
                <Td className="text-slate-900">{m.material.descripcion}</Td>
                <Td alinear="derecha" className="font-mono text-slate-900">{formatNumber(m.cantidad, 2)}</Td>
                <Td className="text-xs text-slate-500">{m.documentoReferencia || '—'}</Td>
                <Td className="text-xs text-slate-500">{m.creadoPor?.nombre || '—'}</Td>
              </Tr>
            ))}
          </TablaBodega>
        )}
      </section>
    </div>
  );
};
