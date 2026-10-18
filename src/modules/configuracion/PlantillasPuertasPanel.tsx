import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DoorClosed, Plus, Pencil, Trash2 } from 'lucide-react';
import { getPlantillasLinea, eliminarPlantillaLinea } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Badge } from '../../components/ui/Badge';
import { Seccion } from '../../components/ui/Seccion';
import { FilaLista, Lista } from '../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import { useConfirmar } from '../../components/ui/Confirmar';
import type { PlantillaLinea } from '../../types';
import { PlantillaLineaEditModal } from './PlantillaLineaEditModal';

/**
 * Plantillas de Puertas: recetas reutilizables de herrajes por tipo de
 * puerta Protex. Se usan desde Step2Lineas al agregar una linea manual de
 * tipo puerta -- ver "+ Agregar línea manual" en Revisión de Líneas.
 */
export const PlantillasPuertasPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const [editando, setEditando] = useState<PlantillaLinea | 'nueva' | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<PlantillaLinea[]>({
    queryKey: ['plantillasLinea'],
    queryFn: async () => (await getPlantillasLinea()).data,
  });
  const plantillas = data || [];

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarPlantillaLinea(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plantillasLinea'] }),
  });

  const pedirEliminar = async (p: PlantillaLinea) => {
    const ok = await confirmar({
      titulo: `¿Eliminar la plantilla "${p.nombre}"?`,
      mensaje: 'Las puertas ya agregadas a proyectos no se ven afectadas.',
      confirmar: 'Eliminar',
      peligro: true,
    });
    if (ok) eliminar.mutate(p.id);
  };

  return (
    <Seccion
      icono={DoorClosed}
      antetitulo="Catálogo"
      sinRelleno
      titulo="Plantillas de puertas Protex"
      descripcion="Herrajes que lleva cada tipo de puerta. Se usan al agregar una línea manual en Revisión de Líneas."
      acciones={
        <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditando('nueva')}>
          Nueva plantilla
        </Button>
      }
    >
      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="las plantillas" onReintentar={refetch} />
      ) : plantillas.length === 0 ? (
        <EstadoVacio enTarjeta={false} icono={DoorClosed} titulo="Aún no hay plantillas de puerta configuradas" />
      ) : (
        <Lista>
          {plantillas.map((p) => (
            <FilaLista
              key={p.id}
              titulo={p.nombre}
              insignias={
                <Badge size="sm" variant="info">
                  {p.hojas} {p.hojas === 1 ? 'hoja' : 'hojas'}
                </Badge>
              }
              acciones={
                <>
                  <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(p)}>
                    Editar
                  </Button>
                  <IconButton
                    icono={Trash2}
                    tono="peligro"
                    etiqueta={`Eliminar la plantilla ${p.nombre}`}
                    cargando={eliminar.isPending && eliminar.variables === p.id}
                    onClick={() => pedirEliminar(p)}
                  />
                </>
              }
            >
              {p.items.length} {p.items.length === 1 ? 'material' : 'materiales'}
            </FilaLista>
          ))}
        </Lista>
      )}

      {editando && <PlantillaLineaEditModal plantilla={editando === 'nueva' ? null : editando} onClose={() => setEditando(null)} />}
    </Seccion>
  );
};
