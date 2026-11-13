import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, FileText, PackageCheck, Truck } from 'lucide-react';
import { getDespacho, getDespachosProyecto, registrarRecepcionObra } from '../../api/client';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { Seccion } from '../../components/ui/Seccion';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Aviso } from '../../components/ui/Aviso';
import { Textarea } from '../../components/ui/Campos';
import { Segmentado } from '../../components/ui/Segmentado';
import { BotonFila } from '../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { fecha, fechaHora } from '../../lib/formato';
import { useMigas } from '../../lib/migas';
import { actualizarParams, useUrlParam } from '../../lib/navigation';
import { usePermisos } from '../../lib/permisos';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import type { DespachoObra, DespachoObraDetalle, ObraInstalacion, VentanaObra } from '../../types';
import { ETIQUETA_ESTADO_DESPACHO, ETIQUETA_TIPO_GUIA, parteDe, VARIANTE_ESTADO_DESPACHO } from '../proyectos/obra/estadoVentana';
import { FilaRecepcion } from '../abastecimiento/recepcion/FilaRecepcion';
import { estadoInicialRecepcion, itemsRecepcion, marcarTodas, resumenRecepcion, type EstadoRecepcion, type FilaRecepcion as Fila } from '../abastecimiento/recepcion/recepcion';
import { ObraNoDisponible, ObrasInstaladores, useObraInstaladores } from './ObrasInstaladores';

const POR_RECIBIR: DespachoObra['estado'][] = ['EMITIDO', 'RECIBIDO_PARCIAL'];

/** "Torre A · piso 3 · depto 301 · dormitorio": dónde va la ventana, para ubicarla al descargar. */
const lugarVentana = (v: VentanaObra | null) => (v ? [v.torre, v.piso != null ? `piso ${v.piso}` : null, v.nombreUnidad, v.ubicacion].filter(Boolean).join(' · ') : 'Reposición por pendiente');

const textoGuia = (d: Pick<DespachoObra, 'tipoGuia' | 'numeroGuia'>) => `${ETIQUETA_TIPO_GUIA[d.tipoGuia]}${d.numeroGuia ? ` N° ${d.numeroGuia}` : ''}`;

/**
 * Instaladores › Recepción: las obras en curso; en cada una, sus despachos por recibir y los ya recibidos; y el acuse
 * de recibo de un despacho como página (no ventana emergente), con la misma lista de recepción que una OC en bodega.
 * La obra y el despacho abiertos viven en la URL (?obra=…&despacho=…).
 */
export const RecepcionObraPage: React.FC = () => {
  const [obraId, setObraId] = useUrlParam('obra');
  const [despachoId] = useUrlParam('despacho');
  const { obra, isLoading, isError, refetch } = useObraInstaladores(obraId);
  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion titulo="Recepción en obra" />
      {!obraId ? (
        <ObrasInstaladores seccion="recepcion" onElegir={(o) => setObraId(o.id)} />
      ) : !obra ? (
        <ObraNoDisponible cargando={isLoading} error={isError} onReintentar={refetch} />
      ) : despachoId ? (
        <RecepcionDespacho key={despachoId} obra={obra} despachoId={despachoId} />
      ) : (
        <DespachosDeObra obra={obra} />
      )}
    </div>
  );
};

/** Despachos de la obra: por recibir (incluye los recibidos en parte) y ya recibidos. */
const DespachosDeObra: React.FC<{ obra: ObraInstalacion }> = ({ obra }) => {
  useMigas(1, [{ label: obra.obra, codigo: obra.codigoInterno ?? undefined }]);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['despachos', obra.id], queryFn: () => getDespachosProyecto(obra.id) });
  const porRecibir = useMemo(() => (data ?? []).filter((d) => POR_RECIBIR.includes(d.estado)), [data]);
  const recibidos = useMemo(() => (data ?? []).filter((d) => d.estado === 'RECIBIDO'), [data]);
  const [vistaElegida, setVista] = useState<'POR_RECIBIR' | 'RECIBIDOS' | null>(null);
  // Sin nada por recibir se abre directo en lo recibido.
  const vista = vistaElegida ?? (porRecibir.length === 0 && recibidos.length > 0 ? 'RECIBIDOS' : 'POR_RECIBIR');
  const lista = vista === 'POR_RECIBIR' ? porRecibir : recibidos;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-black text-slate-900">{obra.obra}</h2>
        <p className="text-xs text-slate-500">Toca un despacho para marcar lo que llegó a la obra.</p>
      </div>
      {isLoading ? (
        <Cargando texto="Leyendo los despachos…" />
      ) : isError ? (
        <ErrorCarga que="los despachos" onReintentar={refetch} />
      ) : (
        <>
          <Segmentado
            etiqueta="Despachos por recibir o recibidos"
            valor={vista}
            onChange={setVista}
            opciones={[
              { value: 'POR_RECIBIR', label: 'Por recibir', icono: Truck, contador: porRecibir.length },
              { value: 'RECIBIDOS', label: 'Recibidos', icono: PackageCheck, contador: recibidos.length },
            ]}
          />
          {lista.length === 0 ? (
            <EstadoVacio
              icono={vista === 'POR_RECIBIR' ? Truck : PackageCheck}
              titulo={vista === 'POR_RECIBIR' ? 'No hay despachos por recibir' : 'Todavía no se recibe ningún despacho completo'}
              descripcion={vista === 'POR_RECIBIR' ? 'Un despacho aparece aquí cuando Fabricación lo emite hacia la obra.' : 'Los despachos recibidos en parte siguen en «Por recibir» hasta completarse.'}
            />
          ) : (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {lista.map((d) => (
                <BotonFila key={d.id} onClick={() => actualizarParams({ despacho: d.id })} className="flex items-center gap-3 min-h-16 pointer-coarse:py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold font-mono text-slate-900">{d.codigo}</span>
                      <Badge size="sm" variant={VARIANTE_ESTADO_DESPACHO[d.estado]}>
                        {ETIQUETA_ESTADO_DESPACHO[d.estado]}
                      </Badge>
                      {d.fase && <span className="text-xs text-slate-600 truncate">Fase {d.fase.numeroFase} · {d.fase.nombre}</span>}
                    </div>
                    <p className="text-xs text-slate-500">
                      {d._count.items} ítem(s) · {d.fechaDespacho ? `despachado ${fecha(d.fechaDespacho)}` : 'sin fecha'} · {textoGuia(d)}
                      {d.transportista ? ` · ${d.transportista}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                </BotonFila>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/** Un despacho: se marca lo que llegó (si queda algo por recibir) y se ve lo ya recibido, con quién y cuándo. */
const RecepcionDespacho: React.FC<{ obra: ObraInstalacion; despachoId: string }> = ({ obra, despachoId }) => {
  const volver = () => actualizarParams({ despacho: null });
  const { data: despacho, isLoading, isError, refetch } = useQuery({ queryKey: ['despacho', despachoId], queryFn: () => getDespacho(despachoId) });
  useMigas(1, [{ label: obra.obra, codigo: obra.codigoInterno ?? undefined, alHacerClic: volver }, { label: despacho?.codigo ?? '' }]);

  if (isLoading) return <Cargando texto="Leyendo el despacho…" />;
  if (isError || !despacho) return <ErrorCarga que="el despacho" onReintentar={refetch} />;
  return <FormularioRecepcion obra={obra} despacho={despacho} onVolver={volver} />;
};

const FormularioRecepcion: React.FC<{ obra: ObraInstalacion; despacho: DespachoObraDetalle; onVolver: () => void }> = ({ obra, despacho, onVolver }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const filas = useMemo<Fila[]>(
    () =>
      despacho.items.map((i) => ({
        id: i.id,
        descripcion: i.descripcion,
        detalle: [i.parte !== 'COMPLETA' ? `Solo ${parteDe(i.ventana, i.parte)}` : null, lugarVentana(i.ventana)].filter(Boolean).join(' · ') || null,
        unidad: 'un',
        pedido: i.cantidad,
        yaRecibido: i.cantidadRecibida,
        pendiente: Math.max(0, i.cantidad - i.cantidadRecibida),
        enteros: true,
      })),
    [despacho]
  );
  const [estado, setEstado] = useState<EstadoRecepcion>(() => estadoInicialRecepcion(filas));
  const [notas, setNotas] = useState('');
  const resumen = resumenRecepcion(filas, estado);
  const quedaPorRecibir = POR_RECIBIR.includes(despacho.estado) && filas.some((f) => f.pendiente > 0);
  const puedeRecibir = quedaPorRecibir && tiene('instalacion.recibir');
  const descripcionItem = (id: string) => despacho.items.find((i) => i.id === id)?.descripcion ?? '';

  const recibir = useMutation({
    mutationFn: () =>
      registrarRecepcionObra(despacho.id, {
        notas: notas.trim() || null,
        items: itemsRecepcion(filas, estado).map((i) => ({ despachoItemId: i.id, cantidadRecibida: i.cantidad, observacion: i.observacion })),
      }),
    onSuccess: () => {
      for (const k of [['instalacion', obra.id], ['ventanasObra', obra.id], ['instalacionObras'], ['despachos', obra.id], ['despacho', despacho.id], ['fichaVentana', obra.id]]) {
        queryClient.invalidateQueries({ queryKey: k });
      }
      mostrarToast(`Recepción registrada: ${resumen.marcadas} ítem(s) de ${despacho.codigo}.`, { tipo: 'info' });
      onVolver();
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black font-mono text-slate-900">{despacho.codigo}</h2>
            <Badge variant={VARIANTE_ESTADO_DESPACHO[despacho.estado]}>{ETIQUETA_ESTADO_DESPACHO[despacho.estado]}</Badge>
          </div>
          <p className="text-xs text-slate-500">
            {despacho.fase ? `Fase ${despacho.fase.numeroFase} · ${despacho.fase.nombre} · ` : ''}
            {despacho.fechaDespacho ? `despachado ${fecha(despacho.fechaDespacho)} · ` : ''}
            {textoGuia(despacho)}
            {despacho.transportista ? ` · ${despacho.transportista}` : ''}
            {despacho.patente ? ` (${despacho.patente})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {despacho.bsaleUrlPdf && (
            <Button variant="outline" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />} onClick={() => window.open(despacho.bsaleUrlPdf!, '_blank', 'noopener')}>
              Ver guía
            </Button>
          )}
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={onVolver}>
            Despachos de la obra
          </Button>
        </div>
      </div>

      {despacho.notas && (
        <Aviso tono="neutro" sinIcono>
          Nota del despacho: {despacho.notas}
        </Aviso>
      )}

      {puedeRecibir ? (
        <Seccion
          icono={PackageCheck}
          titulo="Qué llegó"
          descripcion="Lo que no marques queda por recibir en este mismo despacho. Si algo llegó dañado, recíbelo, anótalo en su fila y después ingresa el pendiente de esa ventana."
          acciones={
            <>
              <Button size="sm" variant="outline" onClick={() => setEstado(marcarTodas(filas, estado, true))}>
                Llegó todo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEstado(marcarTodas(filas, estado, false))}>
                Nada
              </Button>
            </>
          }
          sinRelleno
        >
          <ul className="divide-y divide-slate-100">
            {filas.map((f) => (
              <FilaRecepcion key={f.id} fila={f} estado={estado[f.id]} onChange={(e) => setEstado({ ...estado, [f.id]: e })} etiquetaTotal="despachado" textoNoLlego="No llegó: queda por recibir en este despacho." />
            ))}
          </ul>
          <div className="p-4 border-t border-slate-100">
            <Textarea label="Notas de la recepción (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={1000} placeholder="Quién entregó, estado general de la carga…" />
          </div>
        </Seccion>
      ) : (
        <Seccion icono={Truck} titulo={`Ventanas del despacho (${despacho.items.length})`} descripcion={quedaPorRecibir ? 'Tu rol puede ver el despacho, pero no acusar recibo.' : undefined} sinRelleno>
          <ul className="divide-y divide-slate-100">
            {despacho.items.map((i) => (
              <li key={i.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{i.descripcion}</p>
                  <p className="text-xs text-slate-500">{[i.parte !== 'COMPLETA' ? `Solo ${parteDe(i.ventana, i.parte)}` : null, lugarVentana(i.ventana)].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge size="sm" variant={i.cantidadRecibida >= i.cantidad ? 'success' : 'warning'}>
                  {i.cantidadRecibida >= i.cantidad ? 'Recibida' : 'Por recibir'}
                </Badge>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {despacho.recepciones.length > 0 && (
        <Seccion titulo={`Recepciones registradas (${despacho.recepciones.length})`} sinRelleno>
          <ul className="divide-y divide-slate-100">
            {despacho.recepciones.map((r) => {
              const observadas = r.items.filter((x) => x.observacion);
              return (
                <li key={r.id} className="px-4 py-3 space-y-1">
                  <p className="text-xs text-slate-800">
                    <b>{fechaHora(r.fechaRecepcion)}</b> · {r.recibidoPor?.nombre ?? 'sin registro de quién'} · {r.items.reduce((s, x) => s + x.cantidadRecibida, 0)} ítem(s)
                  </p>
                  {r.notas && <p className="text-xs text-slate-600">{r.notas}</p>}
                  {observadas.map((x) => (
                    <p key={x.id} className="text-xs text-amber-800">
                      {descripcionItem(x.despachoItemId)}: {x.observacion}
                    </p>
                  ))}
                </li>
              );
            })}
          </ul>
        </Seccion>
      )}

      {/* Resumen y acción principal en el pie, fijos y a la derecha (DESIGN.md 5: formularios de recepción). */}
      {puedeRecibir && (
        <div className="sticky bottom-2 z-10 rounded-2xl bg-white/95 backdrop-blur border border-slate-300 shadow-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            <b className="text-slate-900 text-sm tabular-nums">{resumen.marcadas}</b> de {resumen.pendientes} ítem(s)
            {resumen.quedaranPendientes > 0 ? <span className="text-amber-700 font-semibold"> · quedarán {resumen.quedaranPendientes} por recibir</span> : ''}
          </p>
          <Button variant="primary" size="lg" leftIcon={<PackageCheck className="w-4 h-4" />} disabled={resumen.marcadas === 0} isLoading={recibir.isPending} onClick={() => recibir.mutate()} className="max-sm:flex-1">
            {recibir.isPending ? 'Registrando…' : `Confirmar recepción (${resumen.marcadas})`}
          </Button>
        </div>
      )}
    </div>
  );
};
