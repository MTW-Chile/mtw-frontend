import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { eliminarTipoCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { TipoCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { TipoModal } from './TipoModal';
import { estadoSaldo, formatoMonto } from './utils';

interface Props {
  proyectoId: string;
  moneda: string;
  tipos: TipoCubicacion[];
}

// Tipos de ventana de la cubicacion (la hoja BASE): contratadas vs cubicadas. La cubicacion puede quedar
// incompleta: el saldo es lo que falta cubicar.
export const TiposCubicacion: React.FC<Props> = ({ proyectoId, moneda, tipos }) => {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ tipo?: TipoCubicacion } | null>(null);

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarTipoCubicacion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] }),
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Tipos de ventana de la obra. Los marcados <b>HETMO</b> salen de una línea del presupuesto. <b>Contratadas</b> es lo vendido; <b>cubicadas</b>, las ventanas que ya tienen piso y departamento.
        </p>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModal({})}>
          Nuevo tipo
        </Button>
      </div>

      {tipos.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs">Aún no hay tipos. Importa la planilla o crea uno.</div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2.5 font-bold">Código</th>
                <th className="px-3 py-2.5 font-bold">Apertura</th>
                <th className="px-3 py-2.5 font-bold">Plano (mm)</th>
                <th className="px-3 py-2.5 font-bold text-right">Cuadros</th>
                <th className="px-3 py-2.5 font-bold text-right">Precio unit.</th>
                <th className="px-3 py-2.5 font-bold text-right">Contratadas</th>
                <th className="px-3 py-2.5 font-bold text-right">Cubicadas</th>
                <th className="px-3 py-2.5 font-bold text-right">Saldo</th>
                <th className="px-3 py-2.5 font-bold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => {
                const estado = estadoSaldo(t.saldo);
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {t.codigo}
                      {t.esAreaComun && (
                        <Badge size="sm" variant="outline" className="ml-1.5">
                          área común
                        </Badge>
                      )}
                      {t.lineaHetmo !== null && (
                        <Badge size="sm" variant="brand" className="ml-1.5" title={`Línea ${t.lineaHetmo} del presupuesto de HETMO`}>
                          HETMO
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[16rem] truncate" title={t.sistema}>
                      {t.sistema}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{t.anchoPlanoMm != null ? `${formatoMm(t.anchoPlanoMm)} × ${formatoMm(t.altoPlanoMm)}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{t.cuadros ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600 whitespace-nowrap">{formatoMonto(t.precioUnitario, moneda)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{t.cantidadContratada}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{t.cubicadas}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge size="sm" variant={estado === 'completo' ? 'success' : estado === 'excedido' ? 'danger' : 'warning'}>
                        {estado === 'completo' ? 'Completo' : t.saldo}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <button type="button" onClick={() => setModal({ tipo: t })} className="p-1.5 text-slate-400 hover:text-brand-600 cursor-pointer" aria-label={`Editar tipo ${t.codigo}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!t.esAreaComun && t.cubicadas > 0}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el tipo ${t.codigo}?`)) eliminar.mutate(t.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Eliminar tipo ${t.codigo}`}
                        title={!t.esAreaComun && t.cubicadas > 0 ? 'Tiene ventanas con posición: elimínalas primero' : 'Eliminar'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && <TipoModal proyectoId={proyectoId} moneda={moneda} tipo={modal.tipo} onClose={() => setModal(null)} />}
    </div>
  );
};
