import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Landmark, Loader2, ArrowLeft, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getProyectoById, updateEstadoAprobacion } from '../../api/client';
import { useMonedas } from '../../lib/monedas';
import { computeMaterialesConsolidados, computeCostoTotalYVenta } from '../cotizaciones/lib/materialesConsolidados';
import { ufLabel } from '../cotizaciones/steps/Step5Consolidacion/presupuestoPdf';
import type { AprobacionPendienteCotizacion } from '../../types';

interface Props {
  item: AprobacionPendienteCotizacion;
  onClose: () => void;
}

/**
 * Resumen financiero (costo/venta/margen, misma formula que el Presupuesto
 * -- ver PresupuestoOferta.tsx) para aprobar o devolver una cotizacion sin
 * salir del Centro de Notificaciones. No reimplementa la Hoja de Fijacion
 * completa (edicion de tarifas, dibujos, etc.) -- Gerencia aca solo
 * necesita los numeros finales para decidir.
 */
export const AprobarCotizacionModal: React.FC<Props> = ({ item, onClose }) => {
  const queryClient = useQueryClient();
  const monedas = useMonedas();

  const { data: proyecto, isLoading } = useQuery({
    queryKey: ['proyectoDetail', item.proyectoId],
    queryFn: () => getProyectoById(item.proyectoId),
  });
  const activeVersion = proyecto?.versiones.find((v) => v.id === item.versionId);

  const tasaDolar = Number(activeVersion?.tipoCambioDolar) || 950;
  const tasaUf = Number(activeVersion?.tipoCambioUF) || 38500;
  const tasaEuro = Number(activeVersion?.tipoCambioEuro) || 1030;

  const materialesConsolidados = useMemo(
    () => computeMaterialesConsolidados(activeVersion, tasaDolar, tasaEuro, tasaUf, monedas),
    [activeVersion, tasaDolar, tasaEuro, tasaUf, monedas]
  );
  const aprobacionesPorFamilia = useMemo(
    () => new Map((activeVersion?.familiaAprobaciones || []).map((f) => [f.familia, f])),
    [activeVersion?.familiaAprobaciones]
  );
  const { costoTotal, venta, margen } = useMemo(
    () => computeCostoTotalYVenta(activeVersion, materialesConsolidados, aprobacionesPorFamilia),
    [activeVersion, materialesConsolidados, aprobacionesPorFamilia]
  );

  const mutation = useMutation({
    mutationFn: (estado: 'APROBADO_GERENCIA' | 'EN_COTIZACION') => updateEstadoAprobacion(item.versionId, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misAprobacionesPendientes'] });
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', item.proyectoId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-slate-900 truncate">{item.obra}</h2>
              <p className="text-[11px] text-slate-500">{item.codigoInterno || 'Cotización'} · Aprobación gerencial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {isLoading || !activeVersion ? (
            <div className="py-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Cliente</div>
                  <div className="font-semibold text-slate-800 truncate">{proyecto?.cliente?.nombre || proyecto?.clienteNombreRaw}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Versión</div>
                  <div className="font-semibold text-slate-800">v{activeVersion.versionNumero}</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Costo total</span>
                  <span className="font-mono font-bold">{ufLabel(costoTotal, tasaUf)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Venta neta</span>
                  <span className="font-mono font-bold">{ufLabel(venta, tasaUf)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700">
                  <span className="font-bold">Margen</span>
                  <span className="font-mono font-black text-lg">{margen.toFixed(1)}%</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Estos números salen del mismo cálculo que la Hoja de Fijación y el Presupuesto de esta versión -- si
                necesitás revisar el detalle por línea, abrí la cotización completa desde Cotizaciones.
              </p>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate('EN_COTIZACION')}
          >
            Volver a Cotización
          </Button>
          <Button
            type="button"
            leftIcon={<Check className="w-3.5 h-3.5" />}
            isLoading={mutation.isPending}
            onClick={() => mutation.mutate('APROBADO_GERENCIA')}
          >
            Aprobar
          </Button>
        </div>
      </div>
    </div>
  );
};
