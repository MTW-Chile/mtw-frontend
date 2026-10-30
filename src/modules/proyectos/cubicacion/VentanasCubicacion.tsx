import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { editarUnidadCubicacion, eliminarUnidadCubicacion, getUbicacionesCubicacion, getUnidadesCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ConfigCubicacion, TipoCubicacion, UnidadCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { leerMilimetros } from '../pendientes/utils';
import { UnidadModal } from './UnidadModal';
import { formatoMonto, mmATexto } from './utils';
import { vocabulario } from './vocabulario';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { IconButton } from '../../../components/ui/IconButton';
import { Casilla, InputCompacto, SelectCompacto } from '../../../components/ui/Campos';
import { Buscador } from '../../../components/ui/Buscador';

export interface FiltroVentanas {
  pisoId: string;
  torreId: string;
}

interface Props {
  proyectoId: string;
  cubicacion: ConfigCubicacion;
  moneda: string | null;
  tipos: TipoCubicacion[];
  filtro: FiltroVentanas;
  onFiltro: (f: FiltroVentanas) => void;
  /** Obra legacy: las medidas son finales (del documento de fabricación); sin rasgo ni rectificación. */
  legacy?: boolean;
}

const aviso = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

// Una fila: el rasgo (lo medido en obra) se escribe ahi mismo y se guarda al salir del campo, con ancho
// y alto juntos. La medida de fabricacion (rasgo - holgura) la calcula el servidor.
const FilaVentana: React.FC<{ unidad: UnidadCubicacion; onEditar: () => void; onEliminar: () => void; proyectoId: string; legacy?: boolean }> = ({ unidad, onEditar, onEliminar, proyectoId, legacy }) => {
  const queryClient = useQueryClient();
  const [ancho, setAncho] = useState(mmATexto(unidad.rasgoAnchoMm));
  const [alto, setAlto] = useState(mmATexto(unidad.rasgoAltoMm));
  const [ubicacion, setUbicacion] = useState(unidad.ubicacion ?? '');

  // La ubicación (recinto: Dormitorio 1, Living...) también se escribe en la fila y se guarda al salir del campo.
  const guardarUbicacion = useMutation({
    mutationFn: (texto: string) => editarUnidadCubicacion(unidad.id, { ubicacion: texto.trim() || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyectoId] }),
    onError: (e) => {
      aviso(e);
      setUbicacion(unidad.ubicacion ?? '');
    },
  });
  const salirUbicacion = () => {
    if (ubicacion.trim() !== (unidad.ubicacion ?? '')) guardarUbicacion.mutate(ubicacion);
  };

  const guardar = useMutation({
    mutationFn: (datos: { rasgoAnchoMm: number | null; rasgoAltoMm: number | null }) => editarUnidadCubicacion(unidad.id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] });
    },
    onError: (e) => {
      aviso(e);
      setAncho(mmATexto(unidad.rasgoAnchoMm));
      setAlto(mmATexto(unidad.rasgoAltoMm));
    },
  });

  const anchoNum = leerMilimetros(ancho);
  const altoNum = leerMilimetros(alto);
  const incompleto = (ancho.trim() === '') !== (alto.trim() === '');
  const invalido = incompleto || (ancho.trim() !== '' && anchoNum === null) || (alto.trim() !== '' && altoNum === null);

  const intentarGuardar = () => {
    if (invalido) return; // se marca en rojo; no se manda nada a medias
    if (ancho.trim() === '' && alto.trim() === '') {
      if (unidad.rasgoAnchoMm !== null) guardar.mutate({ rasgoAnchoMm: null, rasgoAltoMm: null });
      return;
    }
    if (anchoNum === unidad.rasgoAnchoMm && altoNum === unidad.rasgoAltoMm) return;
    guardar.mutate({ rasgoAnchoMm: anchoNum, rasgoAltoMm: altoNum });
  };
  const alSalir = (e: React.FocusEvent<HTMLDivElement>) => {
    // Solo cuando el foco sale de AMBOS campos (no al pasar del ancho al alto).
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) intentarGuardar();
  };

  return (
    <Tr className="border-b border-slate-50 hover:bg-slate-50/60 align-middle">
      <Td className="whitespace-nowrap">
        {unidad.nomenclatura ? (
          <span className="font-mono font-bold text-xs text-slate-800">{unidad.nomenclatura}</span>
        ) : (
          <span className="font-mono text-xs text-slate-400" title="Aún sin unidad asignada ni cubicación única">
            {unidad.codigo} <Badge size="sm" variant="outline">sin nomenclatura</Badge>
          </span>
        )}
      </Td>
      <Td>
        <InputCompacto
          aria-label={`Ubicación de ${unidad.nomenclatura ?? unidad.codigo}`}
          placeholder="Ej. Dormitorio 1"
          maxLength={100}
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          onBlur={salirUbicacion}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="min-w-[8rem]"
        />
      </Td>
      <Td className="text-[11px] text-slate-500 max-w-[14rem] truncate" title={unidad.sistema}>
        {unidad.sistema}
      </Td>
      {legacy ? (
        <>
          <Td className="text-[11px] text-slate-500 max-w-[12rem] truncate" title={unidad.documento?.nombre}>
            {unidad.documento?.nombre ?? <span className="text-slate-300">—</span>}
          </Td>
          <Td className="text-xs font-mono font-bold text-slate-800 whitespace-nowrap">
            {unidad.anchoFabricacionMm != null ? `${formatoMm(unidad.anchoFabricacionMm)} × ${formatoMm(unidad.altoFabricacionMm)}` : `${formatoMm(unidad.anchoPlanoMm)} × ${formatoMm(unidad.altoPlanoMm)}`}
          </Td>
        </>
      ) : (
      <>
      <Td className="text-xs font-mono text-slate-500 whitespace-nowrap">
        {formatoMm(unidad.anchoPlanoMm)} × {formatoMm(unidad.altoPlanoMm)}
      </Td>
      <Td onBlur={alSalir}>
        <div className="flex items-center gap-1 min-w-[10rem]">
          <InputCompacto aria-label={`Rasgo ancho de ${unidad.nomenclatura ?? unidad.codigo}`} inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), intentarGuardar())} placeholder="ancho" className={`${invalido ? 'border-rose-300' : ''}`} />
          <span className="text-slate-300">×</span>
          <InputCompacto aria-label={`Rasgo alto de ${unidad.nomenclatura ?? unidad.codigo}`} inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), intentarGuardar())} placeholder="alto" className={`${invalido ? 'border-rose-300' : ''}`} />
          {guardar.isPending && <Loader2 className="w-3 h-3 animate-spin text-slate-400 shrink-0" />}
        </div>
      </Td>
      <Td className="text-xs font-mono whitespace-nowrap">
        {unidad.rectificada ? (
          <span className="font-bold text-emerald-700" title={`Rasgo − ${unidad.holguraMm} mm${unidad.rectificadoPor ? ` · ${unidad.rectificadoPor}` : ''}`}>
            {formatoMm(unidad.anchoFabricacionMm)} × {formatoMm(unidad.altoFabricacionMm)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </Td>
      </>
      )}
      <Td alinear="derecha" className="text-xs font-mono text-slate-500 whitespace-nowrap">{unidad.m2 != null ? unidad.m2.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '—'}</Td>
      <Td alinear="derecha" className="whitespace-nowrap">
        <IconButton icono={Pencil} etiqueta={`Editar ${unidad.nomenclatura ?? unidad.codigo}`} tono="marca" onClick={onEditar} />
        <IconButton icono={Trash2} etiqueta={`Eliminar ${unidad.nomenclatura ?? unidad.codigo}`} tono="peligro" onClick={onEliminar} />
      </Td>
    </Tr>
  );
};

// Ventanas fisicas de la cubicacion (por torre / piso / depto) y sus areas comunes.
export const VentanasCubicacion: React.FC<Props> = ({ proyectoId, cubicacion, moneda, tipos, filtro, onFiltro, legacy }) => {
  const voc = vocabulario(cubicacion.modo);
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [sinRectificar, setSinRectificar] = useState(false);
  const [estado, setEstado] = useState<'' | 'sinPosicion' | 'posicionadas'>('');
  const [modal, setModal] = useState<{ unidad?: UnidadCubicacion } | null>(null);

  const ubicaciones = useQuery({ queryKey: ['cubicacionUbicaciones', proyectoId], queryFn: () => getUbicacionesCubicacion(proyectoId) });
  const filtros = { pisoId: filtro.pisoId, torreId: filtro.torreId, tipoId, q: texto, sinRectificar, estado, limit: 500 };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cubicacionUnidades', proyectoId, filtros],
    queryFn: () => getUnidadesCubicacion(proyectoId, filtros),
    placeholderData: (previa) => previa,
  });
  const comunes = useQuery({
    queryKey: ['cubicacionUnidades', proyectoId, 'comunes'],
    queryFn: () => getUnidadesCubicacion(proyectoId, { areasComunes: true }),
  });
  const precios = useMemo(() => new Map(tipos.map((t) => [t.id, t.precioUnitario])), [tipos]);

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarUnidadCubicacion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyectoId] });
    },
    onError: aviso,
  });

  const unidades = data?.unidades ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Buscador className="flex-1 min-w-[12rem]" valor={texto} onChange={setTexto} placeholder="Buscar por nomenclatura, código o ubicación…" etiqueta="Buscar ventanas" />
        <SelectCompacto value={filtro.torreId} onChange={(e) => onFiltro({ torreId: e.target.value, pisoId: '' })} aria-label={`Filtrar por ${voc.contenedor}`}>
          <option value="">{voc.modo === 'CASA' ? 'Todas las casas' : 'Todas las torres'}</option>
          {(ubicaciones.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {voc.textoTorre(t.nombre)}
            </option>
          ))}
        </SelectCompacto>
        <SelectCompacto value={filtro.pisoId} onChange={(e) => onFiltro({ ...filtro, pisoId: e.target.value })} disabled={!filtro.torreId} aria-label="Filtrar por piso">
          <option value="">Todos los pisos</option>
          {(ubicaciones.data?.find((t) => t.id === filtro.torreId)?.pisos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              Piso {p.numero}
            </option>
          ))}
        </SelectCompacto>
        <SelectCompacto value={tipoId} onChange={(e) => setTipoId(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {tipos
            .filter((t) => !t.esAreaComun)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo}
              </option>
            ))}
        </SelectCompacto>
        <SelectCompacto value={estado} onChange={(e) => setEstado(e.target.value as '' | 'sinPosicion' | 'posicionadas')} aria-label="Filtrar por posición">
          <option value="">Con y sin posición</option>
          <option value="sinPosicion">Sin posición</option>
          <option value="posicionadas">Con posición</option>
        </SelectCompacto>
        {!legacy && <Casilla checked={sinRectificar} onChange={setSinRectificar} label="Solo sin rectificar" />}
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModal({})}>
          Nueva ventana
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">No se pudieron cargar las ventanas.</div>
      ) : unidades.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs">
          {data?.total === 0 && !texto && !tipoId && !filtro.pisoId && !filtro.torreId && !sinRectificar && !estado
            ? legacy
              ? 'Todavía no hay ventanas. Cubica desde los documentos de fabricación o usa "Nueva ventana".'
              : 'Todavía no hay ventanas. Crea la cubicación desde el presupuesto, sube una planilla o usa "Nueva ventana".'
            : 'Ninguna ventana coincide con los filtros.'}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Tabla>
            <Thead>
              <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <Th className="font-bold">Nomenclatura</Th>
                <Th className="font-bold">Ubicación</Th>
                <Th className="font-bold">Apertura</Th>
                {legacy ? (
                  <>
                    <Th className="font-bold">Documento</Th>
                    <Th className="font-bold">Medida (mm)</Th>
                  </>
                ) : (
                  <>
                    <Th className="font-bold">Plano (mm)</Th>
                    <Th className="font-bold">Rasgo medido (mm)</Th>
                    <Th className="font-bold">Fabricación (mm)</Th>
                  </>
                )}
                <Th alinear="derecha" className="font-bold">M2</Th>
                <Th className="font-bold w-20"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {unidades.map((u) => (
                <FilaVentana
                  key={`${u.id}-${u.rasgoAnchoMm}-${u.rasgoAltoMm}-${u.holguraMm}`}
                  unidad={u}
                  proyectoId={proyectoId}
                  legacy={legacy}
                  onEditar={() => setModal({ unidad: u })}
                  onEliminar={async () => {
                    if (await confirmar({ titulo: `¿Eliminar la ventana ${u.nomenclatura ?? u.codigo}?`, confirmar: 'Eliminar', peligro: true })) eliminar.mutate(u.id);
                  }}
                />
              ))}
            </Tbody>
          </Tabla>
          {data && data.total > unidades.length && (
            <p className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100">
              Mostrando {unidades.length} de {data.total} ventanas: filtra por torre o piso para ver el resto.
            </p>
          )}
        </div>
      )}

      {(comunes.data?.unidades.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Áreas comunes y fachada ({comunes.data!.unidades.length})</h3>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <Tabla>
              <Thead>
                <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                  <Th className="font-bold">Código</Th>
                  <Th className="font-bold">Descripción</Th>
                  <Th alinear="derecha" className="font-bold">Cantidad</Th>
                  <Th alinear="derecha" className="font-bold">Precio total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {comunes.data!.unidades.map((u) => (
                  <Tr key={u.id} className="border-b border-slate-50">
                    <Td className="font-mono font-bold text-slate-700">{u.codigo}</Td>
                    <Td className="text-slate-600">{u.sistema}</Td>
                    <Td alinear="derecha" className="font-mono text-slate-600">{u.cantidad}</Td>
                    <Td alinear="derecha" className="font-mono text-slate-600">{precios.get(u.tipoId) != null ? formatoMonto((precios.get(u.tipoId) as number) * u.cantidad, moneda ?? 'UF') : '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Tabla>
          </div>
          <p className="text-[11px] text-slate-400">Por ahora cada ítem cuenta como una sola unidad; tendrán sus propias etapas y estado de pago.</p>
        </div>
      )}

      {modal && (
        <UnidadModal
          proyectoId={proyectoId}
          cubicacion={cubicacion}
          tipos={tipos}
          unidad={modal.unidad}
          legacy={legacy}
          inicial={{
            torre: ubicaciones.data?.find((t) => t.id === filtro.torreId)?.nombre,
            piso: ubicaciones.data?.find((t) => t.id === filtro.torreId)?.pisos.find((p) => p.id === filtro.pisoId)?.numero,
          }}
          onClose={() => {
            setModal(null);
            queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyectoId] });
          }}
        />
      )}
    </div>
  );
};
