import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { crearEstadoPago, editarEstadoPago, getDisponiblesEstadoPago } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Aviso } from '../../../components/ui/Aviso';
import { Buscador } from '../../../components/ui/Buscador';
import { Casilla, SelectCompacto, Textarea } from '../../../components/ui/Campos';
import { SubTabs } from '../../../components/ui/PageHeader';
import { Cargando, EstadoVacio } from '../../../components/ui/Estados';
import { uf } from '../../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { EstadoPagoDetalle, ItemEstadoPagoEntrada, ParteVentana, Proyecto, VentanaCobrable } from '../../../types';
import { ETIQUETA_ESTADO_VENTANA, VARIANTE_ESTADO_VENTANA, nombreVentana } from '../obra/estadoVentana';

interface Props {
  proyecto: Proyecto;
  /** Editar un borrador existente. */
  existente?: EstadoPagoDetalle;
  onClose: () => void;
  onGuardado: (id: string) => void;
}

type Fuente = 'fases' | 'ventanas' | 'adicionales' | 'libres';
interface ItemLibre {
  descripcion: string;
  cantidad: number;
  precioUnitarioUF: number;
}

const montoDeParte = (v: VentanaCobrable, parte: ParteVentana) => (parte === 'COMPLETA' ? v.montoCompletaUF : parte === 'MARCO' ? v.montoMarcoUF : v.montoHojaUF) ?? 0;

/**
 * Arma un estado de pago: fases completas (lo que no se haya cobrado), ventanas
 * sueltas (enteras, o marco / hoja por separado), adicionales aceptados al
 * cliente e items libres (anticipo, hito). Los montos salen del precio
 * congelado de cada ventana; aquí solo se elige qué entra.
 */
export const NuevoEstadoPagoModal: React.FC<Props> = ({ proyecto, existente, onClose, onGuardado }) => {
  const queryClient = useQueryClient();
  const [fuente, setFuente] = useState<Fuente>('fases');
  const [filtro, setFiltro] = useState('');
  const [titulo, setTitulo] = useState(existente?.titulo ?? '');
  const [periodoDesde, setPeriodoDesde] = useState(existente?.periodoDesde?.slice(0, 10) ?? '');
  const [periodoHasta, setPeriodoHasta] = useState(existente?.periodoHasta?.slice(0, 10) ?? '');
  const [retencionPct, setRetencionPct] = useState(Number(existente?.retencionPct ?? 0));
  const [anticipoPct, setAnticipoPct] = useState(Number(existente?.anticipoPct ?? 0));
  const [descuentoUF, setDescuentoUF] = useState(Number(existente?.descuentoUF ?? 0));
  const [observaciones, setObservaciones] = useState(existente?.observaciones ?? '');
  // Seleccion
  const [fases, setFases] = useState<Record<string, ParteVentana>>({});
  const [ventanas, setVentanas] = useState<Record<string, ParteVentana>>(() =>
    Object.fromEntries((existente?.items ?? []).filter((i) => i.ventanaIndividualizadaId).map((i) => [i.ventanaIndividualizadaId!, i.parte]))
  );
  const [adicionales, setAdicionales] = useState<Set<string>>(() => new Set((existente?.items ?? []).filter((i) => i.adicionalId).map((i) => i.adicionalId!)));
  const [libres, setLibres] = useState<ItemLibre[]>(() =>
    (existente?.items ?? []).filter((i) => !i.ventanaIndividualizadaId && !i.adicionalId).map((i) => ({ descripcion: i.descripcion, cantidad: Number(i.cantidad), precioUnitarioUF: Number(i.precioUnitarioUF) }))
  );
  const [nuevoLibre, setNuevoLibre] = useState<ItemLibre>({ descripcion: '', cantidad: 1, precioUnitarioUF: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['estadosPagoDisponibles', proyecto.id, existente?.id ?? ''],
    queryFn: () => getDisponiblesEstadoPago(proyecto.id, existente?.id),
  });

  const ventanasFiltradas = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (data?.ventanas ?? []).filter((v) => (v.cobrable.COMPLETA || v.cobrable.MARCO || v.cobrable.HOJA || ventanas[v.id]) && (!f || `${nombreVentana(v)} ${v.sistema} ${v.nombreUnidad ?? ''} ${v.ubicacion ?? ''}`.toLowerCase().includes(f)));
  }, [data, filtro, ventanas]);

  // Estimacion en pantalla (la API recalcula al guardar).
  const estimado = useMemo(() => {
    if (!data) return 0;
    let total = 0;
    const tomadas = new Set<string>();
    for (const [faseId, parte] of Object.entries(fases)) {
      for (const v of data.ventanas.filter((x) => x.fase?.id === faseId && x.cobrable[parte])) {
        tomadas.add(`${v.id}:${parte}`);
        total += montoDeParte(v, parte);
      }
    }
    for (const [id, parte] of Object.entries(ventanas)) {
      if (tomadas.has(`${id}:${parte}`)) continue;
      const v = data.ventanas.find((x) => x.id === id);
      if (v) total += montoDeParte(v, parte);
    }
    for (const a of data.adicionales) if (adicionales.has(a.id)) total += a.montoUF;
    for (const l of libres) total += l.cantidad * l.precioUnitarioUF;
    return total;
  }, [data, fases, ventanas, adicionales, libres]);
  const neto = estimado - estimado * (retencionPct / 100) - estimado * (anticipoPct / 100) - descuentoUF;

  const items: ItemEstadoPagoEntrada[] = [
    ...Object.entries(fases).map(([faseId, parte]) => ({ tipo: 'FASE' as const, faseId, parte })),
    ...Object.entries(ventanas).map(([ventanaIndividualizadaId, parte]) => ({ tipo: 'VENTANA' as const, ventanaIndividualizadaId, parte })),
    ...[...adicionales].map((adicionalId) => ({ tipo: 'ADICIONAL' as const, adicionalId })),
    ...libres.map((l) => ({ tipo: 'LIBRE' as const, ...l })),
  ];
  const payload = { titulo: titulo.trim(), periodoDesde: periodoDesde || null, periodoHasta: periodoHasta || null, retencionPct, anticipoPct, descuentoUF, observaciones: observaciones.trim() || null, items };

  const guardar = useMutation({
    mutationFn: () => (existente ? editarEstadoPago(existente.id, payload) : crearEstadoPago(proyecto.id, payload)),
    onSuccess: ({ estadoPago, avisos }) => {
      queryClient.invalidateQueries({ queryKey: ['estadosPago', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['estadoPago', estadoPago.id] });
      queryClient.invalidateQueries({ queryKey: ['estadosPagoDisponibles', proyecto.id] });
      for (const a of avisos) mostrarToast(a, { tipo: 'info' });
      onGuardado(estadoPago.id);
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const alternarFase = (id: string) => setFases((s) => (s[id] ? Object.fromEntries(Object.entries(s).filter(([k]) => k !== id)) : { ...s, [id]: 'COMPLETA' }));
  const alternarVentana = (v: VentanaCobrable) =>
    setVentanas((s) => {
      if (s[v.id]) return Object.fromEntries(Object.entries(s).filter(([k]) => k !== v.id));
      const parte: ParteVentana = v.cobrable.COMPLETA ? 'COMPLETA' : v.cobrable.MARCO ? 'MARCO' : 'HOJA';
      return { ...s, [v.id]: parte };
    });
  const alternarAdicional = (id: string) =>
    setAdicionales((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const cuentaItems = Object.keys(fases).length + Object.keys(ventanas).length + adicionales.size + libres.length;

  return (
    <Modal
      icono={Receipt}
      titulo={existente ? `Editar ${existente.codigo}` : 'Nuevo estado de pago'}
      subtitulo={proyecto.obra}
      ancho="xl"
      onClose={onClose}
      cerrable={!guardar.isPending}
      pie={
        <Modal.Pie inicio={<span>Estimado: <b className="text-slate-800 tabular-nums">{uf(estimado)}</b> bruto · <b className="text-slate-800 tabular-nums">{uf(neto)}</b> neto</span>}>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!titulo.trim() || (cuentaItems === 0 && !existente)} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            {existente ? 'Guardar cambios' : 'Crear estado de pago'}
          </Button>
        </Modal.Pie>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Ej. EP 3 · Torre A pisos 1 al 5" />
          </div>
          <Input label="Período desde" type="date" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} />
          <Input label="Período hasta" type="date" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} />
          <Input label="Retención" type="number" min={0} max={100} step="any" sufijo="%" value={retencionPct} onChange={(e) => setRetencionPct(Number(e.target.value) || 0)} className="text-right tabular-nums" />
          <Input label="Recuperación de anticipo" type="number" min={0} max={100} step="any" sufijo="%" value={anticipoPct} onChange={(e) => setAnticipoPct(Number(e.target.value) || 0)} className="text-right tabular-nums" />
          <Input label="Descuentos" type="number" min={0} step="any" sufijo="UF" value={descuentoUF} onChange={(e) => setDescuentoUF(Number(e.target.value) || 0)} helperText="Ej. cargos al instalador que se descuentan." className="text-right tabular-nums" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="px-3 pt-2">
            <SubTabs<Fuente>
              active={fuente}
              onChange={setFuente}
              tabs={[
                { id: 'fases', label: `Fases${Object.keys(fases).length ? ` (${Object.keys(fases).length})` : ''}` },
                { id: 'ventanas', label: `Ventanas${Object.keys(ventanas).length ? ` (${Object.keys(ventanas).length})` : ''}` },
                { id: 'adicionales', label: `Adicionales${adicionales.size ? ` (${adicionales.size})` : ''}` },
                { id: 'libres', label: `Otros${libres.length ? ` (${libres.length})` : ''}` },
              ]}
            />
          </div>
          <div className="p-3 space-y-2">
            {isLoading || !data ? (
              <Cargando />
            ) : fuente === 'fases' ? (
              data.fases.length === 0 ? (
                <EstadoVacio enTarjeta={false} titulo="La obra no tiene fases" descripcion="Cobra por ventanas o con un ítem libre." />
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {data.fases.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                      <Casilla checked={!!fases[f.id]} onChange={() => alternarFase(f.id)} disabled={f.cobrables === 0 && !fases[f.id]} aria-label={`Cobrar fase ${f.numeroFase}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900">
                          Fase {f.numeroFase} · {f.nombre}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {f.ventanas} ventanas · {f.instaladas} instaladas · {f.cobrables} por cobrar
                        </p>
                      </div>
                      {fases[f.id] && (
                        <SelectCompacto aria-label="Parte" value={fases[f.id]} onChange={(e) => setFases((s) => ({ ...s, [f.id]: e.target.value as ParteVentana }))} className="w-28">
                          <option value="COMPLETA">Completas</option>
                          <option value="MARCO">Solo marcos</option>
                          <option value="HOJA">Solo hojas</option>
                        </SelectCompacto>
                      )}
                      <span className="text-xs font-mono tabular-nums text-slate-700">{uf(f.montoCobrableUF)}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : fuente === 'ventanas' ? (
              <>
                <Buscador compacto valor={filtro} onChange={setFiltro} placeholder="Buscar ventana…" etiqueta="Buscar ventanas" />
                <p className="text-[11px] text-slate-500">
                  Marco {data.pctMarco}% / hoja {100 - data.pctMarco}% del precio (Configuración › Comercial). Una ventana de una fase ya marcada se suma solo una vez.
                </p>
                {ventanasFiltradas.length === 0 ? (
                  <EstadoVacio enTarjeta={false} titulo="Nada por cobrar" descripcion="Todas las ventanas de la obra ya están en un estado de pago." />
                ) : (
                  <ul className="max-h-[36dvh] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {ventanasFiltradas.map((v) => {
                      const partes = (['COMPLETA', 'MARCO', 'HOJA'] as ParteVentana[]).filter((p) => v.cobrable[p] || ventanas[v.id] === p);
                      return (
                        <li key={v.id} className="flex items-center gap-3 px-3 py-1.5">
                          <Casilla checked={!!ventanas[v.id]} onChange={() => alternarVentana(v)} aria-label={`Cobrar ${nombreVentana(v)}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold font-mono text-slate-900">{nombreVentana(v)}</span>
                              <Badge size="sm" variant={VARIANTE_ESTADO_VENTANA[v.estado]}>
                                {ETIQUETA_ESTADO_VENTANA[v.estado]}
                              </Badge>
                              {v.cobrada.map((c) => (
                                <Badge key={c.parte} size="sm" variant="outline">
                                  {c.parte === 'COMPLETA' ? 'cobrada' : `${c.parte.toLowerCase()} cobrado`} en {c.estadoPago}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              {v.sistema}
                              {v.fase ? ` · Fase ${v.fase.numeroFase}` : ''}
                              {v.nombreUnidad ? ` · ${v.nombreUnidad}` : ''}
                            </p>
                          </div>
                          {ventanas[v.id] && v.admiteSeparacion && partes.length > 1 && (
                            <SelectCompacto aria-label="Parte" value={ventanas[v.id]} onChange={(e) => setVentanas((s) => ({ ...s, [v.id]: e.target.value as ParteVentana }))} className="w-24">
                              {partes.map((p) => (
                                <option key={p} value={p}>
                                  {p === 'COMPLETA' ? 'Completa' : p === 'MARCO' ? 'Marco' : 'Hoja'}
                                </option>
                              ))}
                            </SelectCompacto>
                          )}
                          <span className="text-xs font-mono tabular-nums text-slate-700 w-20 text-right">{uf(montoDeParte(v, ventanas[v.id] ?? 'COMPLETA'))}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : fuente === 'adicionales' ? (
              data.adicionales.length === 0 ? (
                <EstadoVacio enTarjeta={false} titulo="Sin adicionales aceptados por el cliente" />
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {data.adicionales.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                      <Casilla checked={adicionales.has(a.id)} onChange={() => alternarAdicional(a.id)} disabled={!!a.cobradoEn && !adicionales.has(a.id)} aria-label={`Cobrar adicional A${a.numero}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900">
                          A{a.numero} · {a.titulo}
                        </p>
                        {a.cobradoEn && <p className="text-[11px] text-slate-500">Ya cobrado en {a.cobradoEn}</p>}
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-700">{uf(a.montoUF)}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="space-y-2">
                {libres.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                    <span className="flex-1 truncate">{l.descripcion}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {l.cantidad} × {uf(l.precioUnitarioUF)}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setLibres((s) => s.filter((_, j) => j !== i))}>
                      Quitar
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_5rem_7rem_auto] gap-2 items-end">
                  <Input label="Descripción" value={nuevoLibre.descripcion} onChange={(e) => setNuevoLibre({ ...nuevoLibre, descripcion: e.target.value })} maxLength={300} placeholder="Anticipo, hito, retención liberada…" />
                  <Input label="Cant." type="number" min={0} step="any" value={nuevoLibre.cantidad} onChange={(e) => setNuevoLibre({ ...nuevoLibre, cantidad: Number(e.target.value) || 0 })} className="text-right tabular-nums" />
                  <Input label="UF unit." type="number" step="any" value={nuevoLibre.precioUnitarioUF} onChange={(e) => setNuevoLibre({ ...nuevoLibre, precioUnitarioUF: Number(e.target.value) || 0 })} className="text-right tabular-nums" helperText="Negativo descuenta." />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!nuevoLibre.descripcion.trim() || nuevoLibre.cantidad <= 0}
                    onClick={() => {
                      setLibres((s) => [...s, { ...nuevoLibre, descripcion: nuevoLibre.descripcion.trim() }]);
                      setNuevoLibre({ descripcion: '', cantidad: 1, precioUnitarioUF: 0 });
                    }}
                  >
                    Agregar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        {data?.ventaTotalUF != null && <Aviso tono="info" sinIcono>Venta total aceptada de la obra: <b>{uf(data.ventaTotalUF)}</b>. UF de referencia {data.tipoCambioUF.toLocaleString('es-CL')}.</Aviso>}
        <Textarea label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} maxLength={2000} />
      </div>
    </Modal>
  );
};
