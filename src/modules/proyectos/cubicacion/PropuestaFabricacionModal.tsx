import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Factory } from 'lucide-react';
import { aplicarPropuestaCubicacionFabricacion, getPropuestaCubicacionFabricacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Segmentado } from '../../../components/ui/Segmentado';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { Cargando, ErrorCarga, EstadoVacio } from '../../../components/ui/Estados';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { Casilla, InputCompacto } from '../../../components/ui/Campos';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ConfianzaPropuesta, DocumentoPropuestaCubicacion, FilaPropuestaCubicacion, ReporteAplicacionPropuesta, VentanaPropuestaCubicacion } from '../../../types';
import { formatoMm, textoEstadoFabricacion, varianteEstadoFabricacion } from '../fabricacion/utils';
import { useVocabulario } from './useVocabulario';

interface Props {
  proyectoId: string;
  onClose: () => void;
  onAplicada: (reporte: ReporteAplicacionPropuesta) => void;
}

type Filtro = 'TODAS' | 'REVISAR' | 'SIN_POSICION';

// Lo que la persona puede corregir de cada ventana antes de aplicar.
interface FilaEditable {
  incluir: boolean;
  codigo: string;
  torre: string;
  piso: string;
  unidad: string;
  especial: boolean;
  ubicacion: string;
}

const ETIQUETA_CONFIANZA: Record<ConfianzaPropuesta, string> = { ALTA: 'Clara', MEDIA: 'Revisar', BAJA: 'Sin posición' };

const filaInicial = (v: VentanaPropuestaCubicacion): FilaEditable => ({
  incluir: true,
  codigo: v.codigo,
  torre: v.torre,
  piso: v.piso === null ? '' : String(v.piso),
  unidad: v.unidad ?? '',
  especial: v.especial,
  ubicacion: v.ubicacion ?? '',
});

// Vista previa del nombre con el formato de la obra (el definitivo lo arma la API al aplicar, con los "-2" si se repite).
const previa = (formato: string, f: FilaEditable): string | null => {
  if (!f.unidad.trim()) return null;
  const sinEspacios = (t: string) => t.replace(/\s+/g, '');
  return formato
    .replace('{codigo}', f.codigo.trim().toUpperCase())
    .replace('{nombreUnidad}', sinEspacios(f.unidad.trim()))
    .replace('{torre}', sinEspacios(f.torre.trim().toUpperCase()))
    .replace(/_{2,}/g, '_');
};

/**
 * Cubicar una obra legacy desde sus documentos de fabricación: el sistema propone tipo, torre,
 * piso y departamento de cada ventana del lote (leyendo su modelo y el nombre del documento);
 * aquí se revisa, se corrige lo que no calzó y se aplica. Las ventanas quedan cubicadas,
 * vinculadas a su documento y rectificadas con la medida con que se fabricaron.
 */
export const PropuestaFabricacionModal: React.FC<Props> = ({ proyectoId, onClose, onAplicada }) => {
  const queryClient = useQueryClient();
  const voc = useVocabulario(proyectoId);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['propuestaFabricacion', proyectoId], queryFn: () => getPropuestaCubicacionFabricacion(proyectoId) });
  const [filas, setFilas] = useState<Record<string, FilaEditable> | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());

  // Estado editable, armado una sola vez a partir de la propuesta.
  const edicion = useMemo(() => {
    if (filas) return filas;
    if (!data) return {};
    return Object.fromEntries(data.documentos.flatMap((d) => d.ventanas.map((v) => [v.fabricacionVentanaId, filaInicial(v)])));
  }, [data, filas]);
  // Si la propuesta se vuelve a leer con la ventana abierta, una fila nueva parte de lo que propone el sistema.
  const filaDe = (v: VentanaPropuestaCubicacion): FilaEditable => edicion[v.fabricacionVentanaId] ?? filaInicial(v);
  const editar = (id: string, cambio: Partial<FilaEditable>) => setFilas({ ...edicion, [id]: { ...edicion[id], ...cambio } });

  const aplicar = useMutation({
    mutationFn: () => {
      const ventanas: FilaPropuestaCubicacion[] = Object.entries(edicion)
        .filter(([, f]) => f.incluir)
        .map(([id, f]) => ({
          fabricacionVentanaId: id,
          codigo: f.codigo.trim().toUpperCase(),
          torre: f.torre.trim().toUpperCase(),
          piso: f.piso.trim() === '' ? null : Number(f.piso),
          unidad: f.unidad.trim() || null,
          especial: f.especial,
          ubicacion: f.ubicacion.trim() || null,
        }));
      return aplicarPropuestaCubicacionFabricacion(proyectoId, ventanas);
    },
    onSuccess: ({ reporte }) => {
      queryClient.invalidateQueries({ queryKey: ['propuestaFabricacion', proyectoId] });
      onAplicada(reporte);
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const incluidas = Object.values(edicion).filter((f) => f.incluir);
  const invalidas = incluidas.filter((f) => !f.codigo.trim() || (f.piso.trim() !== '' && !/^-?\d{1,3}$/.test(f.piso.trim()))).length;
  const sinPosicion = incluidas.filter((f) => !f.unidad.trim()).length;

  const pasaFiltro = (v: VentanaPropuestaCubicacion, f: FilaEditable) =>
    filtro === 'TODAS' ? true : filtro === 'SIN_POSICION' ? !f.unidad.trim() : v.confianza !== 'ALTA';

  const alternarDoc = (id: string) =>
    setCerrados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const alternarTodas = (doc: DocumentoPropuestaCubicacion, incluir: boolean) => {
    const siguiente = { ...edicion };
    for (const v of doc.ventanas) siguiente[v.fabricacionVentanaId] = { ...filaDe(v), incluir };
    setFilas(siguiente);
  };

  const pie = (
    <Modal.Pie>
      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        Cancelar
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={incluidas.length === 0 || invalidas > 0}
        isLoading={aplicar.isPending}
        onClick={() => aplicar.mutate()}
        title={invalidas > 0 ? 'Hay filas sin código o con un piso que no es un número.' : undefined}
      >
        Cubicar {incluidas.length} ventana(s)
      </Button>
    </Modal.Pie>
  );

  return (
    <Modal titulo="Cubicar desde los documentos de fabricación" subtitulo={data ? `${data.resumen.ventanas} ventana(s) fabricada(s) todavía sin cubicar` : undefined} icono={Factory} ancho="completo" onClose={onClose} pie={pie}>
      {isLoading ? (
        <Cargando texto="Leyendo los documentos de fabricación…" />
      ) : isError || !data ? (
        <ErrorCarga que="la propuesta" onReintentar={refetch} />
      ) : data.documentos.length === 0 ? (
        <EstadoVacio icono={Factory} titulo="No hay ventanas por cubicar" descripcion="Todas las ventanas de los documentos vinculados ya están en la cubicación, o la obra no tiene documentos de fabricación todavía (Fases y documentos › Vincular documentos)." />
      ) : (
        <div className="space-y-4">
          <Aviso tono="info" titulo="Revisa antes de aplicar">
            El sistema leyó el modelo de cada ventana del lote (por ejemplo «2115 V02») y el nombre del documento («EX_P21») para proponer el tipo, {voc.elContenedor}, el piso y el{' '}
            {voc.unidad}. Corrige lo que no calce y desmarca lo que no quieras cubicar. Cada ventana queda vinculada a su documento y rectificada con la medida con que se fabricó; el nombre final
            sigue el formato <span className="font-mono">{data.formatoNomenclatura}</span>.
          </Aviso>

          {data.tipos.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Tipos de ventana propuestos">
              {data.tipos.map((t) => (
                <Badge key={t.codigo} size="sm" variant={t.existente ? 'outline' : 'brand'} title={`${t.sistema} · ${formatoMm(t.anchoMm)} × ${formatoMm(t.altoMm)} mm${t.cuadros !== null ? ` · ${t.cuadros} hoja(s)` : ''}`}>
                  {t.codigo} · {t.ventanas}
                  {t.existente ? ' · ya existe' : ''}
                </Badge>
              ))}
            </div>
          )}

          <Segmentado
            etiqueta="Filtrar ventanas"
            valor={filtro}
            onChange={setFiltro}
            opciones={[
              { value: 'TODAS' as Filtro, label: 'Todas', contador: data.resumen.ventanas },
              { value: 'REVISAR' as Filtro, label: 'Por revisar', contador: data.resumen.porRevisar },
              { value: 'SIN_POSICION' as Filtro, label: 'Sin posición', contador: sinPosicion },
            ]}
          />

          {data.documentos.map((doc) => {
            const visibles = doc.ventanas.filter((v) => pasaFiltro(v, filaDe(v)));
            if (visibles.length === 0 && filtro !== 'TODAS') return null;
            const abierto = !cerrados.has(doc.fabricacionId);
            const marcadas = doc.ventanas.filter((v) => filaDe(v).incluir).length;
            const pista = [doc.pistas.torre ? `${voc.contenedor} ${doc.pistas.torre}` : null, doc.pistas.piso !== null ? `piso ${doc.pistas.piso}` : null].filter(Boolean).join(', ');
            return (
              <div key={doc.fabricacionId} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-3 py-2 flex flex-wrap items-center gap-2 bg-slate-50/70 border-b border-slate-100">
                  <BotonColapsar abierto={abierto} onClick={() => alternarDoc(doc.fabricacionId)} className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">{doc.nombre || doc.descripcion || `Documento ${doc.hetmoId}`}</span>
                      <Badge size="sm" variant={varianteEstadoFabricacion(doc.estadoHetmo)}>
                        {textoEstadoFabricacion(doc.estadoHetmo, doc.estadoGlosa)}
                      </Badge>
                      <span className="text-[11px] text-slate-500 font-mono">
                        N° {doc.numero ?? '—'} · {marcadas}/{doc.ventanas.length} ventana(s)
                        {pista ? ` · leído de «${doc.descripcion}»: ${pista}` : ''}
                      </span>
                    </span>
                  </BotonColapsar>
                  <Casilla checked={marcadas === doc.ventanas.length} onChange={(v) => alternarTodas(doc, v)} label="Todas" aria-label={`Incluir todas las ventanas de ${doc.nombre ?? doc.descripcion ?? doc.hetmoId}`} />
                </div>
                {abierto && (
                  <Tabla ajustada>
                    <Thead>
                      <Tr>
                        <Th className="w-8"></Th>
                        <Th alinear="derecha">Pos</Th>
                        <Th>Modelo HETMO</Th>
                        <Th>Medida</Th>
                        <Th>Código</Th>
                        <Th>{voc.contenedor}</Th>
                        <Th>Piso</Th>
                        <Th>{voc.unidadCorta}</Th>
                        <Th>Ubicación</Th>
                        <Th>Nombre</Th>
                        <Th>Lectura</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {visibles.map((v) => {
                        const f = filaDe(v);
                        const id = v.fabricacionVentanaId;
                        const nombre = previa(data.formatoNomenclatura, f);
                        return (
                          <Tr key={id} tono={!f.incluir ? 'atenuada' : v.confianza === 'BAJA' ? 'peligro' : v.confianza === 'MEDIA' ? 'advertencia' : undefined}>
                            <Td>
                              <Casilla checked={f.incluir} onChange={(incluir) => editar(id, { incluir })} aria-label={`Incluir ${v.modelo}`} />
                            </Td>
                            <Td alinear="derecha" numero>
                              {v.orden}
                            </Td>
                            <Td mono fuerte className="whitespace-nowrap">
                              {v.modelo}
                              {v.unidades > 1 && <span className="ml-1 text-slate-400 font-sans">× {v.unidades}</span>}
                              {v.descripcionCorta && <div className="text-[10px] font-sans font-normal text-slate-500 truncate max-w-[12rem]">{v.descripcionCorta}</div>}
                            </Td>
                            <Td numero className="whitespace-nowrap">
                              {formatoMm(v.anchoMm)} × {formatoMm(v.altoMm)}
                            </Td>
                            <Td>
                              <InputCompacto value={f.codigo} onChange={(e) => editar(id, { codigo: e.target.value })} aria-label="Código del tipo" className="w-20 font-mono" maxLength={20} />
                            </Td>
                            <Td>
                              <InputCompacto value={f.torre} onChange={(e) => editar(id, { torre: e.target.value })} aria-label={voc.contenedor} className="w-14 font-mono" maxLength={10} />
                            </Td>
                            <Td>
                              <InputCompacto value={f.piso} onChange={(e) => editar(id, { piso: e.target.value })} aria-label="Piso" className="w-14 font-mono" inputMode="numeric" disabled={f.especial} />
                            </Td>
                            <Td>
                              <InputCompacto value={f.unidad} onChange={(e) => editar(id, { unidad: e.target.value })} aria-label={voc.unidad} className="w-20 font-mono" maxLength={30} />
                            </Td>
                            <Td>
                              <InputCompacto value={f.ubicacion} onChange={(e) => editar(id, { ubicacion: e.target.value })} aria-label="Ubicación" className="w-24" maxLength={40} />
                            </Td>
                            <Td mono className="whitespace-nowrap text-slate-600">
                              {nombre ?? <span className="text-amber-700 font-sans">sin posición</span>}
                            </Td>
                            <Td>
                              <Badge size="sm" variant={v.confianza === 'ALTA' ? 'success' : v.confianza === 'MEDIA' ? 'warning' : 'danger'} title={v.avisos.join(' ') || 'Modelo y documento leídos sin dudas.'}>
                                {ETIQUETA_CONFIANZA[v.confianza]}
                              </Badge>
                              {f.especial && (
                                <Badge size="sm" variant="outline" className="ml-1" title="Unidad sin piso (área común, fachada…)">
                                  sin piso
                                </Badge>
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Tabla>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
