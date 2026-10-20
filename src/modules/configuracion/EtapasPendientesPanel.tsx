import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { crearEtapaPendiente, editarEtapaPendiente, getEtapasPendiente } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Seccion } from '../../components/ui/Seccion';
import { InputCompacto, SelectCompacto } from '../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../components/ui/Estados';
import type { DestinoPendiente, EtapaPendiente } from '../../types';
import { ETIQUETA_DESTINO } from '../proyectos/pendientes/utils';

const valorDestino = (d: DestinoPendiente | null) => d ?? '';
const destinoDeValor = (v: string): DestinoPendiente | null => (v === '' ? null : (v as DestinoPendiente));

const OpcionesDestino: React.FC = () => (
  <>
    <option value="">Todas las áreas</option>
    <option value="TECNICA">Solo {ETIQUETA_DESTINO.TECNICA}</option>
    <option value="FABRICA">Solo {ETIQUETA_DESTINO.FABRICA}</option>
  </>
);

// Catalogo editable de las etapas de un pendiente EN_CURSO (solicitado, enviado a
// compras, OC enviada, recibido...). Una etapa no se borra -- el historial guarda
// su nombre --, se desactiva. Solo un administrador puede editarlas (el servidor
// lo exige); el resto las ve al avanzar un pendiente.
export const EtapasPendientesPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [nueva, setNueva] = useState('');
  const [nuevaDestino, setNuevaDestino] = useState<DestinoPendiente | null>(null);
  const [editando, setEditando] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['etapasPendiente', 'todas'],
    queryFn: () => getEtapasPendiente(true),
  });
  const etapas = data ?? [];

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['etapasPendiente'] });
  };

  const crear = useMutation({
    mutationFn: () => crearEtapaPendiente({ nombre: nueva.trim(), destino: nuevaDestino }),
    onSuccess: () => {
      setNueva('');
      setNuevaDestino(null);
      refrescar();
    },
  });
  const editar = useMutation({
    mutationFn: (v: { id: string; datos: Parameters<typeof editarEtapaPendiente>[1] }) => editarEtapaPendiente(v.id, v.datos),
    onSuccess: refrescar,
  });

  // Intercambia el orden con la vecina (dos cambios).
  const mover = async (i: number, delta: -1 | 1) => {
    const a = etapas[i];
    const b = etapas[i + delta];
    if (!a || !b) return;
    await editar.mutateAsync({ id: a.id, datos: { orden: b.orden } });
    await editar.mutateAsync({ id: b.id, datos: { orden: a.orden } });
  };

  const guardarNombre = (e: EtapaPendiente) => {
    const nombre = (editando[e.id] ?? e.nombre).trim();
    setEditando((s) => {
      const { [e.id]: _omit, ...resto } = s;
      return resto;
    });
    if (nombre && nombre !== e.nombre) editar.mutate({ id: e.id, datos: { nombre } });
  };

  return (
    <Seccion
      sinRelleno
      titulo="Etapas de los pendientes"
      descripcion='Las etapas que sigue un pendiente mientras está "En curso". Cada una puede aplicar a Compras, a Fabricación o a ambos. Una etapa no se elimina (el historial conserva su nombre): se desactiva y deja de ofrecerse.'
    >
      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="las etapas" onReintentar={refetch} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {etapas.map((e, i) => (
            <li key={e.id} className={`flex flex-wrap items-center gap-2 px-5 py-2.5 ${e.activa ? '' : 'opacity-60'}`}>
              <div className="flex flex-col">
                <IconButton icono={ArrowUp} etiqueta={`Subir ${e.nombre}`} className="h-5!" onClick={() => mover(i, -1)} disabled={i === 0 || editar.isPending} />
                <IconButton icono={ArrowDown} etiqueta={`Bajar ${e.nombre}`} className="h-5!" onClick={() => mover(i, 1)} disabled={i === etapas.length - 1 || editar.isPending} />
              </div>
              <InputCompacto
                value={editando[e.id] ?? e.nombre}
                onChange={(ev) => setEditando((s) => ({ ...s, [e.id]: ev.target.value }))}
                onBlur={() => guardarNombre(e)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                }}
                aria-label={`Nombre de la etapa ${e.nombre}`}
                maxLength={80}
                className="flex-1 min-w-[10rem] font-semibold"
              />
              <SelectCompacto
                value={valorDestino(e.destino)}
                onChange={(ev) => editar.mutate({ id: e.id, datos: { destino: destinoDeValor(ev.target.value) } })}
                aria-label={`Área de ${e.nombre}`}
              >
                <OpcionesDestino />
              </SelectCompacto>
              <Button size="sm" variant={e.activa ? 'outline' : 'subtle'} disabled={editar.isPending} onClick={() => editar.mutate({ id: e.id, datos: { activa: !e.activa } })}>
                {e.activa ? 'Desactivar' : 'Activar'}
              </Button>
              {!e.activa && (
                <Badge size="sm" variant="outline">
                  Inactiva
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
        <InputCompacto
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && nueva.trim() && !crear.isPending) crear.mutate();
          }}
          placeholder="Nueva etapa (ej. Revisión en obra)"
          aria-label="Nombre de la nueva etapa"
          maxLength={80}
          className="flex-1 min-w-[12rem]"
        />
        <SelectCompacto value={valorDestino(nuevaDestino)} onChange={(e) => setNuevaDestino(destinoDeValor(e.target.value))} aria-label="Área de la nueva etapa">
          <OpcionesDestino />
        </SelectCompacto>
        <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} disabled={!nueva.trim()} isLoading={crear.isPending} onClick={() => crear.mutate()}>
          Agregar etapa
        </Button>
      </div>
    </Seccion>
  );
};
