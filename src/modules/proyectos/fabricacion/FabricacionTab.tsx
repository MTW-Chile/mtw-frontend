import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Factory, Link2, Loader2, Pencil, RefreshCw, Search, Unlink } from 'lucide-react';
import {
  desvincularFabricacion,
  detectarFabricaciones,
  getFabricacionesProyecto,
  refrescarFabricacion,
  renombrarFabricacion,
} from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { SubTabs } from '../../../components/ui/PageHeader';
import { mostrarToast } from '../../../lib/toast';
import type { FabricacionHetmo, Proyecto, ProyectoVersion } from '../../../types';
import { FasesTab } from '../FasesTab';
import { BuscarFabricacionModal } from './BuscarFabricacionModal';
import { FabricacionDetalle } from './FabricacionDetalle';
import { formatoFechaHora, nombreDocumento, textoEstadoFabricacion, textoVinculacionCubicacion, varianteEstadoFabricacion } from './utils';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { IconButton } from '../../../components/ui/IconButton';
import { useMigas } from '../../../lib/migas';

interface Props {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
}

type SubTab = 'fases' | 'documentos';

// Seccion "Fabricacion" de una obra: fusiona Fases (planificar y conectar
// con el documento real de fabricacion) y los documentos de fabricacion de
// HETMO en si, con sub-pestañas -- Fases primero (es el flujo principal).
// Una obra manual no tiene presupuesto ni Fase posibles: carga directo los
// documentos, sin el switcher de sub-pestañas.
export const FabricacionTab: React.FC<Props> = ({ proyecto, activeVersion }) => {
  const [subTab, setSubTab] = useState<SubTab>('fases');
  const conSubpestanas = proyecto.origen !== 'MANUAL_OBRA' && !!activeVersion;
  useMigas(2, [conSubpestanas && { label: subTab === 'fases' ? 'Fases de Producción' : 'Documentos de fabricación' }]);

  if (proyecto.origen === 'MANUAL_OBRA' || !activeVersion) {
    return <DocumentosFabricacionSubTab proyecto={proyecto} />;
  }

  return (
    <div className="space-y-4">
      <SubTabs
        tabs={[
          { id: 'fases', label: 'Fases de Producción' },
          { id: 'documentos', label: 'Documentos de fabricación' },
        ]}
        active={subTab}
        onChange={setSubTab}
      />
      {subTab === 'fases' ? (
        <FasesTab proyecto={proyecto} activeVersion={activeVersion} />
      ) : (
        <DocumentosFabricacionSubTab proyecto={proyecto} />
      )}
    </div>
  );
};

const DocumentosFabricacionSubTab: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const { confirmar, pedirTexto } = useConfirmar();
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
          (r.advertencias.length ? ` ${r.advertencias.join(' ')}` : '') +
          (r.vinculacionCubicacion ? ` ${textoVinculacionCubicacion(r.vinculacionCubicacion)}` : ''),
        { tipo: 'info' }
      );
    },
  });

  // Nombre propio del documento (cambio interno del ERP): la descripción de HETMO queda al lado como referencia.
  const renombrar = useMutation({
    mutationFn: ({ fabId, nombre }: { fabId: string; nombre: string }) => renombrarFabricacion(proyecto.id, fabId, nombre),
    onSuccess: () => {
      invalidar();
      queryClient.invalidateQueries({ queryKey: ['cubicacion', proyecto.id] });
      queryClient.invalidateQueries({ queryKey: ['propuestaFabricacion', proyecto.id] });
    },
  });
  const pedirNombre = async (f: FabricacionHetmo) => {
    const nombre = await pedirTexto({ titulo: `Nombre del documento ${f.descripcion || f.hetmoId}`, etiqueta: 'Nombre en el ERP (vacío para volver al de HETMO)', valorInicial: f.nombre ?? '' });
    if (nombre !== null) renombrar.mutate({ fabId: f.id, nombre: nombre.trim() });
  };

  const desvincular = useMutation({
    mutationFn: (fabId: string) => desvincularFabricacion(proyecto.id, fabId),
    onSuccess: (_r, fabId) => {
      invalidar(fabId);
      setAbierto((a) => (a === fabId ? null : a));
    },
  });

  const confirmarDesvincular = async (f: FabricacionHetmo) => {
    if (await confirmar({ titulo: `¿Desvincular "${f.descripcion || `documento ${f.hetmoId}`}" de esta obra?`, mensaje: `Solo se borra la copia local; HETMO no se modifica.`, confirmar: 'Desvincular', peligro: true })) {
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
            Vincular documentos
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
              ? 'Usa "Detectar automáticamente" para traer los de su presupuesto, o "Vincular documentos" para buscarlos a mano.'
              : 'Usa "Vincular documentos" para buscar en HETMO los de esta obra (por ejemplo, uno por piso) y vincularlos de una vez.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fabricaciones.map((f) => {
            const expandido = abierto === f.id;
            return (
              <div key={f.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <BotonColapsar abierto={expandido} onClick={() => setAbierto(expandido ? null : f.id)} className="flex-nowrap! gap-2! flex-1 basis-full sm:basis-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{nombreDocumento(f)}</span>
                        {f.nombre?.trim() && f.descripcion && f.nombre.trim() !== f.descripcion && <span className="text-[11px] text-slate-400 truncate">({f.descripcion})</span>}
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
                  </BotonColapsar>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <IconButton icono={Pencil} etiqueta={`Cambiar el nombre de ${nombreDocumento(f)}`} tono="marca" cargando={renombrar.isPending && renombrar.variables?.fabId === f.id} onClick={() => pedirNombre(f)} />
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
