import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ClipboardList, Plus, Check, X as XIcon, Truck } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import {
  getSolicitudesMaterial,
  createSolicitudMaterial,
  entregarSolicitudMaterial,
  aprobarGerenciaSolicitud,
  getMateriales,
} from '../../api/client';
import type { EstadoSolicitudMaterial, Proyecto, ProyectoVersion } from '../../types';

const ESTADO_LABEL: Record<EstadoSolicitudMaterial, string> = {
  GENERADA: 'Generada',
  PENDIENTE_APROBACION_GERENCIA: 'Pend. aprobación Gerencia',
  APROBADA: 'Aprobada (esperando compra)',
  RECHAZADA: 'Rechazada',
  ENTREGADA: 'Entregada',
};

const ESTADO_VARIANT: Record<EstadoSolicitudMaterial, BadgeVariant> = {
  GENERADA: 'subtle',
  PENDIENTE_APROBACION_GERENCIA: 'warning',
  APROBADA: 'info',
  RECHAZADA: 'danger',
  ENTREGADA: 'success',
};

interface ItemNuevo {
  materialId: string;
  descripcion: string;
  cantidadSolicitada: string;
}

// "Requisiciones de materiales" -- la Solicitud de Materiales (Fases) del
// BPMN Producción -> Bodega. Vive dentro de la pestaña Bodega de la ficha
// de proyecto, junto al stock y los movimientos (BodegaProyectoTab).
export const RequisicionesSection: React.FC<{ proyecto: Proyecto; activeVersion?: ProyectoVersion }> = ({
  proyecto,
  activeVersion,
}) => {
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [faseId, setFaseId] = useState('');
  const [items, setItems] = useState<ItemNuevo[]>([]);
  const [busqueda, setBusqueda] = useState('');

  const fases = activeVersion?.fases || [];

  const { data, isLoading } = useQuery({
    queryKey: ['solicitudesMaterial', { proyectoId: proyecto.id }],
    queryFn: () => getSolicitudesMaterial({ proyectoId: proyecto.id }),
  });

  const { data: materiales } = useQuery({
    queryKey: ['materiales', 'catalogo-completo'],
    queryFn: () => getMateriales({ limit: 500 }),
    enabled: creando,
  });

  const sugerencias = useMemo(() => {
    if (!busqueda.trim() || !materiales) return [];
    const term = busqueda.toLowerCase();
    return materiales
      .filter((m) => m.skuInterno.toLowerCase().includes(term) || m.descripcion.toLowerCase().includes(term))
      .slice(0, 8);
  }, [busqueda, materiales]);

  const crearMutation = useMutation({
    mutationFn: () =>
      createSolicitudMaterial(faseId, {
        items: items.filter((i) => i.cantidadSolicitada).map((i) => ({ materialId: i.materialId, cantidadSolicitada: parseFloat(i.cantidadSolicitada) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudesMaterial'] });
      setCreando(false);
      setFaseId('');
      setItems([]);
    },
  });

  const entregarMutation = useMutation({
    mutationFn: (id: string) => entregarSolicitudMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudesMaterial'] });
      queryClient.invalidateQueries({ queryKey: ['bodegaProyecto'] });
    },
  });

  const aprobarMutation = useMutation({
    mutationFn: ({ id, aprobado }: { id: string; aprobado: boolean }) => aprobarGerenciaSolicitud(id, aprobado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['solicitudesMaterial'] }),
  });

  const solicitudes = data?.data || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#E34A26]" />
          Requisiciones de materiales
        </h3>
        {!creando && fases.length > 0 && (
          <Button size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreando(true)}>
            Nueva requisición
          </Button>
        )}
      </div>

      {creando && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <Select
            label="Fase"
            options={[{ value: '', label: 'Selecciona una fase...' }, ...fases.map((f) => ({ value: f.id, label: f.nombre }))]}
            value={faseId}
            onChange={(e) => setFaseId(e.target.value)}
          />

          <div className="space-y-2">
            <div className="relative">
              <Input
                label="Agregar material"
                placeholder="Buscar por SKU o descripción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {sugerencias.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {sugerencias.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-50 last:border-0"
                      onClick={() => {
                        setItems((prev) => [...prev, { materialId: m.id, descripcion: `${m.skuInterno} · ${m.descripcion}`, cantidadSolicitada: '' }]);
                        setBusqueda('');
                      }}
                    >
                      <span className="font-mono font-bold text-slate-700">{m.skuInterno}</span> — {m.descripcion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="flex-1 text-xs text-slate-700 truncate">{item.descripcion}</span>
                <input
                  type="number"
                  placeholder="Cantidad"
                  value={item.cantidadSolicitada}
                  onChange={(e) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, cantidadSolicitada: e.target.value } : it)))
                  }
                  className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#E34A26]"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCreando(false); setFaseId(''); setItems([]); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              isLoading={crearMutation.isPending}
              disabled={!faseId || items.length === 0 || items.some((i) => !i.cantidadSolicitada)}
              onClick={() => crearMutation.mutate()}
            >
              Generar requisición
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Sin requisiciones de materiales todavía.
        </div>
      ) : (
        <div className="space-y-2.5">
          {solicitudes.map((s) => (
            <div key={s.id} className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{s.fase?.nombre || 'Fase'}</span>
                  <Badge variant={ESTADO_VARIANT[s.estado]} size="sm">
                    {ESTADO_LABEL[s.estado]}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  {(s.estado === 'GENERADA' || s.estado === 'APROBADA') && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Truck className="w-3.5 h-3.5" />}
                      isLoading={entregarMutation.isPending && entregarMutation.variables === s.id}
                      onClick={() => entregarMutation.mutate(s.id)}
                    >
                      Intentar entregar
                    </Button>
                  )}
                  {s.estado === 'PENDIENTE_APROBACION_GERENCIA' && (
                    <>
                      <Button
                        size="sm"
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                        isLoading={aprobarMutation.isPending}
                        onClick={() => aprobarMutation.mutate({ id: s.id, aprobado: true })}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        leftIcon={<XIcon className="w-3.5 h-3.5" />}
                        isLoading={aprobarMutation.isPending}
                        onClick={() => aprobarMutation.mutate({ id: s.id, aprobado: false })}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {s.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-[11px] text-slate-600 px-2">
                    <span>{item.material?.descripcion || item.materialId}</span>
                    <span className="font-mono">
                      {Number(item.cantidadEntregada).toLocaleString('es-CL')} / {Number(item.cantidadSolicitada).toLocaleString('es-CL')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
