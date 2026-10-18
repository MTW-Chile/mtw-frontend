import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Check, Send, X as XIcon, Ban, ChevronDown, ChevronRight, Package, Undo2, FileDown, Trash2, ClipboardList } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getOrdenesCompra, updateOrdenCompraEstado, eliminarOrdenCompra, renderPdf, getConfiguracionGeneral } from '../../api/client';
import { loadImageDataUrl } from '../cotizaciones/lib/pdfTheme';
import type { EstadoOC, OrdenCompra } from '../../types';
import { ETIQUETA_NATURALEZA, pendienteConciliarItem, pendienteRecepcionarItem } from '../../types';
import { NuevaOrdenCompraModal } from './NuevaOrdenCompraModal';
import { buildOrdenCompraHtml } from './ordenCompraPdf';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useColumnFilters, type ColumnFilterDef } from '../../lib/useColumnFilters';
import { ColumnFilterHeader } from '../../components/ui/ColumnFilterHeader';
import { BREAKPOINT_DESKTOP, STICKY_ACTIONS_CLASS } from '../../lib/designSystem';
import { usePermisos } from '../../lib/permisos';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { mostrarToast } from '../../lib/toast';
import { useConfirmar } from '../../components/ui/Confirmar';
import { FiltroChips } from '../../components/ui/FiltroChips';
import { InputCompacto } from '../../components/ui/Campos';
import { BotonColapsar } from '../../components/ui/BotonColapsar';
import { BotonFila } from '../../components/ui/Lista';

export const ESTADO_OC_LABEL: Record<EstadoOC, string> = {
  BORRADOR: 'Borrador',
  PENDIENTE_APROBACION: 'Pend. aprobación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ENVIADA: 'Enviada',
  RECIBIDA_PARCIAL: 'Recibida (parcial)',
  RECIBIDA_TOTAL: 'Recibida (total)',
  PARCIALMENTE_CONCILIADA: 'Conciliada (parcial)',
  CONCILIADA: 'Conciliada',
  CANCELADA: 'Cancelada',
};

export const ESTADO_OC_VARIANT: Record<EstadoOC, BadgeVariant> = {
  BORRADOR: 'subtle',
  PENDIENTE_APROBACION: 'warning',
  APROBADA: 'info',
  RECHAZADA: 'danger',
  ENVIADA: 'brand',
  RECIBIDA_PARCIAL: 'warning',
  RECIBIDA_TOTAL: 'success',
  PARCIALMENTE_CONCILIADA: 'warning',
  CONCILIADA: 'success',
  CANCELADA: 'outline',
};

const totalOC = (oc: OrdenCompra) => oc.items.reduce((sum, i) => sum + Number(i.cantidad) * Number(i.precioUnitario ?? 0), 0);

export const formatoMoneda = (valor: number, moneda: string) =>
  valor.toLocaleString('es-CL', { style: moneda === 'CLP' ? 'currency' : 'decimal', currency: moneda === 'CLP' ? 'CLP' : undefined, maximumFractionDigits: 0 }) +
  (moneda !== 'CLP' ? ` ${moneda}` : '');

// Detalle de los items de una OC -- usado tanto en la propia lista
// (expandible por fila) como en Control de Documentos (Compras >
// Conciliación), donde ademas importa el estado de conciliacion/recepcion
// de cada item. mostrarConciliacion agrega esas dos columnas sin duplicar
// la tabla entera en el otro lugar.
export const DetalleItemsOC: React.FC<{ oc: OrdenCompra; mostrarConciliacion?: boolean }> = ({ oc, mostrarConciliacion = false }) => (
  <>
    {oc.comentarios && (
      <p className="text-[11px] text-slate-600 mb-2 pb-2 border-b border-slate-200">
        <span className="font-bold text-slate-700">Comentarios: </span>
        {oc.comentarios}
      </p>
    )}
    {oc.items.length === 0 ? (
      <p className="text-[11px] text-slate-400">Esta OC no tiene items.</p>
    ) : (
      <Tabla>
      <Thead>
        <Tr className="text-left text-slate-400 uppercase tracking-wider">
          <Th className="pb-1.5 font-bold">Item</Th>
          <Th className="pb-1.5 font-bold">Categoría</Th>
          <Th alinear="derecha" className="pb-1.5 font-bold">Cantidad</Th>
          <Th alinear="derecha" className="pb-1.5 font-bold">Precio unit.</Th>
          <Th alinear="derecha" className="pb-1.5 font-bold">Subtotal</Th>
          {mostrarConciliacion && <Th alinear="derecha" className="pb-1.5 font-bold">Conciliación</Th>}
        </Tr>
      </Thead>
      <Tbody>
        {oc.items.map((item) => {
          const pendienteConciliar = mostrarConciliacion ? pendienteConciliarItem(item) : 0;
          const pendienteRecepcionar = mostrarConciliacion ? pendienteRecepcionarItem(item) : 0;
          return (
            <Tr key={item.id} className="border-t border-slate-100/80">
              <Td className="pr-2 text-slate-700">
                <span className="flex items-center gap-1.5">
                  {item.materialId && <Package className="w-3 h-3 text-sky-500 shrink-0" />}
                  {item.descripcion}
                </span>
              </Td>
              <Td className="pr-2 text-slate-500">{item.partida?.nombre ?? '—'}</Td>
              <Td alinear="derecha" className="font-mono text-slate-700">
                {Number(item.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {item.unidadMedida}
              </Td>
              <Td alinear="derecha" className="font-mono text-slate-700">{formatoMoneda(Number(item.precioUnitario), oc.moneda)}</Td>
              <Td alinear="derecha" className="font-mono font-semibold text-slate-900">
                {formatoMoneda(Number(item.cantidad) * Number(item.precioUnitario), oc.moneda)}
              </Td>
              {mostrarConciliacion && (
                <Td alinear="derecha">
                  {pendienteConciliar <= 0 ? (
                    <Badge variant="success" size="sm">
                      Conciliado
                    </Badge>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      <Badge variant={pendienteConciliar < Number(item.cantidad) ? 'warning' : 'subtle'} size="sm">
                        {pendienteConciliar < Number(item.cantidad) ? 'Parcial' : 'Pendiente'} ·{' '}
                        {pendienteConciliar.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {item.unidadMedida}
                      </Badge>
                      {pendienteRecepcionar > 0 && (
                        <span className="text-[10px] text-slate-400">
                          También pendiente de recepcionar ({pendienteRecepcionar.toLocaleString('es-CL', { maximumFractionDigits: 2 })})
                        </span>
                      )}
                    </div>
                  )}
                </Td>
              )}
            </Tr>
          );
        })}
      </Tbody>
    </Tabla>
    )}
  </>
);

interface OrdenesCompraListProps {
  // Sin proyectoId: vista global (todas las obras, tab "Abastecimiento").
  // Con proyectoId: vista de la ficha de proyecto -- filtra, oculta la
  // columna Obra, y la Nueva OC ya viene con el proyecto fijo.
  proyectoId?: string;
  proyectoLabel?: string;
}

export const OrdenesCompraList: React.FC<OrdenesCompraListProps> = ({ proyectoId, proyectoLabel }) => {
  const { confirmar } = useConfirmar();
  // Aprobar y enviar una OC es trabajo centralizado del módulo Compras --
  // desde la ficha de un proyecto puntual (proyectoId fijo) solo se puede
  // crear/ver/cancelar, no resolver la aprobación ni mandarla al
  // proveedor. Rendered sin proyectoId (Compras) tiene el flujo completo.
  const modoRestringido = !!proyectoId;
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [solicitudIdParaCompletar, setSolicitudIdParaCompletar] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoOC | ''>('');
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [generandoPdfId, setGenerandoPdfId] = useState<string | null>(null);

  const toggleExpandida = (id: string) =>
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Mismo documento que se le manda al proveedor al marcarla "Enviada" --
  // no hay un archivo guardado aparte, se arma al vuelo con los datos
  // actuales de la OC cada vez que se pide (igual patron que el PDF de
  // Presupuesto, ver PresupuestoOferta.tsx).
  const descargarPdf = async (oc: OrdenCompra) => {
    setGenerandoPdfId(oc.id);
    try {
      let logoDataUrl: string | null = null;
      try {
        logoDataUrl = await loadImageDataUrl('/mtw-logo.png');
      } catch {
        // Decorativo -- si falla la carga, el PDF sigue sin el logo.
      }
      const { ivaPct } = await queryClient.fetchQuery({ queryKey: ['configuracionGeneral'], queryFn: getConfiguracionGeneral });
      const html = buildOrdenCompraHtml(oc, logoDataUrl, ivaPct);
      const filename = `${oc.numero}.pdf`;
      const blob = await renderPdf(html, filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      mostrarToast(`No se pudo generar el PDF: ${error?.message || error}`);
    } finally {
      setGenerandoPdfId(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['ordenesCompra', { proyectoId, estado: filtroEstado }],
    queryFn: () => getOrdenesCompra({ proyectoId, estado: filtroEstado || undefined, limit: 100 }),
  });

  // mismo queryKey que App.tsx/Header.tsx -- sale del cache, no pega de
  // nuevo al backend.
  const { tiene } = usePermisos();
  // Cada boton exige el permiso de su transicion (la API exige lo mismo).
  const puedeEmitir = tiene('compras.oc.emitir');
  const puedeAprobar = tiene('compras.oc.aprobar');
  const puedeAnular = tiene('compras.oc.anular');
  const puedePurgar = tiene('sistema.purgas');

  const transicion = useMutation({
    mutationFn: ({ id, estado, motivo }: { id: string; estado: EstadoOC; motivo?: string }) =>
      updateOrdenCompraEstado(id, estado, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      // Puede crear (Solicitar aprobación) o resolver (Aprobar/Rechazar) un
      // pendiente gerencial -- se invalida para que el menú de usuario/Centro de
      // Notificaciones se actualicen al toque, sin esperar el proximo poll.
      queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
      setRechazandoId(null);
      setMotivoRechazo('');
    },
  });

  // Purga de superadministrador fuera de produccion (ver eliminarOrdenCompra
  // en api/client.ts): borra la OC completa y libera su numero.
  const eliminarMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => eliminarOrdenCompra(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
    },
    onError: (error: any) => {
      mostrarToast(error?.response?.data?.error || 'No se pudo eliminar la OC.');
    },
  });

  const ordenes = data?.data || [];
  const colSpan = proyectoId ? 6 : 7;
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);

  const columnas: ColumnFilterDef<OrdenCompra>[] = useMemo(
    () => [
      { key: 'numero', tipo: 'texto', label: 'Número', accessor: (oc) => oc.numero },
      ...(!proyectoId
        ? ([{ key: 'obra', tipo: 'texto', label: 'Obra', accessor: (oc) => oc.proyecto?.obra || oc.centroCosto?.nombre || '' }] as ColumnFilterDef<OrdenCompra>[])
        : []),
      { key: 'proveedor', tipo: 'texto', label: 'Proveedor', accessor: (oc) => oc.proveedor?.nombre || '' },
    ],
    [proyectoId]
  );
  const { valores, setValor, datosFiltrados: ordenesFiltradas } = useColumnFilters(ordenes, columnas);

  // Reusado en la fila de escritorio y en la tarjeta de mobile -- toda la
  // logica de que boton mostrar segun estado/permiso vive en un solo
  // lugar.
  // compacto (tabla de escritorio): las acciones secundarias (PDF,
  // Cancelar, Eliminar) quedan como botones de solo icono, todo en UNA
  // fila -- antes se apilaban en 3-4 renglones y cada OC ocupaba ~150px de
  // alto, empujando Obra/Proveedor a "Edifici…".
  const AccionesOC: React.FC<{ oc: OrdenCompra; compacto?: boolean }> = ({ oc, compacto = false }) => (
    <div className={`flex items-center justify-end gap-1.5 ${compacto ? 'flex-nowrap' : 'flex-wrap'}`}>
      <Button
        size={compacto ? 'icon' : 'sm'}
        variant="ghost"
        leftIcon={<FileDown className="w-3.5 h-3.5" />}
        isLoading={generandoPdfId === oc.id}
        onClick={() => descargarPdf(oc)}
        title="Descargar PDF"
        aria-label="Descargar PDF"
      >
        {!compacto && 'PDF'}
      </Button>
      {/* Aprobar/enviar es trabajo del módulo Compras (revisión
          centralizada), no de la ficha de un proyecto puntual --
          ver modoRestringido. */}
      {!modoRestringido && puedeEmitir && oc.estado === 'BORRADOR' && !oc.proveedorId && (
        <Button size="sm" leftIcon={<ClipboardList className="w-3.5 h-3.5" />} onClick={() => setSolicitudIdParaCompletar(oc.id)}>
          Completar
        </Button>
      )}
      {!modoRestringido && puedeEmitir && oc.estado === 'BORRADOR' && !!oc.proveedorId && oc.requiereAprobacion && (
        <Button
          size="sm"
          variant="outline"
          isLoading={transicion.isPending && transicion.variables?.id === oc.id}
          onClick={() => transicion.mutate({ id: oc.id, estado: 'PENDIENTE_APROBACION' })}
          title="Solicitar aprobación"
        >
          {compacto ? 'Solicitar' : 'Solicitar aprobación'}
        </Button>
      )}
      {!modoRestringido && puedeEmitir && oc.estado === 'BORRADOR' && !oc.requiereAprobacion && (
        <Button
          size="sm"
          leftIcon={<Send className="w-3.5 h-3.5" />}
          isLoading={transicion.isPending && transicion.variables?.id === oc.id}
          onClick={() => transicion.mutate({ id: oc.id, estado: 'ENVIADA' })}
        >
          Enviar
        </Button>
      )}
      {!modoRestringido && puedeAprobar && oc.estado === 'PENDIENTE_APROBACION' && (
        <>
          <Button
            size="sm"
            leftIcon={<Check className="w-3.5 h-3.5" />}
            isLoading={transicion.isPending && transicion.variables?.id === oc.id}
            onClick={() => transicion.mutate({ id: oc.id, estado: 'APROBADA' })}
          >
            Aprobar
          </Button>
          <Button
            size={compacto ? 'icon' : 'sm'}
            variant={compacto ? 'outline' : 'danger'}
            className={compacto ? 'text-rose-600 hover:text-rose-700' : ''}
            leftIcon={<XIcon className="w-3.5 h-3.5" />}
            onClick={() => setRechazandoId(oc.id)}
            title="Rechazar OC"
            aria-label="Rechazar OC"
          >
            {!compacto && 'Rechazar'}
          </Button>
        </>
      )}
      {!modoRestringido && puedeEmitir && oc.estado === 'APROBADA' && (
        <Button
          size="sm"
          leftIcon={<Send className="w-3.5 h-3.5" />}
          isLoading={transicion.isPending && transicion.variables?.id === oc.id}
          onClick={() => transicion.mutate({ id: oc.id, estado: 'ENVIADA' })}
        >
          Enviar
        </Button>
      )}
      {!modoRestringido && puedeEmitir && oc.estado === 'ENVIADA' && (
        <Button
          size={compacto ? 'icon' : 'sm'}
          variant="outline"
          title="Revertir envío"
          aria-label="Revertir envío"
          leftIcon={<Undo2 className="w-3.5 h-3.5" />}
          isLoading={transicion.isPending && transicion.variables?.id === oc.id}
          onClick={async () => {
            if (await confirmar({ titulo: `¿Revertir el envío de la OC ${oc.numero}?`, mensaje: `Vuelve a Borrador para poder editarla y reenviarla.`, confirmar: 'Revertir', peligro: true })) {
              transicion.mutate({ id: oc.id, estado: 'BORRADOR' });
            }
          }}
        >
          {!compacto && 'Revertir envío'}
        </Button>
      )}
      {puedeAnular && ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA'].includes(oc.estado) && (
        <Button
          size={compacto ? 'icon' : 'sm'}
          variant="ghost"
          leftIcon={<Ban className="w-3.5 h-3.5" />}
          isLoading={transicion.isPending && transicion.variables?.id === oc.id}
          onClick={() => transicion.mutate({ id: oc.id, estado: 'CANCELADA' })}
          title="Cancelar OC"
          aria-label="Cancelar OC"
        >
          {!compacto && 'Cancelar'}
        </Button>
      )}
      {puedePurgar && (
        <Button
          size={compacto ? 'icon' : 'sm'}
          variant={compacto ? 'ghost' : 'danger'}
          className={compacto ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50' : ''}
          title="Eliminar OC"
          aria-label="Eliminar OC"
          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          isLoading={eliminarMutation.isPending && eliminarMutation.variables?.id === oc.id}
          onClick={async () => {
            if (await confirmar({ titulo: `¿Eliminar definitivamente la OC ${oc.numero}?`, mensaje: `Esta acción no se puede deshacer y libera su número.`, confirmar: 'Eliminar', peligro: true })) {
              eliminarMutation.mutate({ id: oc.id });
            }
          }}
        >
          {!compacto && 'Eliminar'}
        </Button>
      )}
    </div>
  );

  const RechazoInline: React.FC<{ oc: OrdenCompra }> = ({ oc }) => (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-xs font-semibold text-rose-700 shrink-0">Motivo del rechazo:</span>
      <InputCompacto
        aria-label="Motivo del rechazo"
        autoFocus
        value={motivoRechazo}
        onChange={(e) => setMotivoRechazo(e.target.value)}
        placeholder="Ej: precio fuera de rango, proveedor no homologado…"
        className="flex-1 min-w-[180px]"
      />
      <Button
        size="sm"
        variant="danger"
        disabled={!motivoRechazo.trim()}
        isLoading={transicion.isPending}
        onClick={() => transicion.mutate({ id: oc.id, estado: 'RECHAZADA', motivo: motivoRechazo.trim() })}
      >
        Confirmar rechazo
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setRechazandoId(null);
          setMotivoRechazo('');
        }}
      >
        Cancelar
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <FiltroChips
            etiqueta="Filtrar por estado"
            valor={filtroEstado}
            onChange={setFiltroEstado}
            opciones={[{ id: '' as const, label: 'Todas' }, ...(Object.keys(ESTADO_OC_LABEL) as EstadoOC[]).map((estado) => ({ id: estado, label: ESTADO_OC_LABEL[estado] }))]}
          />
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setModalAbierto(true)}>
          {puedeEmitir ? 'Nueva OC' : 'Solicitar materiales'}
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : ordenes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          No hay Órdenes de Compra{filtroEstado ? ` en estado "${ESTADO_OC_LABEL[filtroEstado]}"` : ''}
          {proyectoId ? ' para este proyecto' : ''} todavía.
        </div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Ninguna OC coincide con los filtros.
        </div>
      ) : isDesktop ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Tabla>
            <Thead>
              <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <Th className="font-bold">Número</Th>
                {!proyectoId && <Th className="font-bold">Obra</Th>}
                <Th className="font-bold">Proveedor</Th>
                <Th className="font-bold">Estado</Th>
                <Th alinear="derecha" className="font-bold">Total</Th>
                <Th className="font-bold hidden 2xl:table-cell">Creada</Th>
                <Th className={`px-4 py-3 font-bold text-right ${STICKY_ACTIONS_CLASS} bg-slate-50`}>Acciones</Th>
              </Tr>
              <Tr className="border-b border-slate-100 bg-white">
                {columnas.map((c) => (
                  <Th key={c.key}>
                    <ColumnFilterHeader columna={c} valor={valores[c.key] || ''} onChange={(v) => setValor(c.key, v)} />
                  </Th>
                ))}
                <Th colSpan={colSpan - columnas.length} />
              </Tr>
            </Thead>
            <Tbody>
              {ordenesFiltradas.map((oc) => (
                <React.Fragment key={oc.id}>
                  <Tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <Td>
                      <BotonColapsar abierto={expandidas.has(oc.id)} onClick={() => toggleExpandida(oc.id)} className="flex-nowrap! gap-1.5! font-mono font-bold text-slate-900 hover:text-brand-600 whitespace-nowrap">
                        {oc.numero}
                        {oc.naturaleza && oc.naturaleza !== 'PRESUPUESTO' && (
                          <Badge size="sm" variant={oc.naturaleza === 'REPOSICION' ? 'warning' : 'violet'}>
                            {ETIQUETA_NATURALEZA[oc.naturaleza]}
                          </Badge>
                        )}
                      </BotonColapsar>
                    </Td>
                    {!proyectoId && (
                      <Td className="text-slate-700 min-w-[8rem] max-w-[20rem]" title={oc.proyecto?.obra || oc.centroCosto?.nombre || ''}>
                        <div className="line-clamp-2 leading-snug">{oc.proyecto?.obra || oc.centroCosto?.nombre || '—'}</div>
                      </Td>
                    )}
                    <Td className="text-slate-700 min-w-[7rem] max-w-[16rem]" title={oc.proveedor?.nombre}>
                      {oc.proveedor?.nombre ? <div className="line-clamp-2 leading-snug">{oc.proveedor.nombre}</div> : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wide">
                          Solicitud
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge variant={ESTADO_OC_VARIANT[oc.estado]} size="sm">
                        {ESTADO_OC_LABEL[oc.estado]}
                      </Badge>
                    </Td>
                    <Td alinear="derecha" className="font-semibold text-slate-900 whitespace-nowrap">{formatoMoneda(totalOC(oc), oc.moneda)}</Td>
                    <Td className="text-slate-500 whitespace-nowrap hidden 2xl:table-cell">{new Date(oc.creadoEn).toLocaleDateString('es-CL')}</Td>
                    <Td className={`px-4 py-3 w-px ${STICKY_ACTIONS_CLASS} bg-white`}>
                      <AccionesOC oc={oc} compacto />
                    </Td>
                  </Tr>
                  {expandidas.has(oc.id) && (
                    <Tr className="bg-slate-50/60 border-b border-slate-100">
                      <Td colSpan={colSpan}>
                        <DetalleItemsOC oc={oc} />
                      </Td>
                    </Tr>
                  )}
                  {rechazandoId === oc.id && (
                    <Tr className="bg-rose-50/50 border-b border-rose-100">
                      <Td colSpan={colSpan}>
                        <RechazoInline oc={oc} />
                      </Td>
                    </Tr>
                  )}
                </React.Fragment>
              ))}
            </Tbody>
          </Tabla>
        </div>
      ) : (
        <div className="space-y-3">
          {ordenesFiltradas.map((oc) => (
            <div key={oc.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <BotonFila sinRelleno onClick={() => toggleExpandida(oc.id)} className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-slate-900">
                    {expandidas.has(oc.id) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    {oc.numero}
                  </div>
                  {!proyectoId && <p className="text-[11px] text-slate-500 truncate pl-5">{oc.proyecto?.obra || oc.centroCosto?.nombre || '—'}</p>}
                  <p className="text-[11px] text-slate-500 truncate pl-5">
                    {oc.proveedor?.nombre || (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wide">
                        Solicitud
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <Badge variant={ESTADO_OC_VARIANT[oc.estado]} size="sm">
                    {ESTADO_OC_LABEL[oc.estado]}
                  </Badge>
                  <div className="text-xs font-bold text-slate-900">{formatoMoneda(totalOC(oc), oc.moneda)}</div>
                </div>
              </BotonFila>
              {expandidas.has(oc.id) && (
                <div className="pt-2 border-t border-slate-100">
                  <DetalleItemsOC oc={oc} />
                </div>
              )}
              {rechazandoId === oc.id && (
                <div className="pt-2 border-t border-rose-100">
                  <RechazoInline oc={oc} />
                </div>
              )}
              <div className="pt-2 border-t border-slate-100">
                <AccionesOC oc={oc} />
              </div>
            </div>
          ))}
        </div>
      )}

      <NuevaOrdenCompraModal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        proyectoIdFijo={proyectoId}
        proyectoLabelFijo={proyectoLabel}
      />
      <NuevaOrdenCompraModal
        isOpen={!!solicitudIdParaCompletar}
        onClose={() => setSolicitudIdParaCompletar(null)}
        solicitudId={solicitudIdParaCompletar || undefined}
      />
    </div>
  );
};
