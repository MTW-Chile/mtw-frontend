import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Link2, Loader2, Unlink } from 'lucide-react';
import { desvincularDocumentoHetmo, elegirVentanasAdicional, getVersion, vincularDocumentoHetmo } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { SubTabs } from '../../../components/ui/PageHeader';
import { extraerErrorParaToast } from '../../../lib/toast';
import { Step3Materiales } from '../../cotizaciones/steps/Step3Materiales/Step3Materiales';
import { Step4Fijaciones } from '../../cotizaciones/steps/Step4Fijaciones/Step4Fijaciones';
import type { Adicional, Proyecto } from '../../../types';
import { ElegirVentanasModal } from './ElegirVentanasModal';
import { InputCompacto } from '../../../components/ui/Campos';

/** Clave de la version de un adicional: cuelga del detalle del proyecto (los Pasos lo invalidan). */
export const versionAdicionalKey = (proyectoId: string, versionId: string | null) => ['proyectoDetail', proyectoId, 'versionAdicional', versionId];

/**
 * Adicional de ventanas o de documento de HETMO: las ventanas de su versión
 * (elegidas de la cotización y recotizadas, o las del documento de HETMO
 * vinculado) con el mismo flujo de cotización (Analítica y Hoja de Fijación).
 */
export const VentanasAdicional: React.FC<{ proyecto: Proyecto; adicional: Adicional; editable: boolean; onCambio: (a: Adicional) => void }> = ({
  proyecto,
  adicional,
  editable,
  onCambio,
}) => {
  const queryClient = useQueryClient();
  const [eligiendo, setEligiendo] = useState(false);
  const [paso, setPaso] = useState<'analitica' | 'fijacion'>('analitica');
  const { data: version, isLoading } = useQuery({
    queryKey: versionAdicionalKey(proyecto.id, adicional.versionId),
    queryFn: () => getVersion(adicional.versionId!),
    enabled: !!adicional.versionId,
  });
  const elegir = useMutation({
    mutationFn: (ventanas: { ventanaId: string; unidades: number }[]) => elegirVentanasAdicional(adicional.id, ventanas),
    onSuccess: (a) => {
      setEligiendo(false);
      onCambio(a);
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyecto.id] });
    },
  });
  const tasas = { dolar: String(Number(adicional.tasaDolar)), euro: String(Number(adicional.tasaEuro)), uf: String(Number(adicional.tasaUf)) };
  const esHetmo = adicional.origen === 'HETMO';
  const [codigoHetmo, setCodigoHetmo] = useState('');
  const vincular = useMutation({
    mutationFn: () => vincularDocumentoHetmo(adicional.id, Number(codigoHetmo)),
    onSuccess: (a) => {
      setCodigoHetmo('');
      onCambio(a);
    },
  });
  const desvincular = useMutation({ mutationFn: () => desvincularDocumentoHetmo(adicional.id), onSuccess: onCambio });
  const errorHetmo = vincular.error ?? desvincular.error;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">{esHetmo ? 'Documento de HETMO' : 'Ventanas recotizadas'}</h3>
          {editable && !esHetmo && (
            <Button size="sm" variant="outline" leftIcon={<LayoutGrid className="w-3.5 h-3.5" />} onClick={() => setEligiendo(true)}>
              {adicional.version ? 'Cambiar ventanas' : 'Elegir ventanas'}
            </Button>
          )}
          {editable && esHetmo && adicional.versionId && (
            <Button size="sm" variant="outline" leftIcon={<Unlink className="w-3.5 h-3.5" />} isLoading={desvincular.isPending} onClick={() => desvincular.mutate()}>
              Desvincular
            </Button>
          )}
        </div>
        {esHetmo && !adicional.versionId && (
          <div className="p-4 border-b border-slate-100 space-y-2 text-xs">
            <p className="text-slate-500">
              Indica el código interno del documento de venta en HETMO (puede ser una fase del mismo proyecto). Si todavía no está en el ERP, se
              trae ahora. HETMO no verifica que sus líneas correspondan a las de la cotización.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <InputCompacto
                aria-label="Código interno HETMO"
                type="number"
                min={1}
                value={codigoHetmo}
                disabled={!editable}
                onChange={(e) => setCodigoHetmo(e.target.value)}
                placeholder="Código interno HETMO"
                className="w-48"
              />
              <Button size="sm" leftIcon={<Link2 className="w-3.5 h-3.5" />} disabled={!editable || !(Number(codigoHetmo) > 0)} isLoading={vincular.isPending} onClick={() => vincular.mutate()}>
                Vincular
              </Button>
            </div>
          </div>
        )}
        {errorHetmo && <p className="px-4 py-2 text-xs text-rose-700 bg-rose-50">{extraerErrorParaToast(errorHetmo).mensaje}</p>}
        {adicional.version?.ventanas.length ? (
          <ul className="divide-y divide-slate-100 text-xs">
            {adicional.version.ventanas.map((v) => (
              <li key={v.id} className="px-4 py-2 flex items-center justify-between gap-3">
                <span>
                  <span className="font-semibold text-slate-800">{v.modelo}</span>
                  <span className="text-slate-400"> · línea {v.lineaHetmo} · {Number(v.anchoMm)} × {Number(v.altoMm)} mm</span>
                </span>
                <span className="tabular-nums text-slate-600">{v.unidades} un.</span>
              </li>
            ))}
          </ul>
        ) : (
          !esHetmo && <p className="px-4 py-6 text-center text-xs text-slate-400">Elige las ventanas de la cotización que se recotizan en este adicional.</p>
        )}
      </section>

      {adicional.versionId &&
        (isLoading || !version ? (
          <div className="p-10 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <SubTabs
              tabs={[
                { id: 'analitica' as const, label: 'Analítica de materiales' },
                { id: 'fijacion' as const, label: 'Hoja de fijación' },
              ]}
              active={paso}
              onChange={setPaso}
            />
            {paso === 'analitica' ? (
              <Step3Materiales
                proyecto={proyecto}
                activeVersion={version}
                dolar={tasas.dolar}
                setDolar={() => undefined}
                uf={tasas.uf}
                setUf={() => undefined}
                euro={tasas.euro}
                setEuro={() => undefined}
                saveSuccess={false}
                onSaveDivisas={() => undefined}
                isSavingDivisas={false}
                modoAdicional
              />
            ) : (
              <Step4Fijaciones proyecto={proyecto} activeVersion={version} dolar={tasas.dolar} uf={tasas.uf} euro={tasas.euro} modoAdicional />
            )}
          </div>
        ))}

      {eligiendo && (
        <ElegirVentanasModal
          proyecto={proyecto}
          pendiente={elegir.isPending}
          error={elegir.error ? extraerErrorParaToast(elegir.error).mensaje : null}
          onConfirmar={(ventanas) => elegir.mutate(ventanas)}
          onClose={() => setEligiendo(false)}
        />
      )}
    </div>
  );
};
