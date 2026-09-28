import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { getPartidas, updatePartida, getMisPermisos } from '../../../api/client';
import type { PartidaConfig, CategoriaGasto } from '../../../types';

/**
 * Las 9 partidas (antes "Familia"/CategoriaGasto -- Perfilería, Herrajes,
 * Vidrios, ...) son fijas, pero su nombre para mostrar y su código de
 * integración con Clay (contabilidad) son editables acá. Una fila por
 * partida siempre existe (autocompletada por asegurarSchema en mtw-api),
 * así que no hay que crear/borrar filas, solo editarlas.
 */
export const PartidasPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  // mismo queryKey que el resto de la app -- sale del cache, no pega de nuevo al backend.
  const { data: permisos } = useQuery({ queryKey: ['misPermisos'], queryFn: getMisPermisos });

  const [ediciones, setEdiciones] = useState<Record<string, { nombre: string; integracionClay: string }>>({});

  const partidas = data?.data || [];

  const valorDe = (p: PartidaConfig) => ediciones[p.categoria] ?? { nombre: p.nombre, integracionClay: p.integracionClay || '' };
  const setValor = (p: PartidaConfig, campo: 'nombre' | 'integracionClay', valor: string) =>
    setEdiciones((prev) => ({ ...prev, [p.categoria]: { ...valorDe(p), [campo]: valor } }));
  const esDirty = (p: PartidaConfig) => {
    const v = ediciones[p.categoria];
    return !!v && (v.nombre !== p.nombre || v.integracionClay !== (p.integracionClay || ''));
  };

  const mutation = useMutation({
    mutationFn: (p: PartidaConfig) => {
      const v = valorDe(p);
      return updatePartida(p.categoria, { nombre: v.nombre.trim(), integracionClay: v.integracionClay.trim() || null });
    },
    onSuccess: (_data, p) => {
      queryClient.invalidateQueries({ queryKey: ['partidas'] });
      setEdiciones((prev) => {
        const next = { ...prev };
        delete next[p.categoria];
        return next;
      });
    },
    onError: (err: any) => window.alert(err?.response?.data?.error || 'No se pudo guardar la partida.'),
  });

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
        <p className="text-sm font-bold text-rose-600">Error al consultar las partidas.</p>
        <button onClick={() => refetch()} className="text-xs font-bold text-[#E34A26] hover:underline cursor-pointer">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <p className="text-xs text-slate-500">
          Nombre para mostrar y código de integración con Clay (contabilidad) por partida -- las 9 son fijas, solo se
          edita su nombre y código.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Partida</th>
                <th className="px-5 py-3.5">Nombre</th>
                <th className="px-5 py-3.5">Código Clay</th>
                {permisos?.esAdmin && <th className="px-5 py-3.5 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partidas.map((p) => {
                const valores = valorDe(p);
                const dirty = esDirty(p);
                const guardando = mutation.isPending && mutation.variables?.categoria === p.categoria;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-mono text-[10px] text-slate-400">{p.categoria as CategoriaGasto}</td>
                    <td className="px-5 py-3">
                      {permisos?.esAdmin ? (
                        <input
                          value={valores.nombre}
                          onChange={(e) => setValor(p, 'nombre', e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#E34A26] bg-slate-50 focus:bg-white transition-colors"
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">{p.nombre}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {permisos?.esAdmin ? (
                        <input
                          value={valores.integracionClay}
                          placeholder="Sin código"
                          onChange={(e) => setValor(p, 'integracionClay', e.target.value)}
                          className="w-full font-mono text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#E34A26] bg-slate-50 focus:bg-white transition-colors placeholder:text-slate-300 placeholder:font-sans"
                        />
                      ) : (
                        <span className="font-mono text-slate-600">{p.integracionClay || <span className="text-slate-300">—</span>}</span>
                      )}
                    </td>
                    {permisos?.esAdmin && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => mutation.mutate(p)}
                          disabled={!dirty || guardando}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#E34A26] hover:bg-orange-50 transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        >
                          {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          <span>Guardar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
