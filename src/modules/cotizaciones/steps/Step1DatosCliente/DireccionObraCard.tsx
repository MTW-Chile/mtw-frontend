import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { updateDireccionObra } from '../../../../api/client';
import { Button } from '../../../../components/ui/Button';
import { CamposDireccion, aValorDireccion, type ValorDireccion } from '../../../../components/ui/CamposDireccion';
import { usePermisos } from '../../../../lib/permisos';
import { avisarError } from '../../../configuracion/catalogo/comun';
import type { Proyecto } from '../../../../types';

const guardada = (p: Proyecto): ValorDireccion => aValorDireccion({ direccion: p.obraDireccion, region: p.obraRegion, comuna: p.obraComuna, ciudad: p.obraCiudad });
const iguales = (a: ValorDireccion, b: ValorDireccion) => a.direccion.trim() === b.direccion.trim() && a.region === b.region && a.comuna === b.comuna && a.ciudad.trim() === b.ciudad.trim();

/**
 * Dirección de la obra: dónde se instala y a dónde van los despachos (sale en la
 * guía). Es distinta de la dirección fiscal del cliente. Formato del SII:
 * dirección, comuna y ciudad. Se puede completar también con la obra ya aceptada.
 */
export const DireccionObraCard: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  // null = sin cambios: se muestra lo guardado.
  const [edicion, setEdicion] = useState<ValorDireccion | null>(null);
  const actual = guardada(proyecto);
  const valor = edicion ?? actual;
  const editable = tiene('presupuestos.editar') || tiene('obras.editar');

  const guardar = useMutation({
    mutationFn: (v: ValorDireccion) =>
      updateDireccionObra(proyecto.id, { obraDireccion: v.direccion.trim() || null, obraRegion: v.region || null, obraComuna: v.comuna || null, obraCiudad: v.ciudad.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setEdicion(null);
    },
    onError: avisarError,
  });
  const hayCambios = !!edicion && !iguales(edicion, actual);

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900">Dirección de la obra</h2>
          <p className="text-xs text-slate-500 mt-0.5">Dónde se instala y a dónde van los despachos; sale en la guía. Es aparte de la dirección fiscal del cliente.</p>
        </div>
      </div>
      <CamposDireccion valor={valor} onChange={setEdicion} etiquetaDireccion="Dirección de la obra" disabled={!editable || guardar.isPending} />
      {editable && (
        <div className="flex justify-end gap-2">
          {hayCambios && (
            <Button size="sm" variant="ghost" disabled={guardar.isPending} onClick={() => setEdicion(null)}>
              Descartar
            </Button>
          )}
          <Button size="sm" variant="primary" disabled={!hayCambios} isLoading={guardar.isPending} onClick={() => guardar.mutate(valor)}>
            Guardar dirección
          </Button>
        </div>
      )}
    </section>
  );
};
