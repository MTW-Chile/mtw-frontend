import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Loader2, ChevronRight } from 'lucide-react';
import { getAdicionales } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useUrlParam } from '../../../lib/navigation';
import { usePermisos } from '../../../lib/permisos';
import type { Proyecto } from '../../../types';
import { ETIQUETA_ESTADO_ADICIONAL } from '../../../types';
import { AdicionalDetalle } from './AdicionalDetalle';
import { NuevoAdicionalModal } from './NuevoAdicionalModal';
import { VARIANTE_ESTADO, clp, uf } from './comun';

/**
 * Adicionales de la obra: ventas o cargos fuera del presupuesto aceptado,
 * cotizados con precios vigentes. El adicional abierto va en la URL
 * (?adicional=<id>) para que Atrás y los avisos de aprobación lo respeten.
 */
export const AdicionalesTab: React.FC<{ proyecto: Proyecto }> = ({ proyecto }) => {
  const queryClient = useQueryClient();
  const { tiene } = usePermisos();
  const [abierto, setAbierto] = useUrlParam('adicional');
  const [creando, setCreando] = useState(false);
  const { data: adicionales = [], isLoading } = useQuery({ queryKey: ['adicionales', proyecto.id], queryFn: () => getAdicionales(proyecto.id) });

  if (abierto) return <AdicionalDetalle proyecto={proyecto} adicionalId={abierto} onVolver={() => setAbierto(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Adicionales</h2>
          <p className="text-xs text-slate-500">
            Ventas al cliente o cargos al instalador fuera del presupuesto aceptado. Se cotizan con precios y divisas vigentes.
          </p>
        </div>
        {tiene('adicionales.editar') && (
          <Button size="sm" leftIcon={<FilePlus2 className="w-3.5 h-3.5" />} onClick={() => setCreando(true)}>
            Nuevo adicional
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : adicionales.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">Esta obra no tiene adicionales.</div>
      ) : (
        <ul className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100">
          {adicionales.map((a) => (
            <li key={a.id}>
              <button onClick={() => setAbierto(a.id)} className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50 cursor-pointer">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-500">A{a.numero}</span>
                    <span className="text-sm font-bold text-slate-900 truncate">{a.titulo}</span>
                    <Badge size="sm" variant={VARIANTE_ESTADO[a.estado]}>
                      {ETIQUETA_ESTADO_ADICIONAL[a.estado]}
                    </Badge>
                    {a.items.some((i) => i.porClasificar) && (
                      <Badge size="sm" variant="warning">
                        Por clasificar
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {a.cargoA === 'CLIENTE' ? 'Cliente' : `Instalador ${a.instalador?.nombre ?? ''}`} ·{' '}
                    {a.origen === 'ITEMS' ? `${a.items.length} ítems` : `${a.version?.ventanas.length ?? 0} ventanas recotizadas`} · creado{' '}
                    {new Date(a.creadoEn).toLocaleDateString('es-CL')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-slate-900">{clp(a.totales.venta)}</div>
                    <div className="text-[10px] text-slate-400">{uf(a.totales.ventaUf)} neto</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creando && (
        <NuevoAdicionalModal
          proyectoId={proyecto.id}
          onClose={() => setCreando(false)}
          onCreado={(a) => {
            setCreando(false);
            queryClient.invalidateQueries({ queryKey: ['adicionales', proyecto.id] });
            setAbierto(a.id);
          }}
        />
      )}
    </div>
  );
};
