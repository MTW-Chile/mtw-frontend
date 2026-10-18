import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { getPartidas, getPorClasificar, reclasificarItemOC, updateAdicionalItem } from '../../api/client';
import { avisarError } from '../configuracion/catalogo/comun';
import type { Partida } from '../../types';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../components/ui/Tabla';
import { SelectCompacto } from '../../components/ui/Campos';

const clp = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const SelectorPartida: React.FC<{ partidas: Partida[]; onElegir: (id: string) => void; disabled: boolean }> = ({ partidas, onElegir, disabled }) => (
  <SelectCompacto aria-label="Asignar partida" tono="advertencia" defaultValue="" disabled={disabled} onChange={(e) => e.target.value && onElegir(e.target.value)}>
    <option value="">Asignar partida…</option>
    {partidas
      .filter((p) => p.activa && !p.porDefecto)
      .map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
  </SelectCompacto>
);

/**
 * Bandeja "Por clasificar" (docs/ARQUITECTURA.md 3.4.5): ítems de OC y de
 * adicionales que quedaron en "Sin asignar". Cuentan en costo y venta, pero
 * no se contabilizan en Clay hasta asignarles su partida. Si un mismo ítem se
 * repite, falta un tipo de producto o una partida en el catálogo.
 */
export const PorClasificarTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['porClasificar'], queryFn: getPorClasificar });
  const { data: partidas = [] } = useQuery({ queryKey: ['partidas'], queryFn: getPartidas });
  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['porClasificar'] });
    queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
    queryClient.invalidateQueries({ queryKey: ['adicionales'] });
  };
  const oc = useMutation({ mutationFn: (v: { itemId: string; partidaId: string }) => reclasificarItemOC(v.itemId, v.partidaId), onSuccess: refrescar, onError: avisarError });
  const adicional = useMutation({
    mutationFn: (v: { adicionalId: string; itemId: string; partidaId: string }) => updateAdicionalItem(v.adicionalId, v.itemId, { partidaId: v.partidaId }),
    onSuccess: refrescar,
    onError: avisarError,
  });

  if (isLoading || !data) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (data.total === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 space-y-2">
        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
        <p>No hay nada por clasificar: todos los ítems tienen su partida.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Ítems libres que quedaron sin partida. Cuentan en el costo y la venta, pero no se contabilizan en Clay hasta asignársela.
      </p>
      {data.ordenesCompra.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100">Órdenes de compra</h3>
          <Tabla>
            <Thead>
              <Tr>
                <Th>OC</Th>
                <Th>Ítem</Th>
                <Th>Obra</Th>
                <Th alinear="derecha">Monto</Th>
                <Th>Partida</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.ordenesCompra.map((i) => (
                <Tr key={i.id}>
                  <Td className="font-mono text-[11px]">{i.ordenCompra.numero}</Td>
                  <Td>
                    <div className="font-semibold text-slate-800">{i.descripcion}</div>
                    <div className="text-[10px] text-slate-400">{i.ordenCompra.proveedor?.nombre ?? 'Sin proveedor'}</div>
                  </Td>
                  <Td className="text-[11px]">{i.ordenCompra.proyecto?.obra ?? 'Obras Mayores'}</Td>
                  <Td alinear="derecha" className="font-mono">{clp(Number(i.cantidad) * Number(i.precioUnitario ?? 0))}</Td>
                  <Td>
                    <SelectorPartida partidas={partidas} disabled={oc.isPending} onElegir={(partidaId) => oc.mutate({ itemId: i.id, partidaId })} />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Tabla>
        </section>
      )}
      {data.adicionales.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100">Adicionales</h3>
          <Tabla>
            <Thead>
              <Tr>
                <Th>Adicional</Th>
                <Th>Ítem</Th>
                <Th>Obra</Th>
                <Th alinear="derecha">Costo</Th>
                <Th>Partida</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.adicionales.map((i) => (
                <Tr key={i.id}>
                  <Td className="font-mono text-[11px]">A{i.adicional.numero}</Td>
                  <Td>
                    <div className="font-semibold text-slate-800">{i.descripcion}</div>
                    <div className="text-[10px] text-slate-400">{i.adicional.titulo}</div>
                  </Td>
                  <Td className="text-[11px]">{i.adicional.proyecto.obra}</Td>
                  <Td alinear="derecha" className="font-mono">{clp(Number(i.cantidad) * Number(i.costoUnitario))}</Td>
                  <Td>
                    <SelectorPartida
                      partidas={partidas}
                      disabled={adicional.isPending}
                      onElegir={(partidaId) => adicional.mutate({ adicionalId: i.adicional.id, itemId: i.id, partidaId })}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Tabla>
        </section>
      )}
    </div>
  );
};
