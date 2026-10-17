import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Loader2 } from 'lucide-react';
import { getTiposProyecto, setTipoProyecto } from '../../../../api/client';
import { avisarError } from '../../../configuracion/catalogo/comun';
import { usePermisos } from '../../../../lib/permisos';
import type { Proyecto } from '../../../../types';

/**
 * Tipo del proyecto (Retail, Obra...): define sus plantillas de textos por
 * defecto (Configuración › Comercial). Se guarda al elegirlo.
 */
export const TipoProyectoCard: React.FC<{ proyecto: Proyecto; congelado: boolean }> = ({ proyecto, congelado }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const { data: tipos = [] } = useQuery({ queryKey: ['tiposProyecto'], queryFn: getTiposProyecto });
  const cambiar = useMutation({
    mutationFn: (tipoProyectoId: string) => setTipoProyecto(proyecto.id, tipoProyectoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['plantillaProyecto', proyecto.id] });
    },
    onError: avisarError,
  });
  const editable = tiene('presupuestos.editar') && !congelado;

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
          <FolderKanban className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900">Tipo de proyecto</h2>
          <p className="text-xs text-slate-500 mt-0.5">Define los textos y condiciones por defecto de la oferta.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {cambiar.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        <select
          aria-label="Tipo de proyecto"
          value={proyecto.tipoProyecto?.id ?? proyecto.tipoProyectoId ?? ''}
          disabled={!editable || cambiar.isPending}
          onChange={(e) => cambiar.mutate(e.target.value)}
          className="min-w-[180px] py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-600 disabled:opacity-70"
        >
          {tipos
            .filter((t) => t.activo || t.id === proyecto.tipoProyecto?.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
        </select>
      </div>
    </section>
  );
};
