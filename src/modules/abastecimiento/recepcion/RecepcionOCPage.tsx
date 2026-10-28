import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, PackageCheck } from 'lucide-react';
import { getOrdenCompraById, getTiposDocumento, registrarRecepcionOC, type RecepcionOCItemCreado } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Aviso } from '../../../components/ui/Aviso';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { Input } from '../../../components/ui/Input';
import { OpcionesTarjeta, Textarea } from '../../../components/ui/Campos';
import { useMigas } from '../../../lib/migas';
import { cantidad as fmtCantidad } from '../../../lib/formato';
import { extraerErrorParaToast } from '../../../lib/toast';
import { ESTADO_OC_LABEL, ESTADO_OC_VARIANT } from '../OrdenesCompraList';
import { FilaRecepcion } from './FilaRecepcion';
import { estadoInicialRecepcion, filasDesdeOC, itemsRecepcion, marcarTodas, resumenRecepcion, type EstadoRecepcion } from './recepcion';

/**
 * Recepción de una OC en bodega como página completa (Bodega › Recepciones
 * pendientes › OC): documento de respaldo primero, "Llegó todo" en un toque,
 * una fila de dos renglones por ítem con contador táctil, y al confirmar los
 * códigos de rotulado en grande. Es página y no modal porque en tablet el
 * teclado tapa el pie de un modal.
 */
export const RecepcionOCPage: React.FC<{ ocId: string; onVolver: () => void }> = ({ ocId, onVolver }) => {
  const queryClient = useQueryClient();
  const { data: oc, isLoading, isError, refetch } = useQuery({ queryKey: ['ordenCompra', ocId], queryFn: () => getOrdenCompraById(ocId) });
  const { data: tiposDocumento } = useQuery({ queryKey: ['tiposDocumento'], queryFn: getTiposDocumento });
  useMigas(2, [{ label: oc ? `Recepcionar ${oc.numero}` : 'Recepcionar' }]);

  const filas = useMemo(() => (oc ? filasDesdeOC(oc) : []), [oc]);
  // Estado por fila: se arma la primera vez que llega la OC (no se pisa lo tocado si la OC se refresca).
  const [estado, setEstado] = useState<EstadoRecepcion | null>(null);
  const estadoFilas = estado ?? estadoInicialRecepcion(filas);
  const actualizar = (nuevo: EstadoRecepcion) => setEstado(nuevo);

  const [tipoDocumentoId, setTipoDocumentoId] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creados, setCreados] = useState<RecepcionOCItemCreado[] | null>(null);

  const tipos = (tiposDocumento?.data ?? []).filter((t) => t.activo !== false);
  const tipoElegido = tipos.find((t) => t.id === tipoDocumentoId);
  const resumen = resumenRecepcion(filas, estadoFilas);
  const documentoCompleto = !!tipoDocumentoId && !!numeroDocumento.trim();
  const puedeRecibir = !!oc && (oc.estado === 'ENVIADA' || oc.estado === 'RECIBIDA_PARCIAL');

  const mutation = useMutation({
    mutationFn: () => {
      const items = itemsRecepcion(filas, estadoFilas);
      if (!documentoCompleto) throw new Error('Falta el documento de respaldo: tipo y número.');
      if (items.length === 0) throw new Error('Marca al menos un ítem con la cantidad que llegó.');
      return registrarRecepcionOC(ocId, {
        tipoDocumentoId,
        numeroDocumento: numeroDocumento.trim(),
        notas: notas.trim() || undefined,
        items: items.map((i) => ({ ordenCompraItemId: i.id, cantidadRecibida: i.cantidad, observacion: i.observacion })),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['ordenCompra', ocId] });
      queryClient.invalidateQueries({ queryKey: ['bodegaProyecto'] });
      queryClient.invalidateQueries({ queryKey: ['bodegaGlobal'] });
      setCreados(data.recepcion.items);
    },
    onError: (e) => setError(extraerErrorParaToast(e).mensaje),
  });

  if (isLoading) return <Cargando texto="Cargando la OC…" />;
  if (isError || !oc) return <ErrorCarga que="la orden de compra" onReintentar={() => refetch()} />;

  const descripcionDe = (ordenCompraItemId: string) => oc.items.find((i) => i.id === ordenCompraItemId)?.descripcion ?? '';

  const cabecera = (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 sm:px-5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={onVolver} className="pointer-coarse:min-h-11">
        Recepciones
      </Button>
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono font-black text-base text-slate-900">{oc.numero}</span>
        <Badge variant={ESTADO_OC_VARIANT[oc.estado]} size="sm">
          {ESTADO_OC_LABEL[oc.estado]}
        </Badge>
        <span className="text-sm font-semibold text-slate-800">{oc.proveedor?.nombre ?? 'Sin proveedor'}</span>
        <span className="text-xs text-slate-500">
          {oc.proyecto?.obra ?? oc.centroCosto?.nombre ?? 'Obras Mayores'}
          {oc.fase ? ` · Fase ${oc.fase.numeroFase ?? ''} ${oc.fase.nombre}` : ''}
          {oc.creadoPor?.nombre ? ` · pedida por ${oc.creadoPor.nombre}` : ''}
        </span>
      </div>
    </div>
  );

  if (creados) {
    return (
      <div className="space-y-4 max-w-3xl">
        {cabecera}
        <div className="rounded-2xl bg-white border border-emerald-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-base font-black">Recepción registrada</span>
          </div>
          <p className="text-xs text-slate-500">Cada lote recibido tiene su código: rotula con él lo que llegó. Los códigos quedan también en el detalle de la OC.</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {creados.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono font-black text-xl sm:text-2xl text-slate-900 tracking-wide">{c.codigo}</div>
                  <div className="text-xs text-slate-600 truncate">{descripcionDe(c.ordenCompraItemId)}</div>
                </div>
                <span className="font-mono font-bold text-base text-slate-700 tabular-nums shrink-0">{fmtCantidad(c.cantidadRecibida)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 max-sm:[&>*]:flex-1 pointer-coarse:[&>*]:min-h-11">
            <Button onClick={onVolver} leftIcon={<PackageCheck className="w-3.5 h-3.5" />}>
              Recepcionar otra OC
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {cabecera}

      {!puedeRecibir && <Aviso tono="advertencia">Esta OC está en estado "{ESTADO_OC_LABEL[oc.estado]}": no se puede recepcionar.</Aviso>}

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">① Documento de respaldo</h2>
        <OpcionesTarjeta
          opciones={tipos.map((t) => ({ value: t.id, label: t.nombre }))}
          valor={tipoDocumentoId}
          onChange={setTipoDocumentoId}
          columnas={tipos.length >= 4 ? 4 : tipos.length === 3 ? 3 : 2}
          disabled={!puedeRecibir}
        />
        <Input
          label={`N° de ${tipoElegido?.nombre.toLowerCase() ?? 'documento'}`}
          value={numeroDocumento}
          onChange={(e) => setNumeroDocumento(e.target.value)}
          inputMode="numeric"
          placeholder="Tal como viene en el papel"
          className="text-base pointer-coarse:min-h-12 max-w-xs"
          disabled={!puedeRecibir}
          helperText="Toda recepción necesita factura o guía de despacho."
        />
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 sm:px-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            ② Qué llegó <span className="font-mono font-normal normal-case tracking-normal text-slate-400">· {resumen.marcadas} de {resumen.pendientes} ítems</span>
          </h2>
          <div className="flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
            <Button size="sm" variant="outline" className="pointer-coarse:min-h-11" disabled={!puedeRecibir} onClick={() => actualizar(marcarTodas(filas, estadoFilas, true))}>
              Llegó todo
            </Button>
            <Button size="sm" variant="ghost" className="pointer-coarse:min-h-11" disabled={!puedeRecibir} onClick={() => actualizar(marcarTodas(filas, estadoFilas, false))}>
              Nada
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {filas.map((f) => (
            <FilaRecepcion key={f.id} fila={f} estado={estadoFilas[f.id]} onChange={(e) => actualizar({ ...estadoFilas, [f.id]: e })} />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
        <Textarea label="③ Notas de la recepción" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={1000} placeholder="Quién entregó, estado general de la carga…" disabled={!puedeRecibir} />
      </section>

      <div className="sticky bottom-2 z-10 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg px-4 py-3 sm:px-5 space-y-2">
        {error && <Aviso tono="peligro">{error}</Aviso>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600 tabular-nums min-w-0">
            <span className="font-bold text-slate-900">{resumen.marcadas} ítems · {fmtCantidad(resumen.unidades)} unidades</span>
            {resumen.quedaranPendientes > 0 ? ` · quedarán ${resumen.quedaranPendientes} ítems pendientes` : resumen.marcadas > 0 ? ' · la OC queda recibida completa' : ''}
            {!documentoCompleto && <span className="block text-amber-700">Falta el documento de respaldo.</span>}
          </p>
          <div className="flex gap-2 ml-auto max-sm:w-full max-sm:[&>*]:flex-1 pointer-coarse:[&>*]:min-h-11">
            <Button variant="outline" onClick={onVolver} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              isLoading={mutation.isPending}
              disabled={!puedeRecibir || !documentoCompleto || resumen.marcadas === 0}
              onClick={() => {
                setError(null);
                mutation.mutate();
              }}
            >
              Confirmar recepción
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
