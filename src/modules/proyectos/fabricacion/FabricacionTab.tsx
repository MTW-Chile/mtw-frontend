import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Factory, Link2, Loader2, RefreshCw, Search, Unlink } from 'lucide-react';
import {
  desvincularFabricacion,
  detectarFabricaciones,
  getFabricacionesProyecto,
  refrescarFabricacion,
} from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { mostrarToast } from '../../../lib/toast';
import type { FabricacionHetmo, Proyecto } from '../../../types';
import { BuscarFabricacionModal } from './BuscarFabricacionModal';
import { FabricacionDetalle } from './FabricacionDetalle';
import { formatoFechaHora, textoEstadoFabricacion, varianteEstadoFabricacion } from './utils';

interface Props {
  proyecto: Proyecto;
}

// Seccion "Fabricacion" de una obra: los documentos de fabricacion de HETMO
// vinculados a ella. En una obra con presupuesto de HETMO se detectan solos
// (a partir de sus versiones); en una obra manual se buscan y vinculan a
// mano. HETMO es solo lectura: aca se guarda una copia con sus ids.
export const FabricacionTab: React.FC<Props> = ({ proyecto }) => {
  const queryClient = useQueryClient();
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fabricaciones', proyecto.id],
    queryFn: () => getFabricacionesProyecto(proyecto.id),
  });

  const invalidar = (fabId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['fabricaciones', proyecto.id] });
    queryClient.invalidateQueries({ queryKey: ['hetmoFabricaciones'] });
    if (fabId) {
      queryClient.invalidateQueries({ queryKey: ['fabricacionDetalle', proyecto.id, fabId] });
      queryClient.invalidateQueries({ queryKey: ['fabricacionMateriales', proyecto.id, fabId] });
    }
  };

  // Las versiones con hetmoId <= 0 son presupuestos manuales (ids sinteticos):
  // no existen en HETMO, no hay nada que detectar.
  const tienePresupuestoHetmo = proyecto.versiones.some((v) => v.hetmoId > 0);

  const detectar = useMutation({
    mutationFn: () => detectarFabricaciones(proyecto.id),
    onSuccess: (r) => {
      invalidar();
      const partes = [
        r.vinculadas.length ? `${r.vinculadas.length} documento(s) vinculado(s)` : 'No se encontraron documentos nuevos',
        r.yaVinculadas.length ? `${r.yaVinculadas.length} ya estaba(n) vinculado(s)` : '',
        r.enOtraObra.length ? `${r.enOtraObra.length} pertenece(n) a otra obra (${r.enOtraObra.map((o) => o.obra).join(', ')})` : '',
      ].filter(Boolean);
      mostrarToast(partes.join('. ') + '.', { tipo: 'info' });
    },
  });

  const refrescar = useMutation({
    mutationFn: (fabId: string) => refrescarFabricacion(proyecto.id, fabId),
    onSuccess: (r, fabId) => {
      invalidar(fabId);
      const cambios = r.ventanas.nuevas + r.ventanas.actualizadas + r.ventanas.retiradas;
      mostrarToast(
        (cambios === 0 ? 'Sin cambios en HETMO.' : `Actualizado: ${r.ventanas.nuevas} nueva(s), ${r.ventanas.actualizadas} modificada(s), ${r.ventanas.retiradas} retirada(s).`) +
          (r.advertencias.length ? ` ${r.advertencias.join(' ')}` : ''),
        { tipo: 'info' }
      );
    },
  });

  const desvincular = useMutation({
    mutationFn: (fabId: string) => desvincularFabricacion(proyecto.id, fabId),
    onSuccess: (_r, fabId) => {
      invalidar(fabId);
      setAbierto((a) => (a === fabId ? null : a));
    },
  });

  const confirmarDesvincular = (f: FabricacionHetmo) => {
    if (window.confirm(`¿Desvincular "${f.descripcion || `documento ${f.hetmoId}`}" de esta obra? Solo se borra la copia local; HETMO no se modifica.`)) {
      desvincular.mutate(f.id);
    }
  };

  const fabricaciones = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Fabricación</h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Documentos de fabricación de HETMO de esta obra. Los datos se leen de HETMO (solo lectura) y se guardan como copia
            para consultar ventanas y materiales.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tienePresupuestoHetmo && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Search className="w-3.5 h-3.5" />}
              isLoading={detectar.isPending}
              onClick={() => detectar.mutate()}
              title="Busca en HETMO los documentos de fabricación de los presupuestos de esta obra"
            >
              Detectar automáticamente
            </Button>
          )}
          <Button variant="primary" size="sm" leftIcon={<Link2 className="w-3.5 h-3.5" />} onClick={() => setBuscando(true)}>
            Vincular documento
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          No se pudieron cargar los documentos de fabricación. Intenta de nuevo en unos minutos.
        </div>
      ) : fabricaciones.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-1">
          <Factory className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">Esta obra aún no tiene documentos de fabricación.</p>
          <p>
            {tienePresupuestoHetmo
              ? 'Usa "Detectar automáticamente" para traer los de su presupuesto, o "Vincular documento" para buscar uno a mano.'
              : 'Usa "Vincular documento" para buscar en HETMO los documentos de esta obra (por ejemplo, uno por piso).'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fabricaciones.map((f) => {
            const expandido = abierto === f.id;
            return (
              <div key={f.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setAbierto(expandido ? null : f.id)}
                    className="flex items-center gap-2 min-w-0 text-left cursor-pointer flex-1 basis-full sm:basis-0"
                    aria-expanded={expandido}
                  >
                    {expandido ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{f.descripcion || `Documento ${f.hetmoId}`}</span>
                        <Badge size="sm" variant={varianteEstadoFabricacion(f.estadoHetmo)}>
                          {textoEstadoFabricacion(f.estadoHetmo, f.estadoGlosa)}
                        </Badge>
                        <Badge size="sm" variant="outline">
                          {f.origenVinculo === 'AUTOMATICO' ? 'Detectado' : 'Vinculado a mano'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        N° {f.numero ?? '—'} · HETMO {f.hetmoId}
                        {f.hetmoVentaId ? ` · venta ${f.hetmoVentaId}` : ''} · {f._count?.ventanas ?? 0} ventana(s) · leído {formatoFechaHora(f.sincronizadoEn)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      isLoading={refrescar.isPending && refrescar.variables === f.id}
                      disabled={refrescar.isPending}
                      onClick={() => refrescar.mutate(f.id)}
                      title="Volver a leer este documento desde HETMO"
                    >
                      Actualizar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Unlink className="w-3.5 h-3.5" />}
                      isLoading={desvincular.isPending && desvincular.variables === f.id}
                      disabled={desvincular.isPending}
                      onClick={() => confirmarDesvincular(f)}
                      title="Quitar de esta obra (no modifica HETMO)"
                    >
                      Desvincular
                    </Button>
                  </div>
                </div>
                {expandido && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    <FabricacionDetalle proyectoId={proyecto.id} fabricacionId={f.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {buscando && <BuscarFabricacionModal proyectoId={proyecto.id} onClose={() => setBuscando(false)} />}
    </div>
  );
};
