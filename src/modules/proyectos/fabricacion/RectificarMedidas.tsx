import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Ruler, X } from 'lucide-react';
import { crearCubicacionUnica, getCubicacion } from '../../../api/client';
import { Seccion } from '../../../components/ui/Seccion';
import { IconButton } from '../../../components/ui/IconButton';
import { VentanasCubicacion, type FiltroVentanas } from '../cubicacion/VentanasCubicacion';

/**
 * Rectificación de medidas de una obra sin cubicación (retail): la lista de
 * ventanas de la cubicación única, para escribir el rasgo medido en obra. Al
 * abrirla nombra las ventanas que aún no tienen nombre (cubicación única).
 */
export const RectificarMedidas: React.FC<{ proyectoId: string; onCerrar: () => void }> = ({ proyectoId, onCerrar }) => {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroVentanas>({ pisoId: '', torreId: '' });
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cubicacion', proyectoId, 'rectificar'],
    queryFn: async () => {
      const actual = await getCubicacion(proyectoId);
      if (actual.resumen.sinPosicion === 0) return actual;
      await crearCubicacionUnica(proyectoId);
      for (const key of ['cubicacion', 'cubicacionUnidades']) queryClient.invalidateQueries({ queryKey: [key, proyectoId] });
      return getCubicacion(proyectoId);
    },
  });

  return (
    <Seccion
      icono={Ruler}
      titulo="Rectificar medidas"
      descripcion={data ? `Escribe el rasgo medido en obra (ancho × alto). La medida de fabricación resta la holgura de ${data.cubicacion.holguraMm} mm.` : undefined}
      acciones={<IconButton icono={X} etiqueta="Cerrar la rectificación" onClick={onCerrar} />}
    >
      {isLoading ? (
        <div className="p-6 flex justify-center text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : isError || !data ? (
        <p className="text-xs text-rose-700">No se pudieron cargar las ventanas de la obra.</p>
      ) : (
        <VentanasCubicacion proyectoId={proyectoId} cubicacion={data.cubicacion} moneda={data.resumen.moneda} tipos={data.resumen.porTipo} filtro={filtro} onFiltro={setFiltro} />
      )}
    </Seccion>
  );
};
