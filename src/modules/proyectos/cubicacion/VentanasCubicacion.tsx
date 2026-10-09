import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { editarUnidadCubicacion, eliminarUnidadCubicacion, getUbicacionesCubicacion, getUnidadesCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { Cubicacion, TipoCubicacion, UnidadCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { leerMilimetros } from '../pendientes/utils';
import { campoChico } from './estilos';
import { UnidadModal } from './UnidadModal';
import { formatoMonto, mmATexto } from './utils';

export interface FiltroVentanas {
  piso: number | '';
  torre: string;
}

interface Props {
  proyectoId: string;
  cubicacion: Cubicacion;
  tipos: TipoCubicacion[];
  filtro: FiltroVentanas;
  onFiltro: (f: FiltroVentanas) => void;
}

const aviso = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

// Una fila: el rasgo (lo medido en obra) se escribe ahi mismo y se guarda al salir del campo, con ancho
// y alto juntos. La medida de fabricacion (rasgo - holgura) la calcula el servidor.
const FilaVentana: React.FC<{ unidad: UnidadCubicacion; onEditar: () => void; onEliminar: () => void; proyectoId: string }> = ({ unidad, onEditar, onEliminar, proyectoId }) => {
  const queryClient = useQueryClient();
  const [ancho, setAncho] = useState(mmATexto(unidad.rasgoAnchoMm));
  const [alto, setAlto] = useState(mmATexto(unidad.rasgoAltoMm));

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
    <tr className="border-b border-slate-50 hover:bg-slate-50/60 align-middle">
      <td className="px-3 py-2 whitespace-nowrap">
        {unidad.nomenclatura ? (
          <span className="font-mono font-bold text-xs text-slate-800">{unidad.nomenclatura}</span>
        ) : (
          <span className="font-mono text-xs text-slate-400" title="Aún sin piso y departamento">
            {unidad.codigo} <Badge size="sm" variant="outline">sin posición</Badge>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{unidad.ubicacion || '—'}</td>
      <td className="px-3 py-2 text-[11px] text-slate-500 max-w-[14rem] truncate" title={unidad.sistema}>
        {unidad.sistema}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-slate-500 whitespace-nowrap">
        {formatoMm(unidad.anchoPlanoMm)} × {formatoMm(unidad.altoPlanoMm)}
      </td>
      <td className="px-3 py-2" onBlur={alSalir}>
        <div className="flex items-center gap-1 min-w-[10rem]">
          <input
            aria-label={`Rasgo ancho de ${unidad.nomenclatura ?? unidad.codigo}`}
            inputMode="decimal"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), intentarGuardar())}
            placeholder="ancho"
            className={`${campoChico} ${invalido ? 'border-rose-300' : ''}`}
          />
          <span className="text-slate-300">×</span>
          <input
            aria-label={`Rasgo alto de ${unidad.nomenclatura ?? unidad.codigo}`}
            inputMode="decimal"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), intentarGuardar())}
            placeholder="alto"
            className={`${campoChico} ${invalido ? 'border-rose-300' : ''}`}
          />
          {guardar.isPending && <Loader2 className="w-3 h-3 animate-spin text-slate-400 shrink-0" />}
        </div>
      </td>
      <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">
        {unidad.rectificada ? (
          <span className="font-bold text-emerald-700" title={`Rasgo − ${unidad.holguraMm} mm${unidad.rectificadoPor ? ` · ${unidad.rectificadoPor}` : ''}`}>
            {formatoMm(unidad.anchoFabricacionMm)} × {formatoMm(unidad.altoFabricacionMm)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-xs font-mono text-slate-500 whitespace-nowrap">{unidad.m2 != null ? unidad.m2.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '—'}</td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <button type="button" onClick={onEditar} className="p-1.5 text-slate-400 hover:text-brand-600 cursor-pointer" aria-label={`Editar ${unidad.nomenclatura ?? unidad.codigo}`} title="Editar posición y datos">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onEliminar} className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label={`Eliminar ${unidad.nomenclatura ?? unidad.codigo}`} title="Eliminar">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
};

// Ventanas fisicas de la cubicacion (por torre / piso / depto) y sus areas comunes.
export const VentanasCubicacion: React.FC<Props> = ({ proyectoId, cubicacion, tipos, filtro, onFiltro }) => {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [sinRectificar, setSinRectificar] = useState(false);
  const [estado, setEstado] = useState<'' | 'sinPosicion' | 'posicionadas'>('');
  const [modal, setModal] = useState<{ unidad?: UnidadCubicacion } | null>(null);

  const ubicaciones = useQuery({ queryKey: ['cubicacionUbicaciones', proyectoId], queryFn: () => getUbicacionesCubicacion(proyectoId) });
  const filtros = { piso: filtro.piso, torre: filtro.torre, tipoId, q: texto, sinRectificar, estado, limit: 500 };
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
  const selector = 'px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-brand-600 cursor-pointer';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nomenclatura, código o ubicación..."
            aria-label="Buscar ventanas"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-brand-600"
          />
        </div>
        <select value={filtro.torre} onChange={(e) => onFiltro({ ...filtro, torre: e.target.value })} aria-label="Filtrar por torre" className={selector}>
          <option value="">Todas las torres</option>
          {(ubicaciones.data?.torres ?? []).map((t) => (
            <option key={t} value={t}>
              Torre {t}
            </option>
          ))}
        </select>
        <select value={filtro.piso === '' ? '' : String(filtro.piso)} onChange={(e) => onFiltro({ ...filtro, piso: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Filtrar por piso" className={selector}>
          <option value="">Todos los pisos</option>
          {(ubicaciones.data?.pisos ?? []).map((p) => (
            <option key={p} value={p}>
              Piso {p}
            </option>
          ))}
        </select>
        <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} aria-label="Filtrar por tipo" className={selector}>
          <option value="">Todos los tipos</option>
          {tipos
            .filter((t) => !t.esAreaComun)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo}
              </option>
            ))}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value as '' | 'sinPosicion' | 'posicionadas')} aria-label="Filtrar por posición" className={selector}>
          <option value="">Con y sin posición</option>
          <option value="sinPosicion">Sin posición</option>
          <option value="posicionadas">Con posición</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={sinRectificar} onChange={(e) => setSinRectificar(e.target.checked)} /> Solo sin rectificar
        </label>
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
          {data?.total === 0 && !texto && !tipoId && filtro.piso === '' && !filtro.torre && !sinRectificar && !estado
            ? 'Todavía no hay ventanas. Crea la cubicación desde el presupuesto, sube una planilla o usa "Nueva ventana".'
            : 'Ninguna ventana coincide con los filtros.'}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2.5 font-bold">Nomenclatura</th>
                <th className="px-3 py-2.5 font-bold">Ubicación</th>
                <th className="px-3 py-2.5 font-bold">Apertura</th>
                <th className="px-3 py-2.5 font-bold">Plano (mm)</th>
                <th className="px-3 py-2.5 font-bold">Rasgo medido (mm)</th>
                <th className="px-3 py-2.5 font-bold">Fabricación (mm)</th>
                <th className="px-3 py-2.5 font-bold text-right">M2</th>
                <th className="px-3 py-2.5 font-bold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <FilaVentana
                  key={`${u.id}-${u.rasgoAnchoMm}-${u.rasgoAltoMm}-${u.holguraMm}`}
                  unidad={u}
                  proyectoId={proyectoId}
                  onEditar={() => setModal({ unidad: u })}
                  onEliminar={() => {
                    if (window.confirm(`¿Eliminar la ventana ${u.nomenclatura ?? u.codigo}?`)) eliminar.mutate(u.id);
                  }}
                />
              ))}
            </tbody>
          </table>
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
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="px-3 py-2.5 font-bold">Código</th>
                  <th className="px-3 py-2.5 font-bold">Descripción</th>
                  <th className="px-3 py-2.5 font-bold text-right">Cantidad</th>
                  <th className="px-3 py-2.5 font-bold text-right">Precio total</th>
                </tr>
              </thead>
              <tbody>
                {comunes.data!.unidades.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 font-mono font-bold text-slate-700">{u.codigo}</td>
                    <td className="px-3 py-2 text-slate-600">{u.sistema}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{u.cantidad}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{precios.get(u.tipoId) != null ? formatoMonto((precios.get(u.tipoId) as number) * u.cantidad, cubicacion.moneda) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          inicial={{ torre: filtro.torre || undefined, piso: filtro.piso }}
          onClose={() => {
            setModal(null);
            queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyectoId] });
          }}
        />
      )}
    </div>
  );
};
