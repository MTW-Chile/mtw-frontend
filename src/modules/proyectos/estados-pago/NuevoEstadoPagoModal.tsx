import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { crearEstadoPago, editarEstadoPago, getDisponiblesEstadoPago } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { BadgeBoton } from '../../../components/ui/BadgeBoton';
import { Aviso } from '../../../components/ui/Aviso';
import { Buscador } from '../../../components/ui/Buscador';
import { Casilla, Textarea } from '../../../components/ui/Campos';
import { SubTabs } from '../../../components/ui/PageHeader';
import { Cargando, EstadoVacio } from '../../../components/ui/Estados';
import { uf } from '../../../lib/formato';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { DisponiblesEstadoPago, EstadoPagoDetalle, HitoCobro, ItemEstadoPagoEntrada, Proyecto, VentanaCobrable } from '../../../types';
import { HITOS_COBRO } from '../../../types';
import { ETIQUETA_ESTADO_VENTANA, ETIQUETA_HITO_CORTA, VARIANTE_ESTADO_VENTANA, nombreVentana } from '../obra/estadoVentana';

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
/** Hitos elegidos por fase o por ventana (vacío = no entra). */
type Seleccion = Record<string, HitoCobro[]>;

const ordenar = (hitos: HitoCobro[]) => HITOS_COBRO.filter((h) => hitos.includes(h));
const alternarHito = (s: Seleccion, id: string, hito: HitoCobro): Seleccion => {
  const actual = s[id] ?? [];
  const nuevo = actual.includes(hito) ? actual.filter((h) => h !== hito) : ordenar([...actual, hito]);
  if (nuevo.length === 0) return Object.fromEntries(Object.entries(s).filter(([k]) => k !== id));
  return { ...s, [id]: nuevo };
};
const quitar = (s: Seleccion, id: string): Seleccion => Object.fromEntries(Object.entries(s).filter(([k]) => k !== id));

/**
 * Arma un estado de pago: hitos de cobro (marco, hoja con vidrio, R1, RF) de
 * fases completas o de ventanas sueltas, adicionales aceptados al cliente e
 * ítems libres. Solo se ofrecen los hitos disponibles según el estado físico
 * de cada ventana y que no estén en otro estado de pago. Los montos salen del
 * precio congelado y del % de cada hito en la obra; aquí solo se elige qué entra.
 */
export const NuevoEstadoPagoModal: React.FC<Props> = ({ proyecto, existente, onClose, onGuardado }) => {
  const queryClient = useQueryClient();
  const [fuente, setFuente] = useState<Fuente>('fases');
  const [filtro, setFiltro] = useState('');
  const [titulo, setTitulo] = useState(existente?.titulo ?? '');
  const [periodoDesde, setPeriodoDesde] = useState(existente?.periodoDesde?.slice(0, 10) ?? '');
  const [periodoHasta, setPeriodoHasta] = useState(existente?.periodoHasta?.slice(0, 10) ?? '');
  // Anticipo y retencion: los del borrador, o los de la configuracion de cobro de la obra al cargar.
  const [retencionPct, setRetencionPct] = useState<number | null>(existente ? Number(existente.retencionPct) : null);
  const [anticipoPct, setAnticipoPct] = useState<number | null>(existente ? Number(existente.anticipoPct) : null);
  const [descuentoUF, setDescuentoUF] = useState(Number(existente?.descuentoUF ?? 0));
  const [observaciones, setObservaciones] = useState(existente?.observaciones ?? '');
  // Seleccion
  const [fases, setFases] = useState<Seleccion>({});
  const [ventanas, setVentanas] = useState<Seleccion>(() => {
    const s: Seleccion = {};
    for (const i of existente?.items ?? []) if (i.ventanaIndividualizadaId && i.hito) s[i.ventanaIndividualizadaId] = ordenar([...(s[i.ventanaIndividualizadaId] ?? []), i.hito]);
    return s;
  });
  const [adicionales, setAdicionales] = useState<Set<string>>(() => new Set((existente?.items ?? []).filter((i) => i.adicionalId).map((i) => i.adicionalId!)));
  const [libres, setLibres] = useState<ItemLibre[]>(() =>
    (existente?.items ?? []).filter((i) => !i.ventanaIndividualizadaId && !i.adicionalId).map((i) => ({ descripcion: i.descripcion, cantidad: Number(i.cantidad), precioUnitarioUF: Number(i.precioUnitarioUF) }))
  );
  const [nuevoLibre, setNuevoLibre] = useState<ItemLibre>({ descripcion: '', cantidad: 1, precioUnitarioUF: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ['estadosPagoDisponibles', proyecto.id, existente?.id ?? ''],
    queryFn: () => getDisponiblesEstadoPago(proyecto.id, existente?.id),
  });
  const cobro = data?.configuracionCobro;
  const retencion = retencionPct ?? cobro?.retencionPct ?? 0;
  const anticipo = anticipoPct ?? cobro?.anticipoPct ?? 0;

  const ventanasFiltradas = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (data?.ventanas ?? []).filter((v) => (HITOS_COBRO.some((h) => v.hitos[h].cobrable) || ventanas[v.id]) && (!f || `${nombreVentana(v)} ${v.sistema} ${v.nombreUnidad ?? ''} ${v.ubicacion ?? ''}`.toLowerCase().includes(f)));
  }, [data, filtro, ventanas]);

  // Estimacion en pantalla (la API recalcula al guardar).
  const estimado = useMemo(() => {
    if (!data) return 0;
    let total = 0;
    const tomados = new Set<string>();
    for (const [faseId, hitos] of Object.entries(fases)) {
      for (const v of data.ventanas.filter((x) => x.fase?.id === faseId)) {
        for (const h of hitos) {
          if (!v.hitos[h].cobrable) continue;
          tomados.add(`${v.id}:${h}`);
          total += v.hitos[h].montoUF ?? 0;
        }
      }
    }
    for (const [id, hitos] of Object.entries(ventanas)) {
      const v = data.ventanas.find((x) => x.id === id);
      if (!v) continue;
      for (const h of hitos) if (!tomados.has(`${id}:${h}`)) total += v.hitos[h].montoUF ?? 0;
    }
    for (const a of data.adicionales) if (adicionales.has(a.id)) total += a.montoUF;
    for (const l of libres) total += l.cantidad * l.precioUnitarioUF;
    return total;
  }, [data, fases, ventanas, adicionales, libres]);
  const neto = estimado - estimado * (anticipo / 100) - estimado * (retencion / 100) - descuentoUF;

  // Un hito de una ventana que ya entra por su fase marcada no se manda dos
  // veces: la API lo rechazaria como "ya cobrado en este estado de pago".
  const cubiertosPorFase = new Set<string>();
  for (const [faseId, hitos] of Object.entries(fases))
    for (const v of (data?.ventanas ?? []).filter((x) => x.fase?.id === faseId)) for (const h of hitos) if (v.hitos[h].cobrable) cubiertosPorFase.add(`${v.id}:${h}`);
  const items: ItemEstadoPagoEntrada[] = [
    ...Object.entries(fases).map(([faseId, hitos]) => ({ tipo: 'FASE' as const, faseId, hitos })),
    ...Object.entries(ventanas)
      .map(([ventanaIndividualizadaId, hitos]) => ({ tipo: 'VENTANA' as const, ventanaIndividualizadaId, hitos: hitos.filter((h) => !cubiertosPorFase.has(`${ventanaIndividualizadaId}:${h}`)) }))
      .filter((i) => i.hitos.length > 0),
    ...[...adicionales].map((adicionalId) => ({ tipo: 'ADICIONAL' as const, adicionalId })),
    ...libres.map((l) => ({ tipo: 'LIBRE' as const, ...l })),
  ];
  const payload = { titulo: titulo.trim(), periodoDesde: periodoDesde || null, periodoHasta: periodoHasta || null, retencionPct: retencion, anticipoPct: anticipo, descuentoUF, observaciones: observaciones.trim() || null, items };

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

  // Marcar una fase toma todos los hitos que tenga disponibles; una ventana, los suyos.
  const alternarFase = (f: DisponiblesEstadoPago['fases'][number]) =>
    setFases((s) => (s[f.id] ? quitar(s, f.id) : { ...s, [f.id]: HITOS_COBRO.filter((h) => f.hitos[h].cobrables > 0) }));
  const alternarVentana = (v: VentanaCobrable) => setVentanas((s) => (s[v.id] ? quitar(s, v.id) : { ...s, [v.id]: HITOS_COBRO.filter((h) => v.hitos[h].cobrable) }));
  const alternarAdicional = (id: string) =>
    setAdicionales((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const cuentaItems = Object.keys(fases).length + Object.keys(ventanas).length + adicionales.size + libres.length;
  // Ventanas cobradas completas con el modelo anterior (sin hito): este
  // formulario no las representa y al guardar la API reemplaza todos los
  // items, asi que se perderian. Ese borrador no se edita aqui.
  const ventanasModeloAnterior = (existente?.items ?? []).filter((i) => i.ventanaIndividualizadaId && !i.hito).length;

  return (
    <Modal
      icono={Receipt}
      titulo={existente ? `Editar ${existente.codigo}` : 'Nuevo estado de pago'}
      subtitulo={proyecto.obra}
      ancho="xl"
      onClose={onClose}
      cerrable={!guardar.isPending}
      pie={
        <Modal.Pie inicio={<span>Estimado: <b className="text-slate-800 tabular-nums">{uf(estimado)}</b> avance · <b className="text-slate-800 tabular-nums">{uf(neto)}</b> neto{data ? ` · + IVA ${data.ivaPct}%` : ''}</span>}>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!titulo.trim() || !data || cuentaItems === 0 || ventanasModeloAnterior > 0} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            {existente ? 'Guardar cambios' : 'Crear estado de pago'}
          </Button>
        </Modal.Pie>
      }
    >
      <div className="space-y-4">
        {ventanasModeloAnterior > 0 && (
          <Aviso tono="advertencia" titulo="Este borrador no se puede editar aquí">
            Tiene {ventanasModeloAnterior} ventana(s) cobradas completas con el modelo anterior (sin hitos); al guardar se perderían. Anúlalo y crea uno nuevo con los hitos.
          </Aviso>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <Input label="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Ej. EP 3 · Torre A pisos 1 al 5" />
          </div>
          <Input label="Período desde" type="date" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} />
          <Input label="Período hasta" type="date" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} />
          <Input label="Descuentos" type="number" min={0} step="any" sufijo="UF" value={descuentoUF} onChange={(e) => setDescuentoUF(Number(e.target.value) || 0)} helperText="Ej. cargos al instalador que se descuentan." className="text-right tabular-nums" />
          <Input label="Devolución de anticipo" type="number" min={0} max={100} step="any" sufijo="%" value={anticipo} onChange={(e) => setAnticipoPct(Number(e.target.value) || 0)} helperText={cobro ? `Contrato de la obra: ${cobro.anticipoPct}%` : undefined} className="text-right tabular-nums" />
          <Input label="Retención" type="number" min={0} max={100} step="any" sufijo="%" value={retencion} onChange={(e) => setRetencionPct(Number(e.target.value) || 0)} helperText={cobro ? `Contrato de la obra: ${cobro.retencionPct}%` : undefined} className="text-right tabular-nums" />
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
            {isLoading || !data || !cobro ? (
              <Cargando />
            ) : fuente === 'fases' ? (
              data.fases.length === 0 ? (
                <EstadoVacio enTarjeta={false} titulo="La obra no tiene fases" descripcion="Cobra por ventanas o con un ítem libre." />
              ) : (
                <>
                  <p className="text-[11px] text-slate-500">Marca una fase para cobrar todo lo que tenga disponible; destilda los hitos que no quieras incluir.</p>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {data.fases.map((f) => {
                      const disponibles = HITOS_COBRO.filter((h) => f.hitos[h].cobrables > 0);
                      const elegidos = fases[f.id] ?? [];
                      const monto = elegidos.reduce((s, h) => s + f.hitos[h].montoUF, 0);
                      return (
                        <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                          <Casilla checked={!!fases[f.id]} onChange={() => alternarFase(f)} disabled={disponibles.length === 0 && !fases[f.id]} aria-label={`Cobrar fase ${f.numeroFase}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900">
                              Fase {f.numeroFase} · {f.nombre}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {f.ventanas} ventanas · {f.instaladas} instaladas
                              {disponibles.length === 0 ? ' · nada disponible por cobrar' : ''}
                            </p>
                            {disponibles.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {disponibles.map((h) => (
                                  <BadgeBoton key={h} variant={elegidos.includes(h) ? 'brand' : 'outline'} onClick={() => setFases((s) => alternarHito(s, f.id, h))} title={`${ETIQUETA_HITO_CORTA[h]}: ${f.hitos[h].cobrables} ventana(s) · ${uf(f.hitos[h].montoUF)}`}>
                                    {ETIQUETA_HITO_CORTA[h]} · {f.hitos[h].cobrables}
                                  </BadgeBoton>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-700 w-24 text-right">{uf(fases[f.id] ? monto : f.montoCobrableUF)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )
            ) : fuente === 'ventanas' ? (
              <>
                <Buscador compacto valor={filtro} onChange={setFiltro} placeholder="Buscar ventana…" etiqueta="Buscar ventanas" />
                <p className="text-[11px] text-slate-500">
                  Hitos de la obra: marco {cobro.pctMarco}% · hoja con vidrio {cobro.pctHoja}% · R1 {cobro.pctR1}% · RF {cobro.pctRF}%. Solo se ofrecen los hitos ya disponibles (instalados) y sin cobrar. Una ventana de una fase ya marcada se suma solo una vez.
                </p>
                {ventanasFiltradas.length === 0 ? (
                  <EstadoVacio enTarjeta={false} titulo="Nada disponible por cobrar" descripcion="Los hitos se habilitan al instalar el marco y la hoja de cada ventana (R1 y RF, con las recepciones del cliente)." />
                ) : (
                  <ul className="max-h-[36dvh] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    {ventanasFiltradas.map((v) => {
                      const elegidos = ventanas[v.id] ?? [];
                      const monto = elegidos.reduce((s, h) => s + (v.hitos[h].montoUF ?? 0), 0);
                      return (
                        <li key={v.id} className="flex items-center gap-3 px-3 py-1.5">
                          <Casilla checked={!!ventanas[v.id]} onChange={() => alternarVentana(v)} aria-label={`Cobrar ${nombreVentana(v)}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold font-mono text-slate-900">{nombreVentana(v)}</span>
                              <Badge size="sm" variant={VARIANTE_ESTADO_VENTANA[v.estado]}>
                                {ETIQUETA_ESTADO_VENTANA[v.estado]}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              {v.sistema}
                              {v.fase ? ` · Fase ${v.fase.numeroFase}` : ''}
                              {v.nombreUnidad ? ` · ${v.nombreUnidad}` : ''}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {HITOS_COBRO.map((h) => {
                                const hito = v.hitos[h];
                                const elegido = elegidos.includes(h);
                                const texto = `${hito.etiqueta} ${hito.porcentaje}%`;
                                if (hito.cobradoEn) return <Badge key={h} size="sm" variant="default" title={`Cobrado en ${hito.cobradoEn.estadoPago}`}>{texto} · {hito.cobradoEn.estadoPago}</Badge>;
                                if (!hito.cobrable) return <Badge key={h} size="sm" variant="subtle" title={h === 'R1' || h === 'RF' ? 'Espera la recepción del cliente' : 'No instalado'}>{texto}</Badge>;
                                return (
                                  <BadgeBoton key={h} variant={elegido ? 'brand' : 'outline'} onClick={() => setVentanas((s) => alternarHito(s, v.id, h))} title={`${elegido ? 'Quitar' : 'Agregar'} ${hito.etiqueta.toLowerCase()} · ${uf(hito.montoUF)}`}>
                                    {texto}
                                  </BadgeBoton>
                                );
                              })}
                            </div>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-700 w-20 text-right">{uf(ventanas[v.id] ? monto : v.montoCobrableUF)}</span>
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
                  <Input label="Descripción" value={nuevoLibre.descripcion} onChange={(e) => setNuevoLibre({ ...nuevoLibre, descripcion: e.target.value })} maxLength={300} placeholder="Anticipo, retención liberada…" />
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
        {data && (
          <Aviso tono={data.ufDelDia && !data.ufDelDia.desactualizado ? 'info' : 'advertencia'} sinIcono>
            {data.ventaTotalUF != null && (
              <>
                Venta total aceptada de la obra: <b>{uf(data.ventaTotalUF)}</b>.{' '}
              </>
            )}
            UF {data.ufDelDia ? (data.ufDelDia.desactualizado ? `del ${data.ufDelDia.fecha} (último valor disponible)` : 'de hoy') : 'de respaldo (sin indicador del día)'}: <b>{data.tipoCambioUF.toLocaleString('es-CL')}</b>
            {data.ufDelDia ? ` · ${data.ufDelDia.fuente}` : ''}. La factura se emite a la UF del día.
          </Aviso>
        )}
        <Textarea label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} maxLength={2000} />
      </div>
    </Modal>
  );
};
