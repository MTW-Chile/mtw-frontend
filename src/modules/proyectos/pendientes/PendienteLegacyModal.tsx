import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Factory, FileUp, PackageCheck, Trash2, Truck } from 'lucide-react';
import { abrirPendiente, avanzarPendiente, eliminarPendiente, getFichaVentana, getPendiente, subirAdjuntoPendiente } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Aviso } from '../../../components/ui/Aviso';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Campos';
import { ContadorTactil } from '../../../components/ui/ContadorTactil';
import { InputArchivo } from '../../../components/ui/InputArchivo';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { fecha } from '../../../lib/formato';
import { navegar } from '../../../lib/navigation';
import { usePermisos } from '../../../lib/permisos';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { DetalleCompraPendiente, ObraPendienteDetalle, PasoPendiente } from '../../../types';
import { formatoFechaHora, formatoMm } from '../fabricacion/utils';
import { FichaVentana } from '../obra/FichaVentana';
import { hoyIso } from '../obra/estadoVentana';
import { AdjuntosDetalle } from './adjuntos/AdjuntosDetalle';
import { prepararArchivo } from './adjuntos/prepararArchivo';
import { QueFabricar } from './QueFabricar';
import { ACCEPT_ADJUNTOS } from './adjuntos/utils';
import { ETIQUETA_DESTINO, ETIQUETA_MOTIVO, ETIQUETA_PASO, ETIQUETA_TIPO, VARIANTE_PASO, areaDe, codigoPendiente, pasosDeArea, textoRectificacion, type AreaPendiente } from './utils';

interface Props {
  proyectoId: string;
  pendienteId: string;
  /** Abierto desde el visor de un área (Taller o Abastecimiento): si es de esa área y sigue Ingresado, queda Recibido. */
  desdeArea?: AreaPendiente;
  onClose: () => void;
}

const Dato: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({ etiqueta, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{etiqueta}</dt>
    <dd className="text-xs text-slate-800 mt-0.5 break-words">{children}</dd>
  </div>
);

const numero = (n: number) => n.toLocaleString('es-CL');

/**
 * Qué hay que comprar: el artículo, cuántas se necesitan, su código y proveedor y, si es un vidrio, su medida. Es lo
 * primero que ve Compras.
 */
const QueComprar: React.FC<{ c: DetalleCompraPendiente; titulo: string }> = ({ c, titulo }) => {
  const vidrio = c.clase === 'VIDRIO';
  const cuantas = c.cantidad ?? (vidrio ? 1 : null);
  const unidad = vidrio ? (cuantas === 1 ? 'vidrio' : 'vidrios') : (c.unidad ?? 'un').toLowerCase();
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 space-y-3" aria-label="Qué hay que comprar">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-56">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Qué hay que comprar</h4>
          <p className="text-sm font-bold text-slate-900 mt-0.5 break-words">{c.descripcion ?? titulo}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Se necesitan</p>
          <p className="text-base font-bold text-brand-800 leading-tight">{cuantas !== null ? `${numero(cuantas)} ${unidad}` : 'Sin indicar'}</p>
          {c.cantidadVentana !== null && <p className="text-[11px] text-slate-500">la ventana lleva {numero(c.cantidadVentana)}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Dato etiqueta="Código">{c.codigo ? <span className="font-mono">{c.codigo}</span> : '—'}</Dato>
        {vidrio && (
          <Dato etiqueta={c.vidrio?.original ? 'Medida pedida' : 'Medida'}>
            {c.vidrio ? (
              <>
                <span className="font-bold">
                  {formatoMm(c.vidrio.anchoMm)} × {formatoMm(c.vidrio.altoMm)} mm
                </span>{' '}
                <span className="text-slate-500">({numero(c.vidrio.m2)} m²)</span>
                {c.vidrio.original && (
                  <span className="block text-slate-500">
                    antes {formatoMm(c.vidrio.original.anchoMm)} × {formatoMm(c.vidrio.original.altoMm)} mm
                  </span>
                )}
              </>
            ) : (
              'No se indicó: revisa las notas'
            )}
          </Dato>
        )}
        <Dato etiqueta="Proveedor">{c.proveedor ?? '—'}</Dato>
        {c.referencia && <Dato etiqueta="Referencia">{c.referencia}</Dato>}
        {c.acabado && <Dato etiqueta="Acabado">{c.acabado}</Dato>}
      </dl>
      {cuantas === null && <p className="text-[11px] text-slate-500">Este pendiente se ingresó antes de que se preguntara la cantidad: si las notas no lo dicen, consúltalo con quien lo ingresó.</p>}
    </section>
  );
};

/** Los pasos del pendiente en una línea: hechos, actual y por venir. */
const Pasos: React.FC<{ p: ObraPendienteDetalle }> = ({ p }) => {
  const pasos = pasosDeArea(p.destino);
  const actual = pasos.indexOf(p.paso as PasoPendiente);
  // Fábrica puede saltarse «En producción»: si nunca pasó por ahí, se muestra como omitido.
  const omitido = (paso: PasoPendiente) => paso === 'EN_PRODUCCION' && actual > pasos.indexOf(paso) && !p.fechaEstimada;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5" aria-label="Pasos del pendiente">
      {pasos.map((paso, i) => {
        const hecho = i < actual || p.paso === 'DESPACHADO';
        const esActual = i === actual && p.paso !== 'DESPACHADO';
        return (
          <li key={paso} className="flex items-center gap-1">
            {i > 0 && <span className={`w-4 h-px ${i <= actual ? 'bg-emerald-400' : 'bg-slate-300'}`} aria-hidden />}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold whitespace-nowrap ${
                omitido(paso) ? 'border-slate-200 text-slate-400 line-through' : hecho ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : esActual ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-500'
              }`}
              aria-current={esActual ? 'step' : undefined}
            >
              {hecho && !omitido(paso) && <Check className="w-3 h-3" aria-hidden />}
              {ETIQUETA_PASO[paso]}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/**
 * Pendiente de una obra legacy: su detalle y la gestión por pasos fijos. Las compras de estas obras no se hicieron en el
 * ERP, así que el pendiente no usa las etapas configurables ni las OC del sistema:
 *   Ingresado → Recibido (lo abre alguien del área) →
 *     Compras (vidrio, material): En proceso de compra (subiendo la OC) → Listo para despacho (al marcarlo recibido; no pasa por bodega)
 *     Fábrica (marco, hoja, ventana): En producción (con fecha estimada; se salta si ya está en fábrica) → Listo para despacho
 *   → Despachado (al emitir el despacho que lo lleva, en Despachos).
 * Solo el área del pendiente lo avanza (lo valida la API); el resto lo ve.
 *
 * Cada visor muestra lo que le sirve a quien lo abre, para no hacerlo bajar por datos que no usa:
 *   Abastecimiento: qué hay que comprar y los datos comerciales de la obra (sin la ficha de la ventana).
 *   Taller: la ficha detallada de la ventana y qué falta (sin datos comerciales).
 *   Comercial: todo.
 */
export const PendienteLegacyModal: React.FC<Props> = ({ proyectoId, pendienteId, desdeArea, onClose }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const { tiene } = usePermisos();
  const { data: p, isLoading, isError, refetch } = useQuery({ queryKey: ['pendiente', pendienteId], queryFn: () => getPendiente(pendienteId) });
  const vista: 'COMPRAS' | 'FABRICA' | 'COMERCIAL' = desdeArea ?? 'COMERCIAL';
  const ventanaId = p?.ventanaIndividualizadaId ?? null;
  // Compras no ve la ficha de la ventana: no se pide.
  const { data: ficha } = useQuery({ queryKey: ['fichaVentana', proyectoId, ventanaId], queryFn: () => getFichaVentana(proyectoId, ventanaId!), enabled: !!ventanaId && vista !== 'COMPRAS', staleTime: 60_000 });
  const [verHistorial, setVerHistorial] = useState(vista === 'COMERCIAL');

  const [fechaEstimada, setFechaEstimada] = useState('');
  const [comentario, setComentario] = useState('');
  // Cuántas llegaron: parte en lo que se pidió.
  const [llegaron, setLlegaron] = useState<number | null>(null);
  const cantidad = llegaron ?? p?.cantidad ?? 1;
  const [archivoOC, setArchivoOC] = useState<File | null>(null);

  const refrescar = () => {
    for (const k of [['pendiente', pendienteId], ['pendientes'], ['pendientesListos', proyectoId], ['despachosObras']]) queryClient.invalidateQueries({ queryKey: k });
  };
  const avisar = (e: unknown) => {
    const { mensaje, detalle } = extraerErrorParaToast(e);
    mostrarToast(mensaje, { detalle });
  };

  // Abrirlo desde el visor de su área lo deja «Recibido» (una sola vez por apertura).
  const intentado = useRef(false);
  const esDeEstaArea = !!p && !!desdeArea && areaDe(p.destino) === desdeArea;
  useEffect(() => {
    if (!p || intentado.current || p.paso !== 'INGRESADO' || !esDeEstaArea || !p.puedeGestionarArea) return;
    intentado.current = true;
    abrirPendiente(p.id)
      .then((r) => r.cambio && refrescar())
      .catch(avisar);
    // Solo depende del pendiente cargado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, p?.paso, esDeEstaArea]);

  const avanzar = useMutation({
    mutationFn: async (v: { paso: 'EN_PROCESO_COMPRA' | 'EN_PRODUCCION' | 'LISTO_DESPACHO'; conOC?: boolean }) => {
      // La OC se sube a la carpeta de OneDrive de la obra y recién entonces avanza: sin OC no hay «En proceso de compra».
      if (v.conOC && archivoOC) {
        const listo = await prepararArchivo(archivoOC);
        await subirAdjuntoPendiente(pendienteId, listo.blob, listo.nombre, listo.mime, 'OC');
      }
      return avanzarPendiente(pendienteId, {
        paso: v.paso,
        fechaEstimada: v.paso === 'EN_PRODUCCION' ? fechaEstimada : undefined,
        comentario: comentario.trim() || undefined,
        cantidad: v.paso === 'LISTO_DESPACHO' && p && areaDe(p.destino) === 'COMPRAS' ? cantidad : undefined,
      });
    },
    onSuccess: (r) => {
      setComentario('');
      setArchivoOC(null);
      refrescar();
      mostrarToast(`Pendiente en «${ETIQUETA_PASO[r.paso]}».`, { tipo: 'info' });
    },
    onError: (e) => {
      refrescar(); // si la OC alcanzó a subir, que se vea
      avisar(e);
    },
  });
  const eliminar = useMutation({
    mutationFn: () => eliminarPendiente(pendienteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendientes'] });
      onClose();
    },
    onError: avisar,
  });

  // Hoja, marco o ventana completa: Taller y Comercial ven qué hay que fabricar (medida y perfiles); ahí va también la rectificación.
  const muestraFabricar = vista !== 'COMPRAS' && !!ficha && !!p && (p.tipo === 'HOJA' || p.tipo === 'MARCO' || p.tipo === 'VENTANA');
  const ocs = (p?.adjuntos ?? []).filter((a) => a.categoria === 'OC');
  const fotos = (p?.adjuntos ?? []).filter((a) => a.categoria !== 'OC');
  const area = p ? areaDe(p.destino) : null;
  const ocupado = avanzar.isPending || eliminar.isPending;

  const acciones = () => {
    if (!p || !p.paso) return null;
    if (p.paso === 'DESPACHADO') {
      return (
        <Aviso tono="exito" titulo={`Despachado${p.despacho ? ` en ${p.despacho.codigo}` : ''}`}>
          {p.despacho?.fechaDespacho ? `Salió el ${fecha(p.despacho.fechaDespacho)}` : 'Salió a la obra'}
          {p.despacho?.numeroGuia ? ` con la guía N° ${p.despacho.numeroGuia}` : ''}. La obra lo recibe en Instaladores › Recepción.
        </Aviso>
      );
    }
    if (p.paso === 'LISTO_DESPACHO') {
      return (
        <Aviso
          tono="info"
          titulo={p.despacho ? `Va en el despacho ${p.despacho.codigo} (sin emitir)` : 'Listo para despacho'}
          accion={
            tiene('obras.ver') ? (
              <Button size="sm" variant="outline" leftIcon={<Truck className="w-3.5 h-3.5" />} onClick={() => navegar('/despachos', { obra: proyectoId })}>
                Ir a Despachos
              </Button>
            ) : undefined
          }
        >
          Se despacha desde Despachos, en la obra, con su guía. Al emitir ese despacho queda «Despachado».
        </Aviso>
      );
    }
    if (!p.puedeGestionarArea) {
      return <Aviso tono="neutro">Lo gestiona {ETIQUETA_DESTINO[p.destino]}{p.paso === 'INGRESADO' ? ': todavía no lo abren.' : '.'}</Aviso>;
    }
    if (p.paso === 'INGRESADO') {
      return <Aviso tono="neutro">Para recibirlo, ábrelo desde {area === 'FABRICA' ? 'Taller › Pendientes' : 'Abastecimiento › Pendientes'}: queda registrado quién lo recibió.</Aviso>;
    }

    if (area === 'COMPRAS') {
      if (p.paso === 'RECIBIDO') {
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">Sube la orden de compra de este {p.tipo === 'VIDRIO' ? 'vidrio' : 'material'}: queda en la carpeta de OneDrive de la obra y el pendiente pasa a «En proceso de compra».</p>
            <InputArchivo accept={ACCEPT_ADJUNTOS} onArchivos={(a) => setArchivoOC(a[0] ?? null)} etiqueta="Elegir la orden de compra">
              {(abrir) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" leftIcon={<FileUp className="w-3.5 h-3.5" />} disabled={ocupado} onClick={abrir}>
                    {archivoOC ? 'Cambiar archivo' : 'Elegir la OC'}
                  </Button>
                  <span className="text-xs text-slate-600 truncate">{archivoOC ? archivoOC.name : ocs.length ? `${ocs.length} OC ya subida(s)` : 'PDF, imagen o documento'}</span>
                </div>
              )}
            </InputArchivo>
            <div className="flex justify-end">
              <Button variant="primary" leftIcon={<FileUp className="w-3.5 h-3.5" />} disabled={!archivoOC && ocs.length === 0} isLoading={avanzar.isPending} onClick={() => avanzar.mutate({ paso: 'EN_PROCESO_COMPRA', conOC: !!archivoOC })}>
                {archivoOC ? 'Subir OC y pasar a «En proceso de compra»' : 'Pasar a «En proceso de compra»'}
              </Button>
            </div>
          </div>
        );
      }
      // EN_PROCESO_COMPRA
      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Cuando llegue, márcalo recibido: queda en espera de despacho, para enviarlo desde Despachos. No entra a ninguna bodega ni mueve el stock.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Llegaron</span>
            <ContadorTactil valor={cantidad} onChange={setLlegaron} min={1} enteros aria-label="Cantidad recibida" />
            <span className="text-xs text-slate-500">un{p.cantidad ? ` · se pidieron ${p.cantidad}` : ''}</span>
          </div>
          <Textarea label="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={500} placeholder="Proveedor, guía, observaciones…" />
          <div className="flex justify-end">
            <Button variant="primary" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} isLoading={avanzar.isPending} onClick={() => avanzar.mutate({ paso: 'LISTO_DESPACHO' })}>
              Marcar recibido: listo para despacho
            </Button>
          </div>
        </div>
      );
    }

    // Fábrica: RECIBIDO o EN_PRODUCCION
    const enProduccion = p.paso === 'EN_PRODUCCION';
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-600">
          {enProduccion
            ? `En producción, estimado para el ${p.fechaEstimada ? fecha(p.fechaEstimada) : '—'}. Cuando esté, déjalo listo para despacho; si cambia la fecha, corrígela.`
            : 'Si ya está en fábrica, déjalo listo para despacho. Si hay que fabricarlo, pásalo a producción con la fecha estimada.'}
        </p>
        <div className="grid sm:grid-cols-[12rem_1fr] gap-3">
          <Input label="Fecha estimada" id="pl-fecha" type="date" min={hoyIso()} value={fechaEstimada} onChange={(e) => setFechaEstimada(e.target.value)} />
          <Textarea label="Comentarios (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={500} placeholder="Qué falta, qué se está esperando…" />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" leftIcon={<Factory className="w-3.5 h-3.5" />} disabled={!fechaEstimada || ocupado} onClick={() => avanzar.mutate({ paso: 'EN_PRODUCCION' })}>
            {enProduccion ? 'Corregir fecha estimada' : 'Pasar a producción'}
          </Button>
          <Button variant="primary" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} isLoading={avanzar.isPending} onClick={() => avanzar.mutate({ paso: 'LISTO_DESPACHO' })}>
            {enProduccion ? 'Listo para despacho' : 'Ya está en fábrica: listo para despacho'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      ancho="lg"
      titulo={
        p ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{codigoPendiente(p.numero)}</span>
            {p.paso && (
              <Badge size="sm" variant={VARIANTE_PASO[p.paso]}>
                {ETIQUETA_PASO[p.paso]}
              </Badge>
            )}
            <Badge size="sm" variant="outline">
              {ETIQUETA_DESTINO[p.destino]}
            </Badge>
          </span>
        ) : (
          'Pendiente'
        )
      }
      subtitulo={p?.descripcion}
      onClose={onClose}
      cerrable={!avanzar.isPending}
    >
      {isLoading ? (
        <Cargando />
      ) : isError || !p ? (
        <ErrorCarga que="el pendiente" onReintentar={refetch} />
      ) : (
        <div className="space-y-4">
          <Pasos p={p} />

          {vista !== 'FABRICA' && p.compra && <QueComprar c={p.compra} titulo={p.descripcion} />}

          {vista !== 'COMPRAS' && ficha && (
            <div className="rounded-xl border border-slate-200 p-3">
              <FichaVentana proyectoId={proyectoId} ficha={ficha} titulo={p.ventanaRef ?? undefined} sinPendientes />
            </div>
          )}
          {muestraFabricar && ficha && <QueFabricar p={p} ficha={ficha} />}

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
            {vista !== 'FABRICA' && p.obra && (
              <>
                <Dato etiqueta="Obra">
                  <span className="font-bold">{p.obra.nombre}</span>
                  {p.obra.codigo && <span className="block font-mono text-slate-500">{p.obra.codigo}</span>}
                </Dato>
                <Dato etiqueta="Cliente">
                  {p.obra.cliente ?? '—'}
                  {p.obra.clienteRut && <span className="block text-slate-500">{p.obra.clienteRut}</span>}
                </Dato>
                {p.obra.centroCosto && <Dato etiqueta="Centro de costo">{p.obra.centroCosto}</Dato>}
                <Dato etiqueta="Dirección de la obra">{p.obra.direccion ?? '—'}</Dato>
              </>
            )}
            {vista === 'COMPRAS' ? (
              <Dato etiqueta="Ventana">{[p.ventanaRef, p.ventanaIndividualizada?.ubicacion].filter(Boolean).join(' · ') || '—'}</Dato>
            ) : (
              <Dato etiqueta="Qué falta o falló">{p.descripcion.startsWith(ETIQUETA_TIPO[p.tipo]) ? p.descripcion : `${ETIQUETA_TIPO[p.tipo]} · ${p.descripcion}`}</Dato>
            )}
            <Dato etiqueta="Motivo">
              {ETIQUETA_MOTIVO[p.motivo]}
              {p.responsable && <span className="block text-slate-500">Responsable: {p.responsable}</span>}
            </Dato>
            <Dato etiqueta="Se necesita para">{p.fechaRequerida ? fecha(p.fechaRequerida) : '—'}</Dato>
            <Dato etiqueta="Ingresado por">
              {p.reportadoPor?.nombre || '—'} · {formatoFechaHora(p.fechaReporte)}
            </Dato>
            {vista === 'COMERCIAL' && <Dato etiqueta="Recibido por">{p.fechaRecibido ? `${p.recibidoPor?.nombre || '—'} · ${formatoFechaHora(p.fechaRecibido)}` : 'Aún no lo abre el área'}</Dato>}
            {p.fechaEstimada && <Dato etiqueta="Fecha estimada">{fecha(p.fechaEstimada)}</Dato>}
            {p.cantidadRecibida != null && <Dato etiqueta="Recibido">{p.cantidadRecibida} un</Dato>}
          </dl>

          {textoRectificacion(p) && !muestraFabricar && !(p.compra && vista !== 'FABRICA') && <p className="rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2 text-xs font-bold text-brand-700">{textoRectificacion(p)}</p>}
          {p.notas && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Notas de quien lo ingresó</h4>
              <p className="text-xs text-slate-800 whitespace-pre-wrap break-words">{p.notas}</p>
            </div>
          )}

          <AdjuntosDetalle proyectoId={proyectoId} pendienteId={pendienteId} adjuntos={fotos} puedeAgregar={p.paso !== 'DESPACHADO'} />
          {ocs.length > 0 && <AdjuntosDetalle proyectoId={proyectoId} pendienteId={pendienteId} adjuntos={ocs} puedeAgregar={false} titulo="Orden de compra" />}

          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Qué sigue</h4>
            {acciones()}
          </div>

          {p.puedeResolver && p.paso === 'INGRESADO' && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                disabled={ocupado}
                onClick={async () => {
                  if (await confirmar({ titulo: `¿Eliminar el pendiente ${codigoPendiente(p.numero)}?`, mensaje: 'Nadie lo ha recibido todavía. No se puede deshacer.', confirmar: 'Eliminar', peligro: true })) eliminar.mutate();
                }}
              >
                Eliminar pendiente
              </Button>
            </div>
          )}

          <div>
            <BotonColapsar abierto={verHistorial} onClick={() => setVerHistorial((v) => !v)} className="mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Historial ({p.eventos.length})</span>
            </BotonColapsar>
            {verHistorial && (
              <ol className="space-y-2 border-l-2 border-slate-100 pl-3">
                {p.eventos.map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="font-bold text-slate-800">{e.etapaNombre ?? 'Ingresado'}</span>
                    <span className="text-slate-500">
                      {' '}
                      — {e.usuario?.nombre || 'sistema'} · {formatoFechaHora(e.creadoEn)}
                    </span>
                    {e.comentario && <p className="text-slate-600 mt-0.5 break-words">{e.comentario}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
