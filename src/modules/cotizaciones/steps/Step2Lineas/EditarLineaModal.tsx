import React, { useMemo, useState } from 'react';
import { Maximize2, DoorClosed, Paintbrush, Boxes, Plus, Repeat, Trash2, FlipHorizontal2, FlipHorizontal, Sliders, Rows3, Sparkles } from 'lucide-react';
import type { CorreccionTravesano, MaterialVentana, Ventana } from '../../../../types';
import { formatNumber } from '../../../../lib/utils';
import { WindowRendererSvg } from '../../components/drawing/WindowRendererSvg';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import { createFinish, getAcabadoLabel } from '../../components/drawing/colorSystem';
import * as core from '../../components/drawing/geometryCore';
import { addVentanaMaterial, reemplazarVentanaMaterial, eliminarVentanaMaterial } from '../../../../api/client';
import { MaterialLineaForm, type MaterialLineaFormPayload } from './MaterialLineaForm';
import { CorrederaEditor, type CorrederaDraft } from './CorrederaEditor';
import { TravesanosEditor } from './TravesanosEditor';
import { correccionConCambios } from './correccionDibujo';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../../components/ui/Tabla';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { BotonAlternar } from '../../../../components/ui/BotonAlternar';
import { BotonColapsar } from '../../../../components/ui/BotonColapsar';
import { useConfirmar } from '../../../../components/ui/Confirmar';

interface EditarLineaModalProps {
  ventana: Ventana;
  onClose: () => void;
  /** La línea acaba de cambiar (material, dibujo...): el padre debe refrescar su copia. El modal sigue abierto -- no es un cierre. */
  onUpdated: (updated: Ventana) => void;
  onEspejar: (ventana: Ventana) => void;
  isEspejando: boolean;
  onInvertirMano: (ventana: Ventana) => void;
  isInvirtiendoMano: boolean;
}

type EditMode = { type: 'add' } | { type: 'replace'; row: MaterialVentana } | null;

const familyBadgeColors: Record<string, string> = {
  Perfileria: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Herrajes: 'bg-amber-50 text-amber-700 border-amber-200',
  Juntas: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Vidrios: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Refuerzos: 'bg-purple-50 text-purple-700 border-purple-200',
  Superficies: 'bg-rose-50 text-rose-700 border-rose-200',
  Accesorios: 'bg-slate-100 text-slate-700 border-slate-200',
  Otros: 'bg-slate-100 text-slate-700 border-slate-200',
};

/**
 * Edición de UNA línea: el dibujo (espejar, mano, orden, corredera,
 * travesaños) se modifica en vivo sobre el esquema de la izquierda, que no
 * se mueve con el scroll; a la derecha, el despiece de materiales con
 * edición (agregar un ítem del maestro, reemplazar uno HETMO por otro, o
 * deshacer cualquiera de los dos). Cada fila queda ligada a esta línea
 * (ventanaId) para que la Analítica de Materiales y, más adelante, las
 * listas de materiales por fase de fabricación, la hereden automáticamente
 * -- ver comentarios en mtw-api/src/index.ts (sección "MATERIALES
 * PERSONALIZADOS POR LINEA").
 *
 * Solo una sección abierta a la vez, y la abierta pasa a ser la primera de
 * la lista para leerla sin bajar.
 */
export const EditarLineaModal: React.FC<EditarLineaModalProps> = ({
  ventana,
  onClose,
  onUpdated,
  onEspejar,
  isEspejando,
  onInvertirMano,
  isInvirtiendoMano,
}) => {
  const { confirmar } = useConfirmar();
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [corrDraft, setCorrDraft] = useState<CorrederaDraft | null>(null);
  const [travDraft, setTravDraft] = useState<CorreccionTravesano[] | null>(null);
  // Se incrementa al guardar para remontar el editor con lo recién guardado.
  const [corrKey, setCorrKey] = useState(0);
  const [travKey, setTravKey] = useState(0);

  const v = ventana;
  const sup = v.m2Ventana ?? ((v.anchoMm * v.altoMm) / 1_000_000);
  const wLine = toWindowLine(v);
  const finish = createFinish(wLine?.acabadoCodigo, wLine?.acabadoDescripcion, wLine?.acabadoPatron);
  const finishLabel = getAcabadoLabel(v.acabadoCodigo, v.acabadoDescripcion);
  const esProtex = v.tipoLineaManual === 'PROTEX';
  const isFrameless = Boolean(wLine?.dibujoSinMarco);
  const isSliding = wLine ? core.isSlidingLine(wLine) : false;
  // Solo si alguna apertura original de HETMO tiene código espejo (practicables,
  // puertas...); se mira la original, no la ya invertida, para poder volver atrás.
  const puedeInvertirMano = useMemo(() => {
    if (!wLine || isSliding || esProtex) return false;
    const base = toWindowLine({ ...v, correccionGeometria: null });
    return Boolean(base && core.sourceComponents(base).some((c: { apertura: number }) => core.mirroredAperture(c.apertura) != null));
  }, [wLine, isSliding, esProtex, v]);

  // Dibujo en vivo: lo guardado + los borradores sin guardar de cada editor.
  const preview = useMemo<Ventana>(() => {
    let p: Ventana = v;
    if (corrDraft) {
      p = {
        ...p,
        dibujoTipoApertura: corrDraft.apertura,
        correccionGeometria: {
          ...p.correccionGeometria,
          esquema: 2,
          lineaHetmo: p.lineaHetmo,
          apertura: corrDraft.apertura,
          hojas: corrDraft.hojas,
        },
      };
    }
    if (travDraft) p = { ...p, correccionGeometria: correccionConCambios(p, { travesanos: travDraft }) ?? undefined };
    return p;
  }, [v, corrDraft, travDraft]);
  const apLabel = (() => {
    if (esProtex) return 'Puerta Protex';
    const line = toWindowLine(preview);
    return line ? core.apertureLabel(line) : v.modelo || '—';
  })();
  const sinGuardar = Boolean(corrDraft || travDraft);

  const handleClose = async () => {
    if (sinGuardar && !(await confirmar({ titulo: 'Hay cambios del dibujo sin guardar', mensaje: '¿Cerrar y descartarlos?', confirmar: 'Descartar', peligro: true }))) return;
    onClose();
  };

  const mats = v.materiales || [];
  // Agrupado por partida (la del tipo de producto de cada material), en el
  // orden configurado en Configuración > Catálogo.
  const groupedFamilies = mats.reduce<Record<string, typeof mats>>((acc, item) => {
    const fam = item.material?.tipoProducto?.partida?.nombre || item.material?.familia || 'Otros';
    if (!acc[fam]) acc[fam] = [];
    acc[fam].push(item);
    return acc;
  }, {});
  const ordenPartida = (fam: string) => groupedFamilies[fam][0]?.material?.tipoProducto?.partida?.orden ?? Number.MAX_SAFE_INTEGER;
  const sortedFamilyKeys = Object.keys(groupedFamilies).sort((a, b) => ordenPartida(a) - ordenPartida(b) || a.localeCompare(b));

  const handleAdd = async (payload: MaterialLineaFormPayload) => {
    const result = await addVentanaMaterial(v.id, payload);
    if (!result.success || !result.data) {
      throw new Error('No se pudo agregar el material en el servidor.');
    }
    onUpdated(result.data);
    setEditMode(null);
  };

  const handleReplace = async (row: MaterialVentana, payload: MaterialLineaFormPayload) => {
    const result = await reemplazarVentanaMaterial(v.id, {
      materialIdOriginal: row.materialId,
      materialIdNuevo: payload.materialId,
      cantidad: payload.cantidad,
      piezas: payload.piezas,
      acabado: payload.acabado,
    });
    if (!result.success || !result.data) {
      throw new Error('No se pudo reemplazar el material en el servidor.');
    }
    onUpdated(result.data);
    setEditMode(null);
  };

  const handleRemove = async (row: MaterialVentana) => {
    const mensaje = row.reemplazaMaterialId
      ? '¿Deshacer este reemplazo? Vuelve a mostrarse el material HETMO original de esta línea.'
      : '¿Quitar este material de la línea?';
    if (!(await confirmar({ titulo: mensaje, confirmar: row.reemplazaMaterialId ? 'Deshacer' : 'Quitar', peligro: true }))) return;
    setRemoveError(null);
    setRemovingId(row.id);
    try {
      const result = await eliminarVentanaMaterial(v.id, row.id);
      if (!result.success || !result.data) {
        setRemoveError('No se pudo quitar el material en el servidor.');
        return;
      }
      onUpdated(result.data);
    } catch (err: any) {
      setRemoveError(err?.response?.data?.error || err.message || 'Error al quitar el material.');
    } finally {
      setRemovingId(null);
    }
  };

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  // La sección abierta pasa a ser la primera (order -1). Con keepMounted los
  // editores siguen montados al cerrarse para no perder su borrador.
  const sectionShell = (id: string, header: React.ReactNode, body: React.ReactNode, keepMounted = false) => {
    const open = openId === id;
    return (
      <section
        key={id}
        style={{ order: open ? -1 : 0 }}
        className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden shrink-0"
      >
        <BotonColapsar abierto={open} onClick={() => toggle(id)} className="w-full flex-nowrap! px-4 py-3 bg-slate-50/80 hover:bg-slate-100/80 select-none transition-colors">
          {header}
        </BotonColapsar>
        {(open || keepMounted) && (
          <div className={`p-3 border-t border-slate-100 bg-white ${open ? '' : 'hidden'}`}>{body}</div>
        )}
      </section>
    );
  };

  return (
    <Modal
      ancho="completo"
      titulo={
        <>
          Editar línea: <span className="text-brand-600">{v.modelo}</span>
        </>
      }
      subtitulo={`Línea #${v.lineaHetmo} · ${v.unidades} ${v.unidades === 1 ? 'unidad' : 'unidades'} (${formatNumber(v.anchoMm, 0)} × ${formatNumber(v.altoMm, 0)} mm)`}
      onClose={handleClose}
      cuerpoClassName="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 bg-slate-50/30"
      pie={
        <Modal.Pie inicio={`Total ${mats.length} materiales en ${sortedFamilyKeys.length} partidas`}>
          <Button variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
        </Modal.Pie>
      }
    >
        {/* Cuerpo: izquierda fija, derecha con scroll propio */}
          {/* COLUMNA IZQUIERDA: dibujo en vivo y ficha técnica (no corre con el scroll) */}
          <div className="lg:col-span-5 lg:h-full lg:min-h-0 flex flex-col">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col gap-4 lg:h-full lg:min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vista en Vivo</span>
                </span>
                {sinGuardar && <span className="text-[11px] font-bold text-amber-600">Cambios sin guardar</span>}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-center border border-slate-100 h-56 sm:h-72 lg:h-auto lg:flex-1 lg:min-h-0 overflow-hidden">
                <WindowRendererSvg ventana={preview} className="w-full h-full max-h-full" />
              </div>

              <div className="space-y-3 pt-1 text-xs shrink-0">
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Maximize2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)} mm</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end text-sm">
                    <span className="text-slate-400">Área:</span>
                    <span className=" font-bold text-slate-900">{formatNumber(sup, 2)} m²</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <DoorClosed className="w-3.5 h-3.5" />
                    <span>Apertura</span>
                  </div>
                  <p className="font-bold text-slate-900 text-xs mt-0.5">{apLabel}</p>
                </div>

                {!isFrameless && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <Paintbrush className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Acabado:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-slate-50 text-slate-800">
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-300 shadow-inner shrink-0" style={{ backgroundColor: finish.frame }} />
                      <span>{finishLabel}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: herramientas fijas arriba, secciones con scroll */}
          <div className="lg:col-span-7 lg:h-full lg:min-h-0 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <BotonAlternar activo={!!(v.espejado)} onClick={() => onEspejar(v)} cargando={isEspejando} icono={FlipHorizontal2} title="Espejar el dibujo horizontalmente (para ventanas que salen al revés en HETMO)">
                   {v.espejado ? 'Espejada' : 'Espejar'}
                 </BotonAlternar>
                {puedeInvertirMano && (
                  <BotonAlternar activo={!!(v.correccionGeometria?.invertirMano)} onClick={() => onInvertirMano(v)} cargando={isInvirtiendoMano} icono={FlipHorizontal} title="Invertir la mano de la apertura (bisagras y manilla al lado contrario); no espeja el resto del dibujo">
                     {v.correccionGeometria?.invertirMano ? 'Mano invertida' : 'Invertir mano'}
                   </BotonAlternar>
                )}
              </div>
              <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditMode(editMode?.type === 'add' ? null : { type: 'add' })}>
                Agregar material
              </Button>
            </div>

            {editMode?.type === 'add' && (
              <div className="shrink-0">
                <MaterialLineaForm title="Agregar material a esta línea" onCancel={() => setEditMode(null)} onConfirm={handleAdd} />
              </div>
            )}

            {removeError && (
              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 shrink-0">{removeError}</div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-1">
              {isSliding &&
                sectionShell(
                  'corredera',
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Sliders className="w-4 h-4 text-slate-500" />
                    Apertura de corredera
                    {v.correccionGeometria?.hojas?.length ? <span className="text-[10px] text-brand-600">· ajustada</span> : null}
                  </span>,
                  <CorrederaEditor
                    key={corrKey}
                    ventana={v}
                    onDraftChange={setCorrDraft}
                    onSaved={(updated) => {
                      onUpdated(updated);
                      setCorrKey((k) => k + 1);
                    }}
                  />,
                  true
                )}

              {!esProtex &&
                sectionShell(
                  'travesanos',
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Rows3 className="w-4 h-4 text-slate-500" />
                    Travesaños
                    {v.correccionGeometria?.travesanos?.length ? (
                      <span className="text-[10px] text-brand-600">· {v.correccionGeometria.travesanos.length} manuales</span>
                    ) : null}
                  </span>,
                  <TravesanosEditor
                    key={travKey}
                    ventana={v}
                    onDraftChange={setTravDraft}
                    onSaved={(updated) => {
                      onUpdated(updated);
                      setTravKey((k) => k + 1);
                    }}
                  />,
                  true
                )}

              {mats.length > 0 ? (
                sortedFamilyKeys.map((fam) => {
                  const items = groupedFamilies[fam];
                  const totalUds = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
                  const badgeStyle = familyBadgeColors[fam] || familyBadgeColors.Otros;
                  return sectionShell(
                    `fam:${fam}`,
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${badgeStyle}`}>{fam}</span>
                      <span className="text-xs font-bold text-slate-800">
                        {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">{formatNumber(totalUds, 0)} uds</span>
                    </div>,
                    <Tabla>
                          <Thead>
                            <Tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                              <Th className="pb-2 px-2">SKU / Insumo</Th>
                              <Th alinear="derecha" className="pb-2 px-2">Cant. / Longitud</Th>
                              <Th alinear="centro" className="pb-2 px-2">Acabado</Th>
                              <Th alinear="derecha" className="pb-2 px-2">Acciones</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {items.map((m, idx) => (
                              <React.Fragment key={m.id || idx}>
                                <Tr className="hover:bg-slate-50/80 transition-colors">
                                  <Td className="px-2 align-top">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-slate-900 font-mono text-[11px]">
                                        {m.material?.skuInterno || '—'}
                                      </span>
                                      {m.origen === 'PERSONALIZADO' && (
                                        <span
                                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200"
                                          title={m.reemplazaMaterialId ? 'Reemplaza un material HETMO de esta línea' : 'Agregado manualmente a esta línea'}
                                        >
                                          Manual
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-slate-600 text-[11px] leading-tight">
                                      {m.material?.descripcion || 'Material de fabricación'}
                                    </div>
                                  </Td>
                                  <Td alinear="derecha" className="px-2 align-top whitespace-nowrap">
                                    <div className="font-bold text-slate-800">
                                      {Number(m.cantidad || 1).toLocaleString('es-CL')} un
                                    </div>
                                    {m.longitudMm && (
                                      <div className="text-[10px] text-slate-400">
                                        {Number(m.longitudMm).toLocaleString('es-CL')} mm
                                      </div>
                                    )}
                                  </Td>
                                  <Td alinear="centro" className="px-2 align-top text-[11px] whitespace-nowrap">
                                    {m.acabado ? (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                        {m.acabado}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </Td>
                                  <Td alinear="derecha" className="px-2 align-top whitespace-nowrap">
                                    {m.origen === 'HETMO' ? (
                                      <Button size="sm" variant="ghost" leftIcon={<Repeat className="w-3 h-3" />} title="Reemplazar por otro material del maestro" onClick={() => setEditMode(editMode?.type === 'replace' && editMode.row.id === m.id ? null : { type: 'replace', row: m })}>
                                         Reemplazar
                                       </Button>
                                    ) : (
                                      <Button size="sm" variant="ghost" className="hover:text-rose-700! hover:bg-rose-50!" leftIcon={<Trash2 className="w-3 h-3" />} isLoading={removingId === m.id} title={m.reemplazaMaterialId ? 'Deshacer reemplazo' : 'Quitar de la línea'} onClick={() => handleRemove(m)}>
                                         Quitar
                                       </Button>
                                    )}
                                  </Td>
                                </Tr>
                                {editMode?.type === 'replace' && editMode.row.id === m.id && (
                                  <Tr>
                                    <Td colSpan={4} className="px-2">
                                      <MaterialLineaForm
                                        title={`Reemplazar "${m.material?.descripcion || m.material?.skuInterno}"`}
                                        initialCantidad={Number.isFinite(Number(m.cantidad)) ? Number(m.cantidad) : undefined}
                                        initialPiezas={m.piezas}
                                        initialAcabado={m.acabado}
                                        onCancel={() => setEditMode(null)}
                                        onConfirm={(payload) => handleReplace(m, payload)}
                                      />
                                    </Td>
                                  </Tr>
                                )}
                              </React.Fragment>
                            ))}
                          </Tbody>
                        </Tabla>
                  );
                })
              ) : (
                <div className="p-5 rounded-2xl bg-white border border-slate-200 text-slate-600 space-y-2 text-xs text-center shrink-0">
                  <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-800">Sin despiece individual</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Esta tipología no registra lista de corte por pieza en esta revisión. El análisis consolidado de insumos está disponible en el Paso 3.
                  </p>
                </div>
              )}
            </div>
          </div>
    </Modal>
  );
};
