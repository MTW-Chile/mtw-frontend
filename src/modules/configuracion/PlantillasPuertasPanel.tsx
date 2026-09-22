import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DoorClosed, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { getPlantillasLinea, eliminarPlantillaLinea } from '../../api/client';
import type { PlantillaLinea } from '../../types';
import { PlantillaLineaEditModal } from './PlantillaLineaEditModal';

/**
 * Plantillas de Puertas: recetas reutilizables de herrajes por tipo de
 * puerta Protex. Se usan desde Step2Lineas al agregar una linea manual de
 * tipo puerta -- ver "+ Agregar línea manual" en Revisión de Líneas.
 */
export const PlantillasPuertasPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<PlantillaLinea | null>(null);
  const [creandoNueva, setCreandoNueva] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<PlantillaLinea[]>({
    queryKey: ['plantillasLinea'],
    queryFn: async () => (await getPlantillasLinea()).data,
  });

  const plantillas = data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eliminarPlantillaLinea(id),
    onMutate: (id) => setEliminandoId(id),
    onSettled: () => setEliminandoId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plantillasLinea'] }),
  });

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Plantillas de Puertas Protex</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Herrajes que lleva cada tipo de puerta -- se usan al agregar una línea manual en Revisión de Líneas.
          </p>
        </div>
        <button
          onClick={() => setCreandoNueva(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-[#E34A26] bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Plantilla</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs font-bold text-rose-600">Error al consultar las plantillas.</p>
          <button onClick={() => refetch()} className="text-xs font-bold text-[#E34A26] hover:underline cursor-pointer">
            Reintentar
          </button>
        </div>
      ) : plantillas.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <DoorClosed className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500">Aún no hay plantillas de puerta configuradas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plantillas.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/80 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-slate-900">{p.nombre}</div>
                  <span className="text-[10px] font-bold uppercase text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md shrink-0">
                    {p.hojas} {p.hojas === 1 ? 'Hoja' : 'Hojas'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {p.items.length} {p.items.length === 1 ? 'material' : 'materiales'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditando(p)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:text-[#E34A26] hover:bg-orange-50 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`¿Eliminar la plantilla "${p.nombre}"? Las puertas ya agregadas a proyectos no se ven afectadas.`)) {
                      deleteMutation.mutate(p.id);
                    }
                  }}
                  disabled={eliminandoId === p.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {eliminandoId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editando || creandoNueva) && (
        <PlantillaLineaEditModal
          plantilla={editando}
          onClose={() => {
            setEditando(null);
            setCreandoNueva(false);
          }}
        />
      )}
    </div>
  );
};
