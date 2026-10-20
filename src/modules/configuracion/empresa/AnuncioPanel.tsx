import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Seccion } from '../../../components/ui/Seccion';
import { Cargando } from '../../../components/ui/Estados';
import { Campo, Interruptor, OpcionesTarjeta, Textarea } from '../../../components/ui/Campos';
import { getConfiguracionEmpresa, updateConfiguracionEmpresa } from '../../../api/client';
import { mostrarToast } from '../../../lib/toast';
import type { UrgenciaAnuncio } from '../../../types';
import { AnuncioBanner, ESTILO_URGENCIA } from '../../inicio/AnuncioBanner';

/** Configuración › Anuncio: mensaje para todos los usuarios en la página de inicio. */
export const AnuncioPanel: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['configuracionEmpresa'], queryFn: getConfiguracionEmpresa });
  const config = data?.configuracionEmpresa;

  const [texto, setTexto] = useState('');
  const [urgencia, setUrgencia] = useState<UrgenciaAnuncio>('INFORMATIVO');
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    if (!config) return;
    setTexto(config.anuncioTexto ?? '');
    setUrgencia(config.anuncioUrgencia);
    setActivo(config.anuncioActivo);
  }, [config?.id]);

  const guardar = useMutation({
    mutationFn: () => updateConfiguracionEmpresa({ anuncioTexto: texto.trim() || null, anuncioUrgencia: urgencia, anuncioActivo: activo && !!texto.trim() }),
    onSuccess: (res) => {
      queryClient.setQueryData(['configuracionEmpresa'], { success: true, configuracionEmpresa: res.configuracionEmpresa });
      queryClient.invalidateQueries({ queryKey: ['anuncio'] });
      mostrarToast(res.configuracionEmpresa.anuncioActivo ? 'Anuncio publicado.' : 'Anuncio guardado sin publicar.', { tipo: 'info' });
    },
    onError: (e: any) => mostrarToast(e?.response?.data?.error || 'No se pudo guardar el anuncio.'),
  });

  if (isLoading) return <Cargando />;

  return (
    <Seccion
      titulo="Anuncio"
      descripcion="Un mensaje que ven todos los usuarios en la página de inicio, sobre el buscador. El color indica la urgencia."
      acciones={
        puedeEditar && (
          <Button size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <Interruptor
          enTarjeta
          valor={activo}
          onChange={setActivo}
          disabled={!puedeEditar || !texto.trim()}
          etiqueta="Publicar el anuncio"
          label="Publicar el anuncio"
          helperText={texto.trim() ? 'Apagado, el mensaje queda guardado pero nadie lo ve.' : 'Escribe el mensaje para poder publicarlo.'}
        />
        <Campo label="Mensaje" helperText={`${texto.length}/500`}>
          <Textarea value={texto} maxLength={500} rows={3} disabled={!puedeEditar} placeholder="Ej. El viernes no habrá despacho de materiales por inventario." onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        <OpcionesTarjeta<UrgenciaAnuncio>
          legend="Urgencia"
          disabled={!puedeEditar}
          valor={urgencia}
          onChange={setUrgencia}
          opciones={(Object.keys(ESTILO_URGENCIA) as UrgenciaAnuncio[]).map((u) => {
            const { label, Icono } = ESTILO_URGENCIA[u];
            return { value: u, label, icono: <Icono className="w-3.5 h-3.5" /> };
          })}
        />
        {texto.trim() && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Vista previa</p>
            <AnuncioBanner texto={texto.trim()} urgencia={urgencia} className="rounded-xl" />
          </div>
        )}
      </div>
    </Seccion>
  );
};
