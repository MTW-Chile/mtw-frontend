import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, PackageCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { getOrdenesCompra } from '../../api/client';
import { RecepcionarOCModal } from './RecepcionarOCModal';
import type { OrdenCompra } from '../../types';

const itemsPendientes = (oc: OrdenCompra) =>
  oc.items.filter((i) => {
    const recibido = (i.recepciones || []).reduce((s, r) => s + Number(r.cantidadRecibida), 0);
    return recibido < Number(i.cantidad) - 0.0001;
  }).length;

/**
 * OC en ENVIADA/RECIBIDA_PARCIAL -- lo que Bodega tiene pendiente de
 * recepcionar (marcar lo que efectivamente llego). Sin proyectoId: todas
 * las obras + "Obras Mayores" juntas (modulo Bodega global). Con
 * proyectoId: solo las de esa obra (ficha de proyecto).
 */
export const RecepcionesPendientesSection: React.FC<{ proyectoId?: string }> = ({ proyectoId }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['ordenesCompra', 'pendientes-recepcion', proyectoId ?? 'global'],
    queryFn: () => getOrdenesCompra({ proyectoId, limit: 200 }),
  });
  const [recepcionando, setRecepcionando] = useState<OrdenCompra | null>(null);

  const pendientes = (data?.data || []).filter((oc) => oc.estado === 'ENVIADA' || oc.estado === 'RECIBIDA_PARCIAL');

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
        <PackageCheck className="w-4 h-4 text-[#E34A26]" />
        Recepciones pendientes
      </h3>

      {isLoading ? (
        <div className="p-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : pendientes.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
          Sin recepciones pendientes por ahora.
        </div>
      ) : (
        <div className="space-y-2.5">
          {pendientes.map((oc) => (
            <div
              key={oc.id}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                <span className="font-mono font-bold text-xs text-slate-900">{oc.numero}</span>
                <span className="text-xs text-slate-600">{oc.proveedor?.nombre}</span>
                {!proyectoId && (
                  <span className="text-xs text-slate-400">· {oc.proyecto?.obra || oc.centroCosto?.nombre || 'Obras Mayores'}</span>
                )}
                <Badge variant={oc.estado === 'RECIBIDA_PARCIAL' ? 'warning' : 'info'} size="sm">
                  {oc.estado === 'RECIBIDA_PARCIAL' ? 'Recibida parcial' : 'Enviada'}
                </Badge>
                <span className="text-[11px] text-slate-400 font-mono">
                  {itemsPendientes(oc)} de {oc.items.length} ítems pendientes
                </span>
              </div>
              <Button size="sm" onClick={() => setRecepcionando(oc)}>
                Recepcionar
              </Button>
            </div>
          ))}
        </div>
      )}

      {recepcionando && <RecepcionarOCModal ordenCompra={recepcionando} onClose={() => setRecepcionando(null)} />}
    </div>
  );
};
