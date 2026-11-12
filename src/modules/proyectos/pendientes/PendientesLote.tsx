import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Factory, FileUp, PackageCheck, X } from 'lucide-react';
import { abrirPendiente, avanzarPendiente, subirAdjuntoPendiente } from '../../../api/client';
import { Aviso } from '../../../components/ui/Aviso';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Campos';
import { ContadorTactil } from '../../../components/ui/ContadorTactil';
import { Input } from '../../../components/ui/Input';
import { InputArchivo } from '../../../components/ui/InputArchivo';
import { Modal } from '../../../components/ui/Modal';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ObraPendiente } from '../../../types';
import { hoyIso } from '../obra/estadoVentana';
import { prepararArchivo } from './adjuntos/prepararArchivo';
import { ACCEPT_ADJUNTOS } from './adjuntos/utils';
import { ETIQUETA_PASO, accionesDeLote, codigoPendiente, type AccionLote, type AreaPendiente } from './utils';

const TEXTO_ACCION: Record<AccionLote, { boton: (n: number) => string; titulo: string }> = {
  OC: { boton: (n) => `Subir una OC para ${n === 1 ? 'el pendiente' : `los ${n}`}`, titulo: 'Subir la orden de compra' },
  RECIBIR: { boton: (n) => `Marcar ${n === 1 ? 'recibido' : `recibidos los ${n}`}`, titulo: 'Marcar recibidos' },
  PRODUCCION: { boton: () => 'Pasar a producción', titulo: 'Pasar a producción' },
  LISTO: { boton: () => 'Listos para despacho', titulo: 'Dejar listos para despacho' },
};

interface Props {
  area: AreaPendiente;
  seleccion: ObraPendiente[];
  onLimpiar: () => void;
  /** Los que avanzaron: salen de la selección. */
  onHechos: (ids: string[]) => void;
}

/**
 * Barra de la selección del visor de un área y el modal que avanza todos los elegidos de una vez. Usa las mismas
 * operaciones que el pendiente de a uno (abrir, subir OC, avanzar), una tras otra: si alguno falla, los demás siguen y
 * se dice cuál no avanzó.
 */
export const PendientesLote: React.FC<Props> = ({ area, seleccion, onLimpiar, onHechos }) => {
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState<AccionLote | null>(null);
  // Los pendientes sobre los que trabaja el modal: una copia tomada al abrirlo. La lista de la página se refresca
  // (y los que cambian de paso salen de la selección) sin que el modal pierda lo que está mostrando.
  const [lote, setLote] = useState<ObraPendiente[]>([]);
  // A cuáles ya se les subió la OC en este modal: al reintentar tras un fallo no se adjunta dos veces.
  const conOC = useRef(new Set<string>());
  const enCurso = useRef(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fechaEstimada, setFechaEstimada] = useState('');
  const [comentario, setComentario] = useState('');
  const [llegaron, setLlegaron] = useState<Record<string, number>>({});
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [fallos, setFallos] = useState<string[]>([]);

  const acciones = accionesDeLote(area, seleccion);
  const obras = new Set(lote.map((p) => p.proyectoId)).size;
  const cantidadDe = (p: ObraPendiente) => llegaron[p.id] ?? p.cantidad ?? 1;

  const abrir = (a: AccionLote) => {
    conOC.current = new Set();
    setLote([...seleccion]);
    setAccion(a);
  };
  const cerrar = () => {
    setAccion(null);
    setLote([]);
    setArchivo(null);
    setFechaEstimada('');
    setComentario('');
    setLlegaron({});
    setFallos([]);
  };

  const ejecutar = async () => {
    // El candado va antes de cualquier espera: preparar una foto de la OC tarda, y un segundo clic no debe repetir el lote.
    if (!accion || enCurso.current) return;
    enCurso.current = true;
    const lista = [...lote];
    setFallos([]);
    setAvance({ hechos: 0, total: lista.length });
    const oc = accion === 'OC' && archivo ? await prepararArchivo(archivo) : null;
    const hechos: string[] = [];
    const errores: string[] = [];
    for (const [i, p] of lista.entries()) {
      try {
        // Igual que al abrirlo de a uno: queda recibido por quien lo gestiona.
        if (p.paso === 'INGRESADO') await abrirPendiente(p.id);
        if (oc && !conOC.current.has(p.id)) {
          await subirAdjuntoPendiente(p.id, oc.blob, oc.nombre, oc.mime, 'OC');
          conOC.current.add(p.id);
        }
        await avanzarPendiente(p.id, {
          paso: accion === 'OC' ? 'EN_PROCESO_COMPRA' : accion === 'PRODUCCION' ? 'EN_PRODUCCION' : 'LISTO_DESPACHO',
          fechaEstimada: accion === 'PRODUCCION' ? fechaEstimada : undefined,
          comentario: comentario.trim() || undefined,
          cantidad: accion === 'RECIBIR' ? cantidadDe(p) : undefined,
        });
        hechos.push(p.id);
      } catch (e) {
        errores.push(`${codigoPendiente(p.numero)}: ${extraerErrorParaToast(e).mensaje}`);
      }
      setAvance({ hechos: i + 1, total: lista.length });
    }
    setAvance(null);
    enCurso.current = false;
    // En el modal quedan solo los que no avanzaron, para reintentar.
    setLote(lista.filter((p) => !hechos.includes(p.id)));
    for (const k of [['pendientes'], ['pendiente'], ['pendientesListos'], ['despachosObras'], ['misAprobacionesPendientes']]) queryClient.invalidateQueries({ queryKey: k });
    onHechos(hechos);
    if (errores.length === 0) {
      mostrarToast(hechos.length === 1 ? 'Pendiente actualizado.' : `${hechos.length} pendientes actualizados.`, { tipo: 'info' });
      cerrar();
    } else {
      setFallos(errores);
    }
  };

  if (seleccion.length === 0 && !accion) return null;
  const ocupado = avance !== null;
  const falta = accion === 'OC' ? !archivo : accion === 'PRODUCCION' ? !fechaEstimada : false;

  return (
    <>
      {seleccion.length > 0 && (
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-lg" role="region" aria-label="Pendientes seleccionados">
        <p className="text-xs text-slate-700 mr-auto">
          <b className="text-slate-900">{seleccion.length}</b> {seleccion.length === 1 ? 'seleccionado' : 'seleccionados'}
          {acciones.length === 0 && <span className="text-amber-700"> · están en pasos distintos: elige pendientes que vayan en el mismo paso para avanzarlos juntos.</span>}
        </p>
        {acciones.map((a) => (
          <Button
            key={a}
            size="sm"
            variant={a === 'PRODUCCION' ? 'outline' : 'primary'}
            leftIcon={a === 'OC' ? <FileUp className="w-3.5 h-3.5" /> : a === 'PRODUCCION' ? <Factory className="w-3.5 h-3.5" /> : <PackageCheck className="w-3.5 h-3.5" />}
            onClick={() => abrir(a)}
          >
            {TEXTO_ACCION[a].boton(seleccion.length)}
          </Button>
        ))}
        <Button size="sm" variant="ghost" leftIcon={<X className="w-3.5 h-3.5" />} onClick={onLimpiar}>
          Quitar selección
        </Button>
      </div>
      )}

      {accion && (
        <Modal
          ancho="md"
          titulo={TEXTO_ACCION[accion].titulo}
          subtitulo={`${lote.length} ${lote.length === 1 ? 'pendiente' : 'pendientes'}${obras > 1 ? ` de ${obras} obras` : ''}`}
          onClose={cerrar}
          cerrable={!ocupado}
          pie={
            <Modal.Pie>
              <Button variant="outline" disabled={ocupado} onClick={cerrar}>
                {fallos.length > 0 ? 'Cerrar' : 'Cancelar'}
              </Button>
              <Button variant="primary" disabled={falta || lote.length === 0} isLoading={ocupado} onClick={ejecutar}>
                {ocupado ? `${avance.hechos} de ${avance.total}…` : fallos.length > 0 ? 'Reintentar los que fallaron' : accion === 'OC' ? `Subir y pasar a «${ETIQUETA_PASO.EN_PROCESO_COMPRA}»` : accion === 'RECIBIR' ? 'Marcar recibidos' : accion === 'PRODUCCION' ? 'Pasar a producción' : 'Dejar listos para despacho'}
              </Button>
            </Modal.Pie>
          }
        >
          <div className="space-y-4">
            {fallos.length > 0 && (
              <Aviso tono="peligro" titulo={`${fallos.length === 1 ? 'Uno no avanzó' : `${fallos.length} no avanzaron`}; el resto quedó listo`}>
                <ul className="list-disc pl-4">
                  {fallos.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Aviso>
            )}

            {accion === 'OC' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  La misma orden de compra queda adjunta en cada pendiente{obras > 1 ? ', en la carpeta de OneDrive de su obra' : ' (carpeta de OneDrive de la obra)'}, y todos pasan a «{ETIQUETA_PASO.EN_PROCESO_COMPRA}».
                </p>
                <InputArchivo accept={ACCEPT_ADJUNTOS} onArchivos={(a) => setArchivo(a[0] ?? null)} etiqueta="Elegir la orden de compra">
                  {(abrir) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" leftIcon={<FileUp className="w-3.5 h-3.5" />} disabled={ocupado} onClick={abrir}>
                        {archivo ? 'Cambiar archivo' : 'Elegir la OC'}
                      </Button>
                      <span className="text-xs text-slate-600 truncate">{archivo ? archivo.name : 'PDF, imagen o documento'}</span>
                    </div>
                  )}
                </InputArchivo>
              </div>
            )}
            {accion === 'PRODUCCION' && (
              <div className="grid sm:grid-cols-[12rem_1fr] gap-3">
                <Input label="Fecha estimada" id="lote-fecha" type="date" min={hoyIso()} value={fechaEstimada} onChange={(e) => setFechaEstimada(e.target.value)} />
                <Textarea label="Comentarios (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={500} placeholder="Qué falta, qué se está esperando…" />
              </div>
            )}
            {accion === 'RECIBIR' && (
              <>
                <p className="text-xs text-slate-600">Indica cuántas llegaron de cada uno. Quedan en espera de despacho, para enviarlos desde Despachos; no entran a ninguna bodega ni mueven el stock.</p>
                <Textarea label="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={500} placeholder="Proveedor, guía, observaciones…" />
              </>
            )}
            {accion === 'LISTO' && <p className="text-xs text-slate-600">Quedan «{ETIQUETA_PASO.LISTO_DESPACHO}»: se despachan desde Despachos, en su obra.</p>}

            <ul className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {lote.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-xs text-slate-900 break-words">
                      <span className="font-mono font-bold text-slate-600">{codigoPendiente(p.numero)}</span> {p.descripcion}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {[p.proyecto?.obra, p.ventanaRef, p.agrupacion?.proveedor, accion !== 'RECIBIR' && p.cantidad ? `${p.cantidad} un` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {accion === 'RECIBIR' && (
                    <span className="flex items-center gap-2 shrink-0">
                      <ContadorTactil valor={cantidadDe(p)} onChange={(n) => setLlegaron((c) => ({ ...c, [p.id]: n }))} min={1} enteros disabled={ocupado} aria-label={`Cuántas llegaron de ${codigoPendiente(p.numero)}`} />
                      {p.cantidad ? <span className="text-[11px] text-slate-500 whitespace-nowrap">de {p.cantidad}</span> : null}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  );
};
