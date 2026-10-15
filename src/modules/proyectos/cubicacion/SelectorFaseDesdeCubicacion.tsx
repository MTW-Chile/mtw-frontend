import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getEstructuraCubicacion } from '../../../api/client';
import type { NodoDeptoCubicacion, SeleccionFaseCubicacion } from '../../../types';
import { textoTorre } from './utils';

interface Props {
  proyectoId: string;
  onChange: (seleccion: SeleccionFaseCubicacion, resumen: string) => void;
}

// Selector de torres/pisos/deptos/ventanas ya cubicadas para armar una fase
// de fabricación -- NO decide qué queda incluido (eso lo resuelve el backend,
// resolverSeleccionParaFase en cubicador-estructura.ts: una ventana ya
// asignada a otra fase se excluye sola, con aviso, al guardar). Acá solo se
// marca la intención; por eso casillas en distintos niveles pueden
// superponerse sin problema (el backend las une sin duplicar).
export const SelectorFaseDesdeCubicacion: React.FC<Props> = ({ proyectoId, onChange }) => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['cubicacionEstructura', proyectoId], queryFn: () => getEstructuraCubicacion(proyectoId) });
  const [torreIds, setTorreIds] = useState<Set<string>>(new Set());
  const [pisoIds, setPisoIds] = useState<Set<string>>(new Set());
  const [unidadIds, setUnidadIds] = useState<Set<string>>(new Set());
  const [ventanaIds, setVentanaIds] = useState<Set<string>>(new Set());
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const alternar = (set: Set<string>, setSet: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  };
  const expandir = (id: string) => alternar(expandidas, setExpandidas, id);

  useEffect(() => {
    const seleccion: SeleccionFaseCubicacion = {
      torreIds: [...torreIds],
      pisoIds: [...pisoIds],
      unidadIds: [...unidadIds],
      ventanaIndividualizadaIds: [...ventanaIds],
    };
    const partes: string[] = [];
    if (torreIds.size) partes.push(`${torreIds.size} torre(s)`);
    if (pisoIds.size) partes.push(`${pisoIds.size} piso(s)`);
    if (unidadIds.size) partes.push(`${unidadIds.size} depto(s)/unidad(es)`);
    if (ventanaIds.size) partes.push(`${ventanaIds.size} ventana(s) suelta(s)`);
    onChange(seleccion, partes.length ? partes.join(', ') : 'nada seleccionado todavía');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torreIds, pisoIds, unidadIds, ventanaIds]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="p-4 text-xs text-rose-600">No se pudo cargar la cubicación.</div>;
  }
  if (data.torres.length === 0) {
    return <p className="p-4 text-xs text-slate-400">Esta obra todavía no tiene nada cubicado -- arma el edificio en el Cubicador visual primero.</p>;
  }

  const filaUnidad = (nodo: NodoDeptoCubicacion) => (
    <div key={nodo.id} className="pl-4 border-l border-slate-100">
      <div className="flex items-center gap-1.5 py-1">
        <button type="button" onClick={() => expandir(nodo.id)} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Expandir">
          {expandidas.has(nodo.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={unidadIds.has(nodo.id)} onChange={() => alternar(unidadIds, setUnidadIds, nodo.id)} />
          <span className="font-mono font-bold text-slate-800">{nodo.nombre}</span>
          <span className="text-slate-400">({nodo.ventanas.length} ventana(s))</span>
        </label>
      </div>
      {expandidas.has(nodo.id) && (
        <div className="pl-6 pb-1 space-y-0.5">
          {nodo.ventanas.map((v) => (
            <label key={v.id} className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
              <input type="checkbox" checked={ventanaIds.has(v.id)} onChange={() => alternar(ventanaIds, setVentanaIds, v.id)} />
              <span className="font-mono">{v.codigo}</span>
              {v.nomenclatura && <span className="text-slate-400">{v.nomenclatura}</span>}
            </label>
          ))}
          {nodo.ventanas.length === 0 && <p className="text-[11px] text-slate-300">Sin ventanas.</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-1 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
      {data.torres.map((torre) => (
        <div key={torre.id}>
          <div className="flex items-center gap-1.5 py-1">
            <button type="button" onClick={() => expandir(torre.id)} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Expandir torre">
              {expandidas.has(torre.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
              <input type="checkbox" checked={torreIds.has(torre.id)} onChange={() => alternar(torreIds, setTorreIds, torre.id)} />
              {textoTorre(torre.nombre)}
            </label>
          </div>
          {expandidas.has(torre.id) && (
            <div className="pl-4">
              {torre.pisos.map((piso) => (
                <div key={piso.id}>
                  <div className="flex items-center gap-1.5 py-1">
                    <button type="button" onClick={() => expandir(piso.id)} className="text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Expandir piso">
                      {expandidas.has(piso.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={pisoIds.has(piso.id)} onChange={() => alternar(pisoIds, setPisoIds, piso.id)} />
                      <span className="font-bold text-slate-800">Piso {piso.numero}</span>
                      <span className="text-slate-400">({piso.deptos.length} depto(s))</span>
                    </label>
                  </div>
                  {expandidas.has(piso.id) && <div className="pl-4">{piso.deptos.map(filaUnidad)}</div>}
                </div>
              ))}
              {torre.especiales.length > 0 && <div className="pl-4">{torre.especiales.map(filaUnidad)}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
